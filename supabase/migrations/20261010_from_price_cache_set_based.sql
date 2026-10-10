-- The from-price rebuild must fit inside a publish. It did not.
--
-- rebuild_from_prices_cache() runs from a trigger on pricing_config, inside
-- the publish statement, on a connection with statement_timeout = 8s.
-- 20261009_pricing_payload_v3.sql gave it a deduped branch that called
-- pricing_expand() once per product. Measured afterwards, far too late:
--
--   expanding all 36 products   4,552 ms   and 18.8 MB of JSON built
--   what a "from" price needs   738 rows
--
-- It built every product's entire price list -- 18.8 MB -- to find one cheap
-- price each, and Publish timed out four times on 10 October and wrote
-- nothing. The catalogue was untouched and no price moved, but nothing could
-- be published until this was fixed.
--
-- BEFORE ADDING WORK TO PUBLISH, MEASURE WHAT PUBLISH HAS LEFT. That note was
-- already in the project from 27 September, when a 303 ms cache trigger was
-- added to an operation at 64% of its limit. It was not read.
--
-- This version computes only what a from price is: flat, single-sided,
-- cheapest at each quantity, in one set-based pass, never materialising a
-- product's full list. Single-sided alone drops three quarters of the rate
-- set before any work happens.
--
--   deduped branch    ~950 ms   (1,066 ms measured, less 115 ms to build the
--                                candidate, which the real trigger does not do)
--   legacy branch       355 ms  against the live catalogue
--
-- Identical output either way: all 36 products, same price and same display
-- quantity as the cache held before, checked before this was installed.
--
-- It handles BOTH shapes, chosen by whether the payload carries rate_sets --
-- never by schema_version, which has said 3 for weeks. See
-- tools/test-payload-version-gate.py.

create or replace function public.rebuild_from_prices_cache()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare n integer;
begin
  with cfg as (select payload as j from pricing_config order by published_at desc limit 1),
  -- OLD SHAPE: a per-product copy of the price list. Unchanged path.
  legacy as (
    select p ->> 'slug' as slug, (r ->> 'qty')::int as qty, (r ->> 'sell')::numeric as sell
    from cfg c, jsonb_array_elements(c.j -> 'products') p,
         jsonb_array_elements(p -> 'sheet_sells') r
    where not (c.j ? 'rate_sets')
      and coalesce(r ->> 'fold', 'flat')    = 'flat'
      and coalesce(r ->> 'sides', 'single') = 'single'
  ),
  -- DEDUPED SHAPE: costs stored once, margin applied here.
  prods as (
    select p ->> 'slug' as slug, p, coalesce((p ->> 'margin_pct')::numeric, 0) / 100 + 1 as mult
    from cfg c, jsonb_array_elements(c.j -> 'products') p
    where c.j ? 'rate_sets'
  ),
  route as (
    select pr.slug, (ord - 1)::int as rt, r ->> 'family' as family,
           coalesce(r ->> 'fold', 'flat') as fold,
           case when jsonb_typeof(r -> 'papers') = 'array'
                     and jsonb_array_length(r -> 'papers') > 0
                then r -> 'papers' end as only_papers
    from prods pr, lateral jsonb_array_elements(pr.p -> 'routes') with ordinality t(r, ord)
  ),
  pw as (select k as paper, v as weights from cfg c, lateral jsonb_each(c.j -> 'paper_weights') t(k, v)),
  -- A from price is single-sided by definition, so three quarters of the rate
  -- set never has to be looked at.
  rates as (
    select r ->> 'family' as family, r ->> 'paper' as paper, nullif(r ->> 'gsm','')::int as gsm,
           r ->> 'size' as size, (r ->> 'qty')::int as qty, (r ->> 'cost')::numeric as cost
    from cfg c, lateral jsonb_array_elements(c.j -> 'rate_sets') r
    where coalesce(r ->> 'sides', 'single') = 'single'
  ),
  sheet as (
    select pr.slug, s.paper, s.gsm, s.size, s.qty,
           trim_scale(round(s.cost * pr.mult, 2)) as sell
    from prods pr join rates s on true
    join lateral (
      select rr.fold from route rr
      where rr.slug = pr.slug and rr.family = s.family
        and (rr.only_papers is null or rr.only_papers ? s.paper)
      order by rr.rt limit 1
    ) rt on true
    where rt.fold = 'flat'
      and (pr.p -> 'available_papers') ? s.paper
      and (pr.p -> 'available_sizes')  ? s.size
      and (not exists (select 1 from pw where pw.paper = s.paper and jsonb_array_length(pw.weights) > 0)
           or exists (select 1 from pw where pw.paper = s.paper and pw.weights @> to_jsonb(s.gsm)))
  ),
  -- The same no-backward-steps flattening, on the flat single-sided curves
  -- these prices come from. It can only ever lower a price, but it has to be
  -- applied or a "from" price can sit above one the order page will quote.
  flattened as (
    select slug, qty,
           min(sell) over (partition by slug, paper, gsm, size
                           order by qty desc
                           rows between unbounded preceding and current row) as sell
    from sheet
  ),
  rows as (select slug, qty, sell from flattened
           union all
           select slug, qty, sell from legacy),
  cheapest as (select slug, qty, min(sell) as sell from rows group by slug, qty),
  want as (select pt.slug, coalesce(pt.display_quantity, 1) as target
             from product_types pt where pt.active),
  picked as (
    select w.slug, c.qty, c.sell,
           row_number() over (
             partition by w.slug
             order by (c.qty >= w.target) desc,
                      case when c.qty >= w.target then c.qty - w.target
                                                  else w.target - c.qty end) as rn
    from want w join cheapest c on c.slug = w.slug
  ),
  up as (
    insert into from_prices_cache (slug, net_price, display_quantity, updated_at)
    select p.slug, p.sell, p.qty, now() from picked p where p.rn = 1
    on conflict (slug) do update
      set net_price = excluded.net_price,
          display_quantity = excluded.display_quantity,
          updated_at = now()
    returning 1
  )
  select count(*) into n from up;

  delete from from_prices_cache c
   where not exists (select 1 from product_types pt
                      where pt.slug = c.slug and pt.active);
  return n;
end;
$function$;
