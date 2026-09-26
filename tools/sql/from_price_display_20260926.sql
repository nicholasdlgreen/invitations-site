-- ============================================================================
-- From-price display: quote a pack, not a single card
-- 2026-09-26
-- ============================================================================
--
-- WHY
--
-- from_prices() returned the single lowest sell figure anywhere in a product's
-- published price list. Because we hold rates down to a quantity of one, the
-- winning row was always quantity 1 — so the grid said "From £18" for a
-- wedding invitation and "From £30" for a Christmas card, and both were the
-- price of ONE card.
--
-- That is the least flattering reading of a price that is almost entirely
-- setup. One invitation and ten invitations both cost £17.60; five hundred
-- cost £39.20. Quoting the setup fee against a single card made us look
-- roughly seventeen times dearer than we are.
--
-- Papier, Vistaprint and printed.com were all checked. None of them quotes a
-- quantity of one: Papier's ladder starts at 10 and its headline is
-- "£210.00 for 100"; Vistaprint prints "From £0.63 each" directly above
-- "100 units" and "Incl. VAT"; printed.com starts at 10 and labels its price
-- "(ex VAT)". Two lessons taken from them — always name the quantity the
-- price belongs to, and say what VAT is doing.
--
-- WHAT THIS DOES
--
--   1. product_types.display_quantity — the quantity the grid quotes for.
--   2. from_prices() — returns the cheapest price AT that quantity, VAT
--      included, alongside the quantity itself so the page can print
--      "From £22 for 50".
--
-- The basis is deliberately narrow: flat, single sided, cheapest paper, size
-- and weight. That is the cheapest spec a customer can actually reach, which
-- is what "from" has to mean. (Products sold only as folded cards — Christmas,
-- Greeting, Engagement, Graduation, Thank You — record their one format as
-- 'flat' in the payload, so they are covered by the same filter.)
--
-- ROLLBACK is at the bottom of this file.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. The quantity each product quotes for
-- ---------------------------------------------------------------------------
alter table product_types add column if not exists display_quantity integer;

comment on column product_types.display_quantity is
 'The quantity the grid "from" price is quoted for. Our prices are almost all setup, so one card and ten cost the same and a from-price at quantity 1 read as seventeen times dearer than we are. Agreed 2026-09-26: wedding stationery 50, other invitations 25, cards you send 10, signs 1.';

-- Wedding stationery: ordered per household, so fifty is the realistic order
-- for a hundred-guest wedding. A hundred costs only a pound more, so raising
-- the anchor is nearly free — fifty is chosen because it is the truthful one.
update product_types set display_quantity = 50
 where slug in ('wedding-invitations','save-the-dates','rsvp-cards','menu-cards',
                'place-cards','table-numbers','order-of-service');

-- Other invitations: nobody sends fifty birthday invitations, but ten looked
-- thin against the rest of the grid.
update product_types set display_quantity = 25
 where slug in ('invitations','birthday-invitations','party-invitations',
                'engagement-party-invitations','baby-shower-invitations',
                'christening-invitations');

-- Cards you send one at a time.
update product_types set display_quantity = 10
 where slug in ('christmas-cards','greeting-cards','engagement-cards',
                'graduation-cards','thank-you-cards','new-arrival-cards',
                'moving-cards');

-- A table plan is bought singly. The page prints "each" rather than "for 1".
update product_types set display_quantity = 1
 where slug in ('table-plans','welcome-signs','signage');


-- ---------------------------------------------------------------------------
-- 2. from_prices()
-- ---------------------------------------------------------------------------
-- Returns one row per product: the VAT-inclusive price of display_quantity
-- units on the cheapest spec, and the quantity itself.
--
-- If a product has no rate at exactly display_quantity we take the nearest
-- quantity at or above it, and failing that the largest we hold — so a
-- product can never drop off the grid because of a missing rung. The quantity
-- returned is the one actually priced, never the one we wished for, because
-- the page prints it next to the money.
create or replace function public.from_prices()
returns table(slug text, from_price numeric, display_quantity integer)
language sql
stable
set search_path to 'public'
as $function$
  with vat as (
    select coalesce((data ->> 'vatRate')::numeric, 0.20) as rate
    from site_config where id = 'pricing'
  ),
  rows as (
    select prod ->> 'slug'            as slug,
           (r ->> 'qty')::int         as qty,
           (r ->> 'sell')::numeric    as sell
    from (select payload from pricing_config order by published_at desc limit 1) c,
         jsonb_array_elements(c.payload -> 'products') prod,
         jsonb_array_elements(prod -> 'sheet_sells') r
    where coalesce(r ->> 'fold', 'flat')   = 'flat'
      and coalesce(r ->> 'sides', 'single') = 'single'
  ),
  cheapest as (
    select slug, qty, min(sell) as sell
    from rows group by slug, qty
  ),
  want as (
    select pt.slug, coalesce(pt.display_quantity, 1) as target
    from product_types pt where pt.active
  ),
  picked as (
    select w.slug, c.qty, c.sell,
           row_number() over (
             partition by w.slug
             -- Prefer a rung at or above the target, nearest first; only then
             -- fall back to the biggest rung below it.
             order by (c.qty >= w.target) desc,
                      case when c.qty >= w.target then c.qty - w.target
                                                  else w.target - c.qty end
           ) as rn
    from want w join cheapest c on c.slug = w.slug
  )
  select p.slug,
         round(p.sell * (1 + v.rate), 2) as from_price,
         p.qty                           as display_quantity
  from picked p cross join vat v
  where p.rn = 1
$function$;

grant execute on function public.from_prices() to anon, authenticated;


-- ---------------------------------------------------------------------------
-- CHECK
-- ---------------------------------------------------------------------------
-- Run this after publishing from admin. Expect wedding invitations at 50,
-- Christmas cards at 10, table plans at 1, and no product missing.
--
--   select f.slug, f.display_quantity, f.from_price, pt.display_quantity as wanted
--   from from_prices() f
--   join product_types pt on pt.slug = f.slug
--   order by f.from_price desc;


-- ---------------------------------------------------------------------------
-- ROLLBACK
-- ---------------------------------------------------------------------------
-- Restores the old one-number-per-product behaviour. The column is left in
-- place because dropping it loses the agreed quantities for nothing.
--
--   create or replace function public.from_prices()
--   returns table(slug text, from_price numeric)
--   language sql stable set search_path to 'public' as $$
--     select prod ->> 'slug', min((r ->> 'sell')::numeric)
--     from (select payload from pricing_config order by published_at desc limit 1) c,
--          jsonb_array_elements(c.payload -> 'products') prod,
--          jsonb_array_elements(prod -> 'sheet_sells') r
--     group by prod ->> 'slug'
--   $$;
--
-- And to bring folded 400gsm back (see the separate note on that change):
--   update sheet_rates set active = true
--    where supplier_family = 'folded-card' and weight_gsm = 400;
