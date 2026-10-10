-- URGENT FIX, 10 October 2026. pricing_expand took 41 SECONDS per product
-- against the real stored catalogue, against a statement_timeout of 8s. Every
-- product page broke the moment the deduped catalogue was published, and the
-- site could not price anything until this went in. Live again at 413 ms.
--
-- WHY IT WAS NOT CAUGHT, WHICH IS THE PART WORTH REMEMBERING.
--
-- It was measured against a payload held in a MATERIALIZED CTE: already
-- parsed, already in memory. There it ran in about 125 ms per product, and
-- that number was believed. A payload read from the table is TOASTed, and
-- these two expressions sat in the WHERE clause, evaluated once PER RATE ROW,
-- 8,418 times per call:
--
--     coalesce(jsonb_array_length(p_payload -> 'paper_weights' -> s.paper), 0) = 0
--     or (p_payload -> 'paper_weights' -> s.paper) @> to_jsonb(s.gsm)
--
-- Each evaluation detoasts and re-parses 1.4 MB. That is the whole distance
-- between 125 ms and 41 seconds, and no amount of testing against an
-- in-memory copy could ever have shown it.
--
-- MEASURE AGAINST THE STORED ROW, NOT A COPY OF IT. The same mistake in
-- miniature had already been made that morning in a verification query, and
-- fixed there -- by pulling paper_weights into a CTE -- without the fix being
-- carried back into the function the query was checking.
--
-- Every reference to p_payload is now in its own MATERIALIZED CTE, so the
-- document is parsed once per call. Verified afterwards across all 36
-- products in six batches: 152,620 prices, identical values, identical order.

create or replace function public.pricing_expand(p_payload jsonb, p_slug text)
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
with prod as materialized (
  select p from jsonb_array_elements(p_payload -> 'products') p
  where p ->> 'slug' = p_slug
  limit 1
),
m as materialized (
  select coalesce((select (p ->> 'margin_pct')::numeric from prod), 0) / 100 + 1 as mult
),
f as materialized (
  select (select p -> 'routes' from prod)                                        as routes,
         (select coalesce(p -> 'available_papers',  '[]'::jsonb) from prod)      as papers,
         (select coalesce(p -> 'available_sizes',   '[]'::jsonb) from prod)      as sizes,
         (select coalesce(p -> 'available_finishes','[]'::jsonb) from prod)      as finishes,
         (select coalesce((p ->> 'sides_offered')::boolean, false) from prod)    as sides_offered,
         (select coalesce((p ->> 'envelopes_offered')::boolean, true) from prod) as envelopes_offered
),
route as materialized (
  select (ord - 1)::int                  as rt,
         r ->> 'family'                  as family,
         coalesce(r ->> 'fold', 'flat')  as fold,
         case when jsonb_typeof(r -> 'papers') = 'array'
                   and jsonb_array_length(r -> 'papers') > 0
              then r -> 'papers' end     as only_papers
  from f, lateral jsonb_array_elements(f.routes) with ordinality t(r, ord)
),
-- Parsed ONCE. This is the line that cost 41 seconds when it was inline.
pw as materialized (
  select k as paper, v as weights
  from jsonb_each(coalesce(p_payload -> 'paper_weights', '{}'::jsonb)) t(k, v)
),
rates as materialized (
  select (r ->> 'family') family, (r ->> 'paper') paper,
         nullif(r ->> 'gsm','')::int gsm, (r ->> 'size') size,
         coalesce(r ->> 'sides','single') sides, (r ->> 'qty')::int qty,
         (r ->> 'cost')::numeric cost, ord
  from jsonb_array_elements(coalesce(p_payload -> 'rate_sets','[]'::jsonb)) with ordinality t(r, ord)
),
fsets as materialized (
  select (r ->> 'family') family, (r ->> 'finish') finish, (r ->> 'option') option,
         (r ->> 'sides') sides, (r ->> 'size') size, (r ->> 'qty')::int qty,
         (r ->> 'cost')::numeric cost, ord
  from jsonb_array_elements(coalesce(p_payload -> 'finish_sets','[]'::jsonb)) with ordinality t(r, ord)
),
sheet as (
  select rt.fold, rt.rt, s.sides, s.paper, s.gsm, s.size, s.qty, s.ord,
         -- trim_scale reproduces the publisher's parseFloat(x.toFixed(2)):
         -- round(39.2, 2) would otherwise serialise as 39.20 where the old
         -- catalogue held 39.2. Same number, but it broke every comparison.
         trim_scale(round(s.cost * (select mult from m), 2)) as sell
  from rates s
  cross join f
  join lateral (
    select rr.rt, rr.fold from route rr
    where rr.family = s.family
      and (rr.only_papers is null or rr.only_papers ? s.paper)
    order by rr.rt limit 1
  ) rt on true
  left join pw on pw.paper = s.paper
  where (s.sides = 'single' or f.sides_offered)
    and f.papers ? s.paper
    and f.sizes  ? s.size
    -- A paper with no weights recorded filters nothing, as in the publisher.
    and (pw.weights is null
         or jsonb_array_length(pw.weights) = 0
         or pw.weights @> to_jsonb(s.gsm))
),
-- The no-backward-steps flattening, after the margin and the rounding --
-- exactly where admin.html applied it, so the question of whether the two
-- commute never has to be answered.
flat as (
  select fold, rt, sides, paper, gsm, size, qty, ord,
         min(sell) over (partition by paper, gsm, size, fold, sides
                         order by qty desc
                         rows between unbounded preceding and current row) as sell
  from sheet
),
finishes as (
  select fr.family, fr.finish, fr.option, fr.sides, fr.size, fr.qty, fr.ord,
         trim_scale(round(fr.cost * (select mult from m), 2)) as sell
  from fsets fr
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
