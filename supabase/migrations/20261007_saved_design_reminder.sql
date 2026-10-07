-- docs/CRM.md W4. The single send-once guard for the "you saved a design and
-- have not ordered" reminder, the same shape as orders.review_email_sent_at:
-- one column, set the moment the email goes, so a redeploy, a retry or a
-- second schedule can never email the same person about the same design twice.
alter table public.saved_designs
  add column if not exists reminder_sent_at timestamptz;
comment on column public.saved_designs.reminder_sent_at is
  'Set when the W4 "still here" reminder was sent for this design. Null means never sent. See netlify/functions/saved-design-reminder.js';
create index if not exists saved_designs_reminder_idx
  on public.saved_designs (reminder_sent_at, created_at);
