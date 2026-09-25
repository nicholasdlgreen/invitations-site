-- ROLLBACK for studio_prompts_20260925.sql.
--
-- Restores the Design Studio prompt vocabulary exactly as it stood before
-- 2026-09-25: 654 chips across 19 products, 19 configs. Wholesale replace
-- rather than an inverse of each change, because that cannot drift — whatever
-- state the live tables are in afterwards, this puts them back.
--
-- The page code rolls back separately, with git revert of the commit that
-- added the Setting and Season chip groups. Either half is safe alone:
--   - data back, code forward  -> the two new rows find no chips and hide
--     themselves, and {setting}/{season} are simply absent from the templates.
--   - code back, data forward  -> the extra chips are never rendered, and the
--     unreplaced {setting}/{season} placeholders would show literally in the
--     brief. So if you roll back only one, roll back the DATA.
--
-- Verify the backups are still there before running:
--   select count(*) from studio_prompt_options_backup_20260925;  -- expect 654
--   select count(*) from studio_config_backup_20260925;          -- expect 19

begin;

delete from studio_prompt_options;
insert into studio_prompt_options select * from studio_prompt_options_backup_20260925;

delete from studio_config;
insert into studio_config select * from studio_config_backup_20260925;

commit;

-- Confirm: both should come back 0.
-- select count(*) from (
--   select * from studio_prompt_options
--   except select * from studio_prompt_options_backup_20260925) d;
-- select count(*) from (
--   select * from studio_config
--   except select * from studio_config_backup_20260925) d;
