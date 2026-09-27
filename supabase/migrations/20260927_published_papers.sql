-- The published paper catalogue on its own: name, tier, weights and which
-- finishes each stock can physically take. About 7KB.
--
-- The landing page needed exactly this and one "from" price, and was fetching
-- pricing_for to get them — 571KB, because that carries 3,738 sheet prices and
-- 1,008 finishing prices for the configurator. Nothing on the landing page
-- reads either array. The price now comes from from_prices(), which the
-- products grid already uses, so the two pages cannot drift apart.
--
-- No costs here: the payload's papers array is the customer-facing catalogue.
create or replace function public.published_papers()
returns jsonb
language sql
stable
set search_path to 'public'
as $$
  select coalesce(c.payload -> 'papers', '[]'::jsonb)
  from pricing_config c
  order by c.published_at desc
  limit 1
$$;

revoke all on function public.published_papers() from public;
grant execute on function public.published_papers() to anon, authenticated;
