-- Store each cost ONCE, apply the margin when a price is read.
--
-- Why: the published catalogue carries a complete copy of the price list for
-- every product. At 36 products that is 26 MB holding 220,240 rows that are
-- really 9,556. The fourteen products added on 9 October introduced no new
-- prices at all -- the distinct count stayed at 6,994 -- they each took a copy.
--
-- The size is the symptom. The reason to fix it is margins: today the margin is
-- multiplied into every stored price, so changing one product's margin rewrites
-- the whole 26 MB. After this a margin is one number on one product and nothing
-- is recomputed. And it has to happen BEFORE margins are set: every margin is
-- currently 0, which is the only reason the 36 copies are identical. Give two
-- products in a family different margins and the duplication becomes real.
--
-- Nothing on the site changes shape. pricing_for() is the single seam every
-- page, create-checkout and upload-and-print already read through, and it
-- still returns exactly what it returned before.
--
-- SAFE TO APPLY BEFORE ANYTHING IS REPUBLISHED: pricing_for reads
-- schema_version and takes the old path unchanged for a v2 payload. The live
-- payload stays v2 until somebody presses Publish from the new admin.

-- ---------------------------------------------------------------------------
-- pricing_expand(payload, slug) -- pure, takes the payload as an argument so it
-- can be tested against a candidate without writing one anywhere near the live
-- row. Returns the SAME product object the fat payload carried.
-- ---------------------------------------------------------------------------
create or replace function public.pricing_expand(p_payload jsonb, p_slug text)
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
with prod as (
  select p from jsonb_array_elements(p_payload -> 'products') p
  where p ->> 'slug' = p_slug
  limit 1
),
m as (select coalesce((select (p ->> 'margin_pct')::numeric from prod), 0) / 100 + 1 as mult),
-- The product's own facts, as arrays, so the filters below are plain membership.
f as (
  select (select p -> 'routes' from prod)                              as routes,
         (select coalesce(p -> 'available_papers',  '[]'::jsonb) from prod) as papers,
         (select coalesce(p -> 'available_sizes',   '[]'::jsonb) from prod) as sizes,
         (select coalesce(p -> 'available_finishes','[]'::jsonb) from prod) as finishes,
         (select coalesce((p ->> 'sides_offered')::boolean, false) from prod)   as sides_offered,
         (select coalesce((p ->> 'envelopes_offered')::boolean, true) from prod) as envelopes_offered
),
route as (
  select (ord - 1)::int                       as rt,
         r ->> 'family'                       as family,
         coalesce(r ->> 'fold', 'flat')       as fold,
         case when jsonb_typeof(r -> 'papers') = 'array'
                   and jsonb_array_length(r -> 'papers') > 0
              then r -> 'papers' end          as only_papers
  from f, lateral jsonb_array_elements(f.routes) with ordinality t(r, ord)
),
-- A sheet rate belongs to this product if some route claims its family (and,
-- where a route names its stocks, that paper), on a paper, size and weight the
-- product offers. The FIRST matching route wins, exactly as the publisher does
-- it -- two routes may share a fold and only the paper tells them apart.
sheet as (
  select rt.fold, rt.rt, s.sides, s.paper, s.gsm, s.size, s.qty, s.ord,
         round((s.cost) * (select mult from m), 2) as sell
  from (
    select (r ->> 'family') family, (r ->> 'paper') paper,
           nullif(r ->> 'gsm','')::int gsm, (r ->> 'size') size,
           coalesce(r ->> 'sides','single') sides, (r ->> 'qty')::int qty,
           (r ->> 'cost')::numeric cost, ord
    from jsonb_array_elements(coalesce(p_payload -> 'rate_sets','[]'::jsonb)) with ordinality t(r, ord)
  ) s
  cross join f
  join lateral (
    select rr.rt, rr.fold from route rr
    where rr.family = s.family
      and (rr.only_papers is null or rr.only_papers ? s.paper)
    order by rr.rt limit 1
  ) rt on true
  where (s.sides = 'single' or f.sides_offered)
    and f.papers ? s.paper
    and f.sizes  ? s.size
    -- A paper with no weights recorded filters nothing, as in the publisher.
    -- The map must carry RETIRED papers too: a product may still name one, and
    -- payload.papers holds only the active ones.
    and (
      coalesce(jsonb_array_length(p_payload -> 'paper_weights' -> s.paper), 0) = 0
      or (p_payload -> 'paper_weights' -> s.paper) @> to_jsonb(s.gsm)
    )
),
-- "Never quote more for fewer cards": walk each curve down from the largest
-- quantity and never let a price stand above the one above it. Applied after
-- the margin and the rounding, exactly where the publisher applies it, so the
-- question of whether the two commute does not arise.
flat as (
  select fold, rt, sides, paper, gsm, size, qty, ord,
         min(sell) over (partition by paper, gsm, size, fold, sides
                         order by qty desc
                         rows between unbounded preceding and current row) as sell
  from sheet
),
finishes as (
  select fr.family, fr.finish, fr.option, fr.sides, fr.size, fr.qty, fr.ord,
         round(fr.cost * (select mult from m), 2) as sell
  from (
    select (r ->> 'family') family, (r ->> 'finish') finish, (r ->> 'option') option,
           (r ->> 'sides') sides, (r ->> 'size') size, (r ->> 'qty')::int qty,
           (r ->> 'cost')::numeric cost, ord
    from jsonb_array_elements(coalesce(p_payload -> 'finish_sets','[]'::jsonb)) with ordinality t(r, ord)
  ) fr
  cross join f
  where exists (select 1 from route rr where rr.family = fr.family)
    and f.sizes ? fr.size
    and case when fr.finish ~* '^envelopes$'
             then f.envelopes_offered
             else f.finishes ? fr.finish end
)
select case when (select p from prod) is null then null else
  (select p from prod)
  || jsonb_build_object(
    'sheet_sells', coalesce((
      select jsonb_agg(jsonb_build_object(
               'fold', fold, 'rt', rt, 'sides', sides, 'paper', paper,
               'gsm', gsm, 'size', size, 'qty', qty, 'sell', sell) order by ord)
      from flat), '[]'::jsonb),
    'finish_prices', coalesce((
      select jsonb_agg(jsonb_build_object(
               'family', family, 'finish', finish, 'option', option,
               'sides', sides, 'size', size, 'qty', qty, 'sell', sell) order by ord)
      from finishes), '[]'::jsonb))
