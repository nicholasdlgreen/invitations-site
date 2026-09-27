-- Stop from_prices() reading 8.6MB on every page view.
--
-- What it does today, per call:
--
--     jsonb_array_elements(payload -> 'products')      -- 23 products
--     jsonb_array_elements(prod -> 'sheet_sells')      -- ~56,600 rows
--
-- It parses the whole published payload and materialises every sheet price in
-- the catalogue, then groups, joins and windows over them — to return 23 rows
-- that only change when someone presses Publish.
--
-- That was tolerable while only /products called it. On 27 September the 23
-- landing pages were pointed at it too, to get them off a 571KB download. The
-- download went away and the work moved into Postgres, multiplied by every
-- landing page view. Within hours the instance was wedged. Cause not proven —
-- the database was unreachable by then, so the logs could not be read — but it
-- is the obvious suspect and this removes it either way.
--
-- The fix is the shape of the work, not the speed of it: compute once per
-- publish instead of once per request.

create table if not exists public.from_prices_cache (
  slug             text primary key,
  net_price        numeric not null,     -- before VAT; VAT is applied on read
  display_quantity integer not null,
  updated_at       timestamptz not null default now()
);

alter table public.from_prices_cache enable row level security;

drop policy if exists from_prices_cache_public_read on public.from_prices_cache;
create policy from_prices_cache_public_read
  on public.from_prices_cache for select to public using (true);

drop policy if exists from_prices_cache_admin_write on public.from_prices_cache;
create policy from_prices_cache_admin_write
  on public.from_prices_cache for all to public
  using (is_admin()) with check (is_admin());

-- The expensive computation, lifted out unchanged and given a name. This is the
-- ONLY place the payload is unnested, and it now runs once per publish.
--
-- VAT is deliberately NOT baked in. It is a business state that can change
-- without a publish, so the cache holds the net figure and from_prices()
-- applies the rate on the way out — one row from site_config, not a scan.
create or replace function public.rebuild_from_prices_cache()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare n integer;
begin
  with rows as (
    select prod ->> 'slug'         as slug,
           (r ->> 'qty')::int      as qty,
           (r ->> 'sell')::numeric as sell
    from (select payload from pricing_config order by published_at desc limit 1) c,
         jsonb_array_elements(c.payload -> 'products') prod,
         jsonb_array_elements(prod -> 'sheet_sells') r
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

  -- A product that has gone away, or been switched off, must not keep quoting.
  delete from from_prices_cache c
   where not exists (select 1 from product_types pt
                      where pt.slug = c.slug and pt.active);
  return n;
end;
$$;

-- Rebuilt whenever a catalogue is published, so the cache cannot drift. Doing
-- it here rather than in admin means it does not matter which client publishes,
-- or whether someone writes pricing_config by hand.
create or replace function public.pricing_config_refresh_cache()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform rebuild_from_prices_cache();
  return null;
end;
$$;

drop trigger if exists pricing_config_from_prices on public.pricing_config;
create trigger pricing_config_from_prices
  after insert or update on public.pricing_config
  for each statement execute function public.pricing_config_refresh_cache();

-- And the function the site actually calls becomes a read of 23 rows.
--
-- It falls back to the old computation if the cache is empty, so a database
-- that has not published since this landed still shows prices — slowly, once,
-- rather than not at all. The migration populates it below, so that path
-- should never be taken.
create or replace function public.from_prices()
returns table(slug text, from_price numeric, display_quantity integer, vat_included boolean)
language sql
stable
set search_path to 'public'
as $$
  with vat as (
    select coalesce((data ->> 'vatRegistered')::boolean, false) as registered,
           coalesce((data ->> 'vatRate')::numeric, 0)           as rate
    from site_config where id = 'pricing'
  ),
  cached as (
    select c.slug, c.net_price, c.display_quantity from from_prices_cache c
  ),
  fallback as (
    select p.slug, p.sell as net_price, p.qty as display_quantity
    from (
      select w.slug, c2.qty, c2.sell,
             row_number() over (partition by w.slug
               order by (c2.qty >= w.target) desc,
                        case when c2.qty >= w.target then c2.qty - w.target
                                                     else w.target - c2.qty end) as rn
      from (select pt.slug, coalesce(pt.display_quantity,1) as target
              from product_types pt where pt.active) w
      join (select prod ->> 'slug' as slug, (r ->> 'qty')::int as qty, min((r ->> 'sell')::numeric) as sell
              from (select payload from pricing_config order by published_at desc limit 1) c3,
                   jsonb_array_elements(c3.payload -> 'products') prod,
                   jsonb_array_elements(prod -> 'sheet_sells') r
             where coalesce(r ->> 'fold','flat') = 'flat'
               and coalesce(r ->> 'sides','single') = 'single'
             group by 1, 2) c2 on c2.slug = w.slug
    ) p
    where p.rn = 1 and not exists (select 1 from from_prices_cache)
  ),
  src as (select * from cached union all select * from fallback)
  select s.slug,
         round(s.net_price * (1 + case when v.registered then v.rate else 0 end), 2) as from_price,
         s.display_quantity,
         v.registered as vat_included
  from src s cross join vat v;
$$;

revoke all on function public.rebuild_from_prices_cache() from public;
grant execute on function public.rebuild_from_prices_cache() to authenticated;

-- Populate it once, now, so the fallback is never reached.
select public.rebuild_from_prices_cache();
