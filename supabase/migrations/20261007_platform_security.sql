-- 7 October 2026 — platform security review
--
-- Prompted by Supabase's "publicly accessible tables" warning. The warning
-- reports what is GRANTED, not what is readable: of the 44 tables it listed,
-- every one holding customer or business data already returned 0 rows to the
-- public anon key, because the RLS model is sound. is_admin() is correctly
-- written and returns false for anonymous; user tables key on auth.uid().
--
-- What was actually open is below. Applied as four migrations through the
-- Supabase API on 7 October; collected here so the repo records them.
-- NOT included here, still open and awaiting a decision: _rate_rows and
-- _fin_rows, which hold the supplier cost base with RLS switched off.

-- ── 1. SECURITY DEFINER functions callable by anyone ──────────────────
-- upsert_contact_from_order writes to contacts with whatever email, name and
-- consent flag the caller supplies, so marketing consent could be forged for
-- an address that never gave it. bump_rate_limit increments a counter for any
-- bucket name, and the buckets are keyed by IP -- so the rate limiter could be
-- turned against another visitor. The two cache rebuilds are expensive and
-- could have been run in a loop.
--
-- The first attempt revoked from anon and authenticated only, and that did
-- NOTHING: Postgres grants EXECUTE to PUBLIC by default and anon inherits it.
-- Tested with the live anon key afterwards and both still worked -- the
-- contact upsert returned 204 and wrote a row. Revoke from PUBLIC, then grant
-- back to service_role, which is what every real caller uses.
revoke execute on function public.upsert_contact_from_order(text, text, boolean, text, text, numeric, text[]) from public, anon, authenticated;
revoke execute on function public.bump_rate_limit(text, integer)                                              from public, anon, authenticated;
revoke execute on function public.rebuild_from_prices_cache()                                                 from public, anon, authenticated;
revoke execute on function public.pricing_config_refresh_cache()                                              from public, anon, authenticated;
grant  execute on function public.upsert_contact_from_order(text, text, boolean, text, text, numeric, text[]) to service_role;
grant  execute on function public.bump_rate_limit(text, integer)                                              to service_role;
grant  execute on function public.rebuild_from_prices_cache()                                                 to service_role;
grant  execute on function public.pricing_config_refresh_cache()                                              to service_role;

-- ── 2. Functions without a fixed search_path ──────────────────────────
alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.safe_jsonb(text) set search_path = public, pg_temp;

-- ── 3. Superseded snapshots, locked rather than dropped ───────────────
-- The brief was to delete these. They were reported as empty, from
-- pg_stat_user_tables.n_live_tup, which is a planner ESTIMATE and was stale.
-- The real counts: 1,340 / 378 / 22 / 1,082 rows. They are rollback points,
-- including for the folded-400 rate correction. Locking removes the exposure,
-- which was the problem; dropping stays one statement away.
revoke all on public.sheet_rates_backup_20260924            from anon, authenticated;
revoke all on public.sheet_rates_backup_folded400_20260926  from anon, authenticated;
revoke all on public.studio_config_pre_20260929             from anon, authenticated;
revoke all on public.studio_prompt_options_pre_20260929     from anon, authenticated;
alter table public.sheet_rates_backup_20260924            enable row level security;
alter table public.sheet_rates_backup_folded400_20260926  enable row level security;
alter table public.studio_config_pre_20260929             enable row level security;
alter table public.studio_prompt_options_pre_20260929     enable row level security;
drop policy if exists studio_config_pre_20260929_admin_only         on public.studio_config_pre_20260929;
drop policy if exists studio_prompt_options_pre_20260929_admin_only on public.studio_prompt_options_pre_20260929;

-- ── 4. Storage ────────────────────────────────────────────────────────
-- album-photos carried the worst policy on the project: DELETE granted to the
-- PUBLIC role, so any visitor could delete anything in it, with a matching
-- public INSERT. Wedding albums were withdrawn on 6 October and its six files
-- are development uploads from 10 May. The files and the bucket row need the
-- Storage API (Postgres refuses a direct delete), so that is a dashboard step;
-- with no policies and public = false there is no route to them meanwhile.
drop policy if exists "Allow public deletes 1mxbugk_0" on storage.objects;
drop policy if exists "Allow public deletes 1mxbugk_1" on storage.objects;
drop policy if exists "Allow public reads 1mxbugk_0"   on storage.objects;
drop policy if exists "Allow public uploads 1mxbugk_0" on storage.objects;
update storage.buckets set public = false where id = 'album-photos';

-- artwork accepted ANY file type from any visitor, up to 50MB, into a public
-- bucket -- there is already a text/plain file among the 98 PDFs and 40
-- images. A partial control: .ai and .indd arrive as application/octet-stream
-- so that has to stay allowed, but text, HTML, scripts, video and archives are
-- now refused. Retention is the control that actually bounds this.
update storage.buckets
   set allowed_mime_types = array['application/pdf','image/jpeg','image/png',
                                  'image/tiff','image/webp',
                                  'application/postscript','application/octet-stream']
 where id = 'artwork';