end
$function$;

comment on function public.pricing_expand(jsonb, text) is
  'Cuts one product share out of a v3 (deduped) payload, applying that product''s margin and the no-backward-steps flattening. Pure: takes the payload, so a candidate can be tested without writing it.';

-- ---------------------------------------------------------------------------
-- pricing_for -- the single read seam. Same output as before, both schemas.
-- ---------------------------------------------------------------------------
create or replace function public.pricing_for(p_slug text)
returns table(payload jsonb)
language sql
stable
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'schema_version', c.payload -> 'schema_version',
    'published_at',   c.payload -> 'published_at',
    'papers',         coalesce(c.payload -> 'papers', '[]'::jsonb),
    'products',       coalesce(
      case when coalesce((c.payload ->> 'schema_version')::int, 2) >= 3
           then (select jsonb_agg(x) from (
                   select pricing_expand(c.payload, p ->> 'slug') x
                   from jsonb_array_elements(c.payload -> 'products') p
                   where p ->> 'slug' = p_slug) z where x is not null)
           else (select jsonb_agg(p)
                   from jsonb_array_elements(c.payload -> 'products') p
                  where p ->> 'slug' = p_slug)
      end, '[]'::jsonb)
  )
  from pricing_config c
  order by c.published_at desc
  limit 1
$function$;

-- ---------------------------------------------------------------------------
-- The "from" price cache read sheet_sells straight out of the payload, so a v3
-- payload would have emptied it and taken the "from GBP x" off every landing
-- page. It now goes through the same expansion.
-- ---------------------------------------------------------------------------
create or replace function public.rebuild_from_prices_cache()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare n integer;
begin
  with cfg as (select payload from pricing_config order by published_at desc limit 1),
  prods as (
    select p ->> 'slug' as slug,
           case when coalesce((c.payload ->> 'schema_version')::int, 2) >= 3
                then pricing_expand(c.payload, p ->> 'slug')
                else p end as prod
    from cfg c, jsonb_array_elements(c.payload -> 'products') p
  ),
  rows as (
    select pr.slug,
           (r ->> 'qty')::int      as qty,
           (r ->> 'sell')::numeric as sell
    from prods pr, jsonb_array_elements(pr.prod -> 'sheet_sells') r
    where coalesce(r ->> 'fold', 'flat')    = 'flat'
      and coalesce(r ->> 'sides', 'single') = 'single'
  ),
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
