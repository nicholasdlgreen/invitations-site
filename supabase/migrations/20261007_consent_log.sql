-- See docs/CRM.md W8. Counts how many visitors accept cookies and how many
-- decline, because we do not know, and it decides whether a Google remarketing
-- audience can ever reach its 100-user minimum and how much of our own
-- analytics we are actually seeing.
--
-- Deliberately anonymous: one row saying a visitor chose this, at this time.
-- No session, no IP, no user agent, nothing joinable to anything. Someone who
-- declines is telling us not to track them, and the accept RATE answers the
-- question without tracking anybody. tools/test-consent-log.js fails if an
-- identifier is ever added to the payload.
--
-- No SECURITY DEFINER function: four anon-callable ones were closed on
-- 7 October and the right pattern here is a plain insert-only table with RLS,
-- the same shape studio_events already uses.
create table if not exists public.consent_log (
  id         bigint generated always as identity primary key,
  choice     text not null check (choice in ('granted','denied')),
  created_at timestamptz not null default now()
);
create index if not exists consent_log_created_at_idx on public.consent_log (created_at);
alter table public.consent_log enable row level security;
drop policy if exists consent_log_insert on public.consent_log;
create policy consent_log_insert on public.consent_log
  for insert to anon, authenticated
  with check (choice in ('granted','denied'));
revoke select, update, delete on public.consent_log from anon, authenticated;
grant insert on public.consent_log to anon, authenticated;
