-- Undo tools/sql/studio_vocab_20260929.sql, putting the seven-category
-- vocabulary and the {mood}/{style} templates back exactly as they were.
-- Only works while the _pre_20260929 backup tables still exist.
begin;
delete from studio_prompt_options;
insert into studio_prompt_options select * from studio_prompt_options_pre_20260929;
update studio_config c set base_prompt = b.base_prompt
  from studio_config_pre_20260929 b where b.product_slug = c.product_slug;
commit;
-- then, once the page is back on the old markup:
-- drop table studio_prompt_options_pre_20260929;
-- drop table studio_config_pre_20260929;
