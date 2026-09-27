-- Publish started failing on 27 September with "canceling statement due to
-- statement timeout" (57014) and HTTP 500. Nothing had changed in the data —
-- the same 8,481 sheet rates were read before the publish that worked at 15:55
-- and before the three that failed at 16:43, 16:44 and 16:45.
--
-- What changed was bloat.
--
-- The catalogue is published as ONE jsonb value: 10MB of JSON, 69,887 sheet
-- prices and 14,700 finishing prices across 22 products. That does not fit in a
-- page, so Postgres stores it out of line in a TOAST table, as about 717
-- chunks. Every publish writes 717 NEW chunks and leaves the previous 717 as
-- dead rows. Publish several times in an afternoon and the TOAST table is
-- mostly dead weight — it reached 2,151 dead against 717 live — and every read
-- and write of the payload has to walk past it.
--
-- Measured on the live instance:
--
--     publish write, bloated      9,971 ms    over the 8s limit, always fails
--     publish write, vacuumed     1,165 ms    15% of the limit
--
-- The `authenticated` role has statement_timeout = 8s, so once the write
-- crossed eight seconds Publish could never succeed again, and would not have
-- recovered on its own until autovacuum happened to catch up.
--
-- Autovacuum's defaults are written for tables that are appended to, not for a
-- single row whose entire ten megabytes are replaced each time. It waits for
-- dead rows to reach 20% of the table and then throttles itself. For this table
-- that is far too patient. These settings tell it to clean this one table after
-- essentially every publish, and not to throttle while it does.
--
-- This is a mitigation, not a cure. The cure is for the payload not to be 10MB
-- (see docs/STATUS.md) — this keeps publishing reliable until that is decided.

alter table public.pricing_config set (
  autovacuum_vacuum_threshold          = 1,
  autovacuum_vacuum_scale_factor       = 0,
  autovacuum_vacuum_cost_delay         = 0,
  autovacuum_analyze_threshold         = 1,
  autovacuum_analyze_scale_factor      = 0,
  -- The heap here is one row; the bloat is all in TOAST, so it needs saying
  -- twice. Without the toast.* half of this, the setting above would tidy a
  -- 40kB table and leave the 7MB one alone.
  toast.autovacuum_vacuum_threshold    = 1,
  toast.autovacuum_vacuum_scale_factor = 0,
  toast.autovacuum_vacuum_cost_delay   = 0
);
