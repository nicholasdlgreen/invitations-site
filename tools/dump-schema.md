# Re-making `supabase/schema.sql`

`supabase/schema.sql` is a snapshot of the live database's structure. It is not
run by anything. It exists so the shape of Foreverprint lives in git rather than
only inside Supabase.

**Remake it whenever you change the database** — a new table, a new column, a
new policy, a new function. If you don't, the file quietly starts lying, which
is worse than not having it.

## How

Run each query below through the Supabase connector (or the SQL editor) and
paste the results into the matching section of `supabase/schema.sql`. Keep the
hand-written comments; they are the part a dump can't give you. Then update the
counts in the header and the date on line 1.

Read from `pg_catalog`, not `information_schema`. `information_schema` reports
every array column as the type `"ARRAY"`, which would make the file subtly
wrong — `text[]` and `integer[]` would both come out as nonsense.

## 1. Tables

```sql
select c.relname as tbl,
       string_agg(a.attname||' '||format_type(a.atttypid,a.atttypmod)
         || case when a.attnotnull then ' NOT NULL' else '' end
         || coalesce(' DEFAULT '||pg_get_expr(d.adbin,d.adrelid),''),
         E',\n  ' order by a.attnum) as cols
from pg_class c
join pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
where c.relkind='r'
group by c.relname order by c.relname;
```

## 2. Constraints — primary keys, unique, check, foreign keys

```sql
select 'ALTER TABLE public.'||c.relname||' ADD CONSTRAINT '||con.conname||' '
       ||pg_get_constraintdef(con.oid)||';' as ddl
from pg_constraint con
join pg_class c on c.oid=con.conrelid
join pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
order by case con.contype when 'p' then 1 when 'u' then 2 when 'c' then 3 else 4 end,
         c.relname, con.conname;
```

## 3. Indexes

Skips the ones Postgres created for a primary key or unique constraint, since
section 2 already covers those.

```sql
select indexdef||';' as ddl from pg_indexes
where schemaname='public'
  and indexname not in (select conname from pg_constraint where contype in ('p','u'))
order by tablename, indexname;
```

## 4. Row level security

First the enables, then a check for anything left unprotected:

```sql
select 'ALTER TABLE public.'||c.relname||' ENABLE ROW LEVEL SECURITY;' as ddl
from pg_class c join pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
where c.relkind='r' order by c.relname;
```

```sql
-- Should return only the tables you MEANT to leave with no way in.
select c.relname, c.relrowsecurity as rls,
  (select count(*) from pg_policy pol where pol.polrelid=c.oid) as policies
from pg_class c join pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
where c.relkind='r'
  and (not c.relrowsecurity
       or (select count(*) from pg_policy pol where pol.polrelid=c.oid)=0)
order by c.relname;
```

## 5. Policies

```sql
select 'CREATE POLICY '||quote_ident(p.policyname)||' ON public.'||p.tablename
  ||' AS '||p.permissive||' FOR '||p.cmd||' TO '||array_to_string(p.roles,', ')
  ||coalesce(' USING ('||p.qual||')','')
  ||coalesce(' WITH CHECK ('||p.with_check||')','')||';' as ddl
from pg_policies p where p.schemaname='public'
order by p.tablename, p.policyname;
```

## 6. Functions

```sql
select p.proname, pg_get_functiondef(p.oid)||';' as def
from pg_proc p join pg_namespace n on n.oid=p.pronamespace and n.nspname='public'
where p.prokind='f' order by p.proname;
```

## 7. Triggers

```sql
select pg_get_triggerdef(t.oid)||';' as ddl
from pg_trigger t join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
where not t.tgisinternal order by c.relname, t.tgname;
```

## 8. Storage parameters

Only `pricing_config` has any, and they are the reason Publish still works.

```sql
select c.relname, c.reloptions,
       (select t.reloptions from pg_class t where t.oid=c.reltoastrelid) as toast_opts
from pg_class c join pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
where c.relkind='r'
  and (c.reloptions is not null
       or (select t.reloptions from pg_class t where t.oid=c.reltoastrelid) is not null);
```

## 9. The header counts

```sql
select
 (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    and n.nspname='public' where c.relkind='r') as tables,
 (select count(*) from pg_policies where schemaname='public') as policies,
 (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    and n.nspname='public' where p.prokind='f') as functions,
 (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
  where not t.tgisinternal) as triggers,
 (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    and n.nspname='public' where c.relkind in ('v','m')) as views;
```

## What this does not cover

- **Data.** Nothing here backs up a single row. Supabase's daily backups do
  that, since the Pro upgrade on 27 September 2026.
- **Storage buckets** and their policies.
- **Auth** — users, providers, email templates.
- **Edge functions** and secrets. The site's server code is in
  `netlify/functions/`, and its environment variables are write-only in Netlify.
- **`supabase/migrations/`.** Those six files are still the history of how a few
  changes were made. They are not a way to rebuild the database and never were.
