-- Foreverprint — public schema, as it stands on 29 September 2026
--
-- WHY THIS FILE EXISTS
--
-- 61 migrations have been applied to this database. Six migration files exist
-- in supabase/migrations/, and even those were applied through the Supabase
-- connector rather than the CLI, so their filenames do not match the versions
-- Postgres recorded. The repo was therefore not a record of the schema: if the
-- database were lost, supabase/migrations/ would rebuild almost none of it.
--
-- Daily backups have covered the DATA since the Pro upgrade on 27 September.
-- This covers the STRUCTURE, and does it in a form you can read in a diff.
--
-- HOW IT WAS MADE, AND HOW TO REMAKE IT
--
-- Read out of pg_catalog through the Supabase connector — not by hand, so the
-- types are the real ones (information_schema reports every array as "ARRAY",
-- which would have made this file subtly wrong and worse than useless).
-- tools/dump-schema.md holds the queries; re-run them and replace this file.
--
-- WHAT IT IS NOT
--
-- Not a migration, not run by anything, and no substitute for a backup. It
-- holds no data. Applying it to an empty database would give you the shape of
-- Foreverprint and none of its 78,431 published prices.
--
-- Counts at the time of writing: 40 tables, all with row level security,
-- 63 policies, 14 functions, 3 triggers, 0 views.


-- ═══════════════════════════════════════════════════════════════════════════
-- TABLES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid NOT NULL,
  email text,
  name text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id text NOT NULL,
  title text NOT NULL,
  status text DEFAULT 'draft'::text,
  keyword text DEFAULT ''::text,
  tags text[] DEFAULT '{}'::text[],
  excerpt text DEFAULT ''::text,
  body text DEFAULT ''::text,
  date date,
  read_time text DEFAULT ''::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contacts (
  email text NOT NULL,
  name text,
  marketing_consent boolean DEFAULT false,
  consent_text text,
  consent_at timestamp with time zone,
  consent_source text,
  unsubscribed_at timestamp with time zone,
  orders_count integer DEFAULT 0,
  total_spent numeric(12,2) DEFAULT 0,
  first_order_at timestamp with time zone,
  last_order_at timestamp with time zone,
  last_products text[],
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  unsubscribe_token uuid DEFAULT gen_random_uuid(),
  welcome_sent_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.delivery_options (
  id text NOT NULL,
  name text NOT NULL,
  blurb text,
  production_days integer NOT NULL,
  delivery_days integer NOT NULL DEFAULT 1,
  cutoff_hour integer,
  price numeric(10,2) DEFAULT 0,
  surcharge_pct numeric(5,2) DEFAULT 0,
  surcharge_min numeric(10,2) DEFAULT 0,
  max_order_value numeric(10,2),
  display_order integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.discount_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  description text,
  type text NOT NULL,
  value numeric(10,2) NOT NULL DEFAULT 0,
  min_order_value numeric(10,2),
  starts_at timestamp with time zone,
  expires_at timestamp with time zone,
  max_uses integer,
  max_uses_per_email integer,
  used_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  first_order_only boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.discount_redemptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code_id uuid,
  code text NOT NULL,
  order_id uuid,
  order_number text,
  email text,
  discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.docs_index (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text,
  url text,
  location text,
  body text,
  display_order integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.envelopes (
  id text NOT NULL,
  name text NOT NULL,
  hex_color text NOT NULL,
  border_color text,
  price_each numeric(10,2) NOT NULL,
  display_order integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expense_categories (
  id text NOT NULL,
  name text NOT NULL,
  kind text NOT NULL,
  help text,
  display_order integer DEFAULT 0,
  active boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  spent_on date NOT NULL,
  payee text,
  category_id text,
  description text,
  net numeric(12,2) NOT NULL DEFAULT 0,
  vat numeric(12,2) NOT NULL DEFAULT 0,
  gross numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text,
  recurring_id uuid,
  receipt_url text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finish_options (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cost_modifier numeric NOT NULL DEFAULT 0,
  display_order integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finish_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  supplier_family text NOT NULL,
  finish_name text NOT NULL,
  option_name text NOT NULL,
  applies_to text NOT NULL DEFAULT 'front'::text,
  size text NOT NULL,
  quantity integer NOT NULL,
  cost numeric(10,2) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finish_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_luxe boolean DEFAULT false,
  display_order integer DEFAULT 0,
  active boolean DEFAULT true,
  options jsonb DEFAULT '[]'::jsonb,
  detail text
);

CREATE TABLE IF NOT EXISTS public.from_prices_cache (
  slug text NOT NULL,
  net_price numeric NOT NULL,
  display_quantity integer NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.generated_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  spec_id uuid NOT NULL,
  qty integer NOT NULL,
  cost numeric(10,2) NOT NULL,
  sell_price numeric(10,2) NOT NULL,
  gross_profit numeric(10,2),
  margin numeric(5,2),
  generated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.guides (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  title text NOT NULL,
  meta_title text,
  meta_description text,
  intro text,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  faqs jsonb NOT NULL DEFAULT '[]'::jsonb,
  related_products text[] NOT NULL DEFAULT '{}'::text[],
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  hero_image text
);

CREATE TABLE IF NOT EXISTS public.monthly_accounts (
  month date NOT NULL,
  revenue_net numeric(12,2) DEFAULT 0,
  revenue_gross numeric(12,2) DEFAULT 0,
  orders_count integer DEFAULT 0,
  cogs_total numeric(12,2) DEFAULT 0,
  overhead_total numeric(12,2) DEFAULT 0,
  adjustments numeric(12,2) DEFAULT 0,
  notes text,
  locked boolean DEFAULT false,
  locked_at timestamp with time zone,
  snapshot jsonb,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_number text NOT NULL,
  customer_name text DEFAULT ''::text,
  customer_email text DEFAULT ''::text,
  items jsonb DEFAULT '[]'::jsonb,
  paper text DEFAULT ''::text,
  envelope text DEFAULT ''::text,
  delivery text DEFAULT ''::text,
  subtotal numeric(10,2) DEFAULT 0,
  vat numeric(10,2) DEFAULT 0,
  total numeric(10,2) DEFAULT 0,
  status text DEFAULT 'new'::text,
  dpd_tracking text DEFAULT ''::text,
  notes text DEFAULT ''::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  customer_phone text DEFAULT ''::text,
  delivery_address text DEFAULT ''::text,
  artwork_url text DEFAULT ''::text,
  stripe_session_id text DEFAULT ''::text,
  stripe_payment_intent text DEFAULT ''::text,
  job_ticket_sent boolean DEFAULT false,
  proof_sent boolean DEFAULT false,
  print_ready_url text,
  marketing_consent boolean DEFAULT false,
  marketing_consent_text text,
  marketing_consent_at timestamp with time zone,
  carrier text,
  dispatched_at timestamp with time zone,
  dispatch_email_sent_at timestamp with time zone,
  attribution jsonb,
  gclid text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  landing_page text,
  discount_code text,
  discount_amount numeric(10,2),
  subtotal_before_discount numeric(10,2),
  event_date date,
  delivered_at timestamp with time zone,
  review_email_sent_at timestamp with time zone,
  photo_email_sent_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.paper_stocks (
  id text NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subtitle text,
  price_extra numeric(10,2) DEFAULT 0,
  display_order integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  cost_modifier numeric DEFAULT 0,
  description text,
  finish_label text,
  weights jsonb DEFAULT '[]'::jsonb,
  supplier_product text,
  finishes text[] DEFAULT '{}'::text[],
  image_url text,
  tier text,
  pe_stock text,
  pe_product_overrides jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.pricing (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_type text NOT NULL,
  size text,
  paper_type text,
  paper_weight text,
  finish text DEFAULT 'None'::text,
  quantity integer NOT NULL,
  cost numeric(10,2),
  sell_price numeric(10,2) NOT NULL,
  margin_pct numeric(5,2),
  supplier_id text,
  active boolean DEFAULT true,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pricing_config (
  id text NOT NULL DEFAULT 'singleton'::text,
  payload jsonb NOT NULL,
  published_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.print_sizes (
  id text NOT NULL,
  name text NOT NULL,
  width_mm numeric NOT NULL,
  height_mm numeric NOT NULL,
  category text NOT NULL DEFAULT 'card'::text,
  printer_preset boolean DEFAULT true,
  note text,
  display_order integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  badge text
);

CREATE TABLE IF NOT EXISTS public.product_specs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_type text NOT NULL,
  size text NOT NULL,
  supplier_id uuid,
  paper_type text,
  paper_weight text,
  print_side text DEFAULT 'Single'::text,
  finish text DEFAULT 'None'::text,
  supplier_ref text,
  currency text DEFAULT 'GBP'::text,
  lead_time text,
  setup_cost numeric(10,2) DEFAULT 0,
  packaging_cost numeric(10,2) DEFAULT 1.50,
  design_cost numeric(10,2) DEFAULT 0,
  qty_costs jsonb DEFAULT '{}'::jsonb,
  notes text,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  tagline text,
  description text,
  features text,
  hero_image_url text,
  meta_title text,
  meta_description text,
  from_price_text text,
  display_order integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  available_sizes text[] DEFAULT ARRAY[]::text[],
  available_papers text[] DEFAULT ARRAY[]::text[],
  available_finishes text[] DEFAULT ARRAY[]::text[],
  margin_pct numeric DEFAULT 50,
  category text,
  intro_long text,
  buyer_guide text,
  faqs jsonb,
  supplier_family text,
  envelopes_offered boolean DEFAULT false,
  quantity_ladder integer[] NOT NULL DEFAULT '{}'::integer[],
  folded_family text,
  sides_offered boolean NOT NULL DEFAULT false,
  display_quantity integer,
  routes jsonb
);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  base_price numeric(10,2),
  image_url text,
  active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid NOT NULL,
  full_name text,
  phone text,
  marketing_optin boolean NOT NULL DEFAULT false,
  marketing_optin_date timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_tasks (
  id text NOT NULL,
  title text NOT NULL,
  description text DEFAULT ''::text,
  area text DEFAULT 'site'::text,
  status text DEFAULT 'todo'::text,
  priority text DEFAULT 'medium'::text,
  due_date text DEFAULT ''::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rate_limits (
  bucket text NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  window_start timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recurring_costs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  payee text,
  category_id text,
  net numeric(12,2) NOT NULL DEFAULT 0,
  vat numeric(12,2) NOT NULL DEFAULT 0,
  frequency text NOT NULL DEFAULT 'monthly'::text,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  active boolean DEFAULT true,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.saved_designs (
  id text NOT NULL,
  user_id uuid NOT NULL,
  product_type text NOT NULL,
  design_data jsonb NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_config (
  id integer NOT NULL DEFAULT 1,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sheet_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  paper_name text NOT NULL,
  size text NOT NULL,
  quantity integer NOT NULL,
  cost numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  weight_gsm integer,
  supplier_family text,
  printed_sides text NOT NULL DEFAULT 'single'::text,
  active boolean NOT NULL DEFAULT true
);

-- Kept for evidence when rates were replaced; not read by anything.
CREATE TABLE IF NOT EXISTS public.sheet_rates_backup_20260924 (
  id uuid, paper_name text, size text, quantity integer, cost numeric,
  created_at timestamp with time zone, updated_at timestamp with time zone,
  weight_gsm integer, supplier_family text
);

CREATE TABLE IF NOT EXISTS public.sheet_rates_backup_folded400_20260926 (
  id uuid, paper_name text, size text, quantity integer, cost numeric,
  created_at timestamp with time zone, updated_at timestamp with time zone,
  weight_gsm integer, supplier_family text, printed_sides text
);

CREATE TABLE IF NOT EXISTS public.site_config (
  id text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.studio_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_slug text NOT NULL,
  active boolean DEFAULT true,
  base_prompt text NOT NULL,
  sizes jsonb DEFAULT '["a7", "a5", "a6", "square"]'::jsonb,
  intro_title text,
  intro_sub text,
  updated_at timestamp with time zone DEFAULT now(),
  product_noun text,
  folded boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.studio_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id text,
  product_slug text,
  event_type text NOT NULL,
  detail jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.studio_fields (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_slug text NOT NULL,
  key text NOT NULL,
  label text NOT NULL,
  display_order integer DEFAULT 0,
  optional boolean DEFAULT true,
  in_more boolean DEFAULT false,
  preview_style text DEFAULT 'body'::text,
  active boolean DEFAULT true,
  face text NOT NULL DEFAULT 'front'::text
);

CREATE TABLE IF NOT EXISTS public.studio_prompt_options (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_slug text NOT NULL,
  category text NOT NULL,
  label text NOT NULL,
  phrase text NOT NULL,
  swatch_hex text,
  display_order integer DEFAULT 0,
  active boolean DEFAULT true,
  default_on boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  terms text,
  contact text,
  website text,
  notes text,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- CONSTRAINTS  (primary keys, then unique, then check, then foreign keys)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.admin_users ADD CONSTRAINT admin_users_pkey PRIMARY KEY (user_id);
ALTER TABLE public.blog_posts ADD CONSTRAINT blog_posts_pkey PRIMARY KEY (id);
ALTER TABLE public.contacts ADD CONSTRAINT contacts_pkey PRIMARY KEY (email);
ALTER TABLE public.delivery_options ADD CONSTRAINT delivery_options_pkey PRIMARY KEY (id);
ALTER TABLE public.discount_codes ADD CONSTRAINT discount_codes_pkey PRIMARY KEY (id);
ALTER TABLE public.discount_redemptions ADD CONSTRAINT discount_redemptions_pkey PRIMARY KEY (id);
ALTER TABLE public.docs_index ADD CONSTRAINT docs_index_pkey PRIMARY KEY (id);
ALTER TABLE public.envelopes ADD CONSTRAINT envelopes_pkey PRIMARY KEY (id);
ALTER TABLE public.expense_categories ADD CONSTRAINT expense_categories_pkey PRIMARY KEY (id);
ALTER TABLE public.expenses ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);
ALTER TABLE public.finish_options ADD CONSTRAINT finish_options_pkey PRIMARY KEY (id);
ALTER TABLE public.finish_rates ADD CONSTRAINT finish_rates_pkey PRIMARY KEY (id);
ALTER TABLE public.finish_types ADD CONSTRAINT finish_types_pkey PRIMARY KEY (id);
ALTER TABLE public.from_prices_cache ADD CONSTRAINT from_prices_cache_pkey PRIMARY KEY (slug);
ALTER TABLE public.generated_prices ADD CONSTRAINT generated_prices_pkey PRIMARY KEY (id);
ALTER TABLE public.guides ADD CONSTRAINT guides_pkey PRIMARY KEY (id);
ALTER TABLE public.monthly_accounts ADD CONSTRAINT monthly_accounts_pkey PRIMARY KEY (month);
ALTER TABLE public.orders ADD CONSTRAINT orders_pkey PRIMARY KEY (id);
ALTER TABLE public.paper_stocks ADD CONSTRAINT paper_stocks_pkey PRIMARY KEY (id);
ALTER TABLE public.pricing ADD CONSTRAINT pricing_pkey PRIMARY KEY (id);
ALTER TABLE public.pricing_config ADD CONSTRAINT pricing_config_pkey PRIMARY KEY (id);
ALTER TABLE public.print_sizes ADD CONSTRAINT print_sizes_pkey PRIMARY KEY (id);
ALTER TABLE public.product_specs ADD CONSTRAINT product_specs_pkey PRIMARY KEY (id);
ALTER TABLE public.product_types ADD CONSTRAINT product_types_pkey PRIMARY KEY (id);
ALTER TABLE public.products ADD CONSTRAINT products_pkey PRIMARY KEY (id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (user_id);
ALTER TABLE public.project_tasks ADD CONSTRAINT project_tasks_pkey PRIMARY KEY (id);
ALTER TABLE public.rate_limits ADD CONSTRAINT rate_limits_pkey PRIMARY KEY (bucket);
ALTER TABLE public.recurring_costs ADD CONSTRAINT recurring_costs_pkey PRIMARY KEY (id);
ALTER TABLE public.saved_designs ADD CONSTRAINT saved_designs_pkey PRIMARY KEY (id);
ALTER TABLE public.seo_config ADD CONSTRAINT seo_config_pkey PRIMARY KEY (id);
ALTER TABLE public.sheet_rates ADD CONSTRAINT sheet_rates_pkey PRIMARY KEY (id);
ALTER TABLE public.site_config ADD CONSTRAINT site_config_pkey PRIMARY KEY (id);
ALTER TABLE public.studio_config ADD CONSTRAINT studio_config_pkey PRIMARY KEY (id);
ALTER TABLE public.studio_events ADD CONSTRAINT studio_events_pkey PRIMARY KEY (id);
ALTER TABLE public.studio_fields ADD CONSTRAINT studio_fields_pkey PRIMARY KEY (id);
ALTER TABLE public.studio_prompt_options ADD CONSTRAINT studio_prompt_options_pkey PRIMARY KEY (id);
ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);
-- The two sheet_rates_backup_* tables have no primary key. They are snapshots.

ALTER TABLE public.finish_options ADD CONSTRAINT finish_options_name_key UNIQUE (name);
ALTER TABLE public.generated_prices ADD CONSTRAINT generated_prices_spec_id_qty_key UNIQUE (spec_id, qty);
ALTER TABLE public.guides ADD CONSTRAINT guides_slug_key UNIQUE (slug);
ALTER TABLE public.orders ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);
ALTER TABLE public.product_types ADD CONSTRAINT product_types_slug_key UNIQUE (slug);
ALTER TABLE public.products ADD CONSTRAINT products_slug_key UNIQUE (slug);
ALTER TABLE public.studio_config ADD CONSTRAINT studio_config_product_slug_key UNIQUE (product_slug);
ALTER TABLE public.studio_fields ADD CONSTRAINT studio_fields_product_slug_key_key UNIQUE (product_slug, key);

ALTER TABLE public.blog_posts ADD CONSTRAINT blog_posts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text])));
ALTER TABLE public.discount_codes ADD CONSTRAINT discount_codes_type_check CHECK ((type = ANY (ARRAY['percent'::text, 'fixed'::text, 'free_delivery'::text])));
ALTER TABLE public.expense_categories ADD CONSTRAINT expense_categories_kind_check CHECK ((kind = ANY (ARRAY['cogs'::text, 'overhead'::text])));
ALTER TABLE public.paper_stocks ADD CONSTRAINT paper_stocks_tier_check CHECK ((tier = ANY (ARRAY['signature'::text, 'luxury'::text, 'kinder'::text])));
ALTER TABLE public.print_sizes ADD CONSTRAINT print_sizes_height_mm_check CHECK ((height_mm > (0)::numeric));
ALTER TABLE public.print_sizes ADD CONSTRAINT print_sizes_width_mm_check CHECK ((width_mm > (0)::numeric));
ALTER TABLE public.product_types ADD CONSTRAINT product_types_category_check CHECK (((category IS NULL) OR (category = ANY (ARRAY['weddings'::text, 'celebrations'::text, 'announcements'::text]))));
ALTER TABLE public.recurring_costs ADD CONSTRAINT recurring_costs_frequency_check CHECK ((frequency = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'annual'::text])));
ALTER TABLE public.sheet_rates ADD CONSTRAINT sheet_rates_printed_sides_chk CHECK ((printed_sides = ANY (ARRAY['single'::text, 'double'::text])));
ALTER TABLE public.studio_fields ADD CONSTRAINT studio_fields_face_check CHECK ((face = ANY (ARRAY['front'::text, 'inside'::text])));

ALTER TABLE public.admin_users ADD CONSTRAINT admin_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.discount_redemptions ADD CONSTRAINT discount_redemptions_code_id_fkey FOREIGN KEY (code_id) REFERENCES discount_codes(id) ON DELETE SET NULL;
ALTER TABLE public.discount_redemptions ADD CONSTRAINT discount_redemptions_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_category_id_fkey FOREIGN KEY (category_id) REFERENCES expense_categories(id);
ALTER TABLE public.generated_prices ADD CONSTRAINT generated_prices_spec_id_fkey FOREIGN KEY (spec_id) REFERENCES product_specs(id) ON DELETE CASCADE;
ALTER TABLE public.product_specs ADD CONSTRAINT product_specs_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.recurring_costs ADD CONSTRAINT recurring_costs_category_id_fkey FOREIGN KEY (category_id) REFERENCES expense_categories(id);
ALTER TABLE public.saved_designs ADD CONSTRAINT saved_designs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES  (those created by a PRIMARY KEY or UNIQUE constraint above are
-- not repeated here)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX contacts_consent_idx ON public.contacts USING btree (marketing_consent) WHERE marketing_consent;
-- Codes are unique case-insensitively: "SPRING10" and "spring10" are one code.
CREATE UNIQUE INDEX discount_codes_code_key ON public.discount_codes USING btree (upper(code));
CREATE INDEX discount_redemptions_email_idx ON public.discount_redemptions USING btree (lower(email));
-- One redemption per order, so a code cannot be applied twice to the same order.
CREATE UNIQUE INDEX discount_redemptions_order_key ON public.discount_redemptions USING btree (order_id) WHERE (order_id IS NOT NULL);
CREATE INDEX expenses_category_idx ON public.expenses USING btree (category_id);
CREATE INDEX expenses_spent_on_idx ON public.expenses USING btree (spent_on);
CREATE INDEX finish_rates_lookup ON public.finish_rates USING btree (supplier_family, finish_name, size, quantity) WHERE active;
CREATE UNIQUE INDEX finish_rates_natural_key ON public.finish_rates USING btree (supplier_family, finish_name, option_name, applies_to, size, quantity);
CREATE INDEX idx_generated_prices_spec ON public.generated_prices USING btree (spec_id);
CREATE INDEX guides_active_order_idx ON public.guides USING btree (active, display_order);
CREATE INDEX orders_created_at_idx ON public.orders USING btree (created_at DESC);
CREATE INDEX orders_event_date_idx ON public.orders USING btree (event_date) WHERE (event_date IS NOT NULL);
CREATE INDEX orders_gclid_idx ON public.orders USING btree (gclid) WHERE (gclid IS NOT NULL);
CREATE INDEX orders_utm_campaign_idx ON public.orders USING btree (utm_campaign) WHERE (utm_campaign IS NOT NULL);
CREATE INDEX idx_pricing_lookup ON public.pricing USING btree (product_type, size, paper_type, finish, quantity);
CREATE INDEX product_types_category_idx ON public.product_types USING btree (category) WHERE (category IS NOT NULL);
CREATE INDEX idx_profiles_marketing_optin ON public.profiles USING btree (marketing_optin) WHERE (marketing_optin = true);
CREATE INDEX saved_designs_user_id_idx ON public.saved_designs USING btree (user_id);
CREATE INDEX saved_designs_user_updated_idx ON public.saved_designs USING btree (user_id, updated_at DESC);
-- This is what makes a rate import idempotent: re-importing updates in place.
CREATE UNIQUE INDEX sheet_rates_natural_key ON public.sheet_rates USING btree (supplier_family, paper_name, weight_gsm, size, quantity, printed_sides);
CREATE INDEX idx_studio_events_product ON public.studio_events USING btree (product_slug);
CREATE INDEX idx_studio_events_session ON public.studio_events USING btree (session_id);
CREATE INDEX idx_studio_events_type ON public.studio_events USING btree (event_type);

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
--
-- Every table in public has RLS turned on. Three have no policy at all, which
-- means nothing reaches them through the API at any key level below the
-- service role: rate_limits (written only by the SECURITY DEFINER function
-- that counts hits) and the two sheet_rates_backup_* snapshots.
--
-- The house pattern is a pair: "<table>_public_read" (SELECT, using true) for
-- anything a shopper must see, and "<table>_admin_write" (ALL, using
-- is_admin()) for changing it. Tables holding what we PAY get a single
-- "<table>_admin_only" policy and no public read — sheet_rates, finish_rates,
-- pricing, product_specs, generated_prices, suppliers, expenses and the
-- accounts tables. Those are our cost base; the anon key must never see them.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docs_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finish_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finish_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finish_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.from_prices_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sheet_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sheet_rates_backup_20260924 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sheet_rates_backup_folded400_20260926 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_prompt_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════
-- POLICIES  (63)
-- ═══════════════════════════════════════════════════════════════════════════

-- You may read your own row to find out you are an admin. is_admin() reads
-- this table as SECURITY DEFINER, so it does not depend on this policy.
CREATE POLICY admin_users_self_read ON public.admin_users AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));

CREATE POLICY blog_posts_admin_write ON public.blog_posts AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY blog_posts_public_read ON public.blog_posts AS PERMISSIVE FOR SELECT TO public USING (true);

-- Customer list: admin only, no public read.
CREATE POLICY contacts_admin_only ON public.contacts AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY delivery_options_admin_write ON public.delivery_options AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY delivery_options_public_read ON public.delivery_options AS PERMISSIVE FOR SELECT TO public USING (true);

-- Codes are never listed to shoppers; redeem_discount() validates one at a time.
CREATE POLICY "admins manage discount codes" ON public.discount_codes AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- SELECT only, and no INSERT policy anywhere: rows are written solely by the
-- redeem_discount() SECURITY DEFINER function. Removing that function would
-- silently stop redemptions being recorded rather than raising an error.
CREATE POLICY "admins read redemptions" ON public.discount_redemptions AS PERMISSIVE FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY docs_index_admin_read ON public.docs_index AS PERMISSIVE FOR SELECT TO public USING (is_admin());
CREATE POLICY docs_index_admin_write ON public.docs_index AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY envelopes_admin_write ON public.envelopes AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY envelopes_public_read ON public.envelopes AS PERMISSIVE FOR SELECT TO public USING (true);

CREATE POLICY expense_categories_admin_only ON public.expense_categories AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY expenses_admin_only ON public.expenses AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY finish_options_admin_write ON public.finish_options AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY finish_options_public_read ON public.finish_options AS PERMISSIVE FOR SELECT TO public USING (true);

-- OUR COST for foiling and the rest. No public read, deliberately.
CREATE POLICY finish_rates_admin_only ON public.finish_rates AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY finish_types_admin_write ON public.finish_types AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY finish_types_public_read ON public.finish_types AS PERMISSIVE FOR SELECT TO public USING (true);

CREATE POLICY from_prices_cache_admin_write ON public.from_prices_cache AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY from_prices_cache_public_read ON public.from_prices_cache AS PERMISSIVE FOR SELECT TO public USING (true);

CREATE POLICY generated_prices_admin_only ON public.generated_prices AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());

-- Note: no WITH CHECK. USING alone still blocks a non-admin INSERT here,
-- because for ALL Postgres falls back to USING as the check expression.
CREATE POLICY guides_admin_write ON public.guides AS PERMISSIVE FOR ALL TO public USING (is_admin());
CREATE POLICY guides_public_read ON public.guides AS PERMISSIVE FOR SELECT TO public USING (true);

CREATE POLICY monthly_accounts_admin_only ON public.monthly_accounts AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY orders_admin_only ON public.orders AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
-- Signed-in customers see their own orders, matched on the email in the JWT.
-- Orders are created by the Stripe webhook on the service role, not from here.
CREATE POLICY users_read_own_orders ON public.orders AS PERMISSIVE FOR SELECT TO authenticated USING ((lower(customer_email) = lower((auth.jwt() ->> 'email'::text))));

CREATE POLICY paper_stocks_admin_write ON public.paper_stocks AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY paper_stocks_public_read ON public.paper_stocks AS PERMISSIVE FOR SELECT TO public USING (true);

CREATE POLICY pricing_admin_only ON public.pricing AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());

-- The published price list the whole shop reads. Public read is the point.
CREATE POLICY pricing_config_admin_write ON public.pricing_config AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY pricing_config_public_read ON public.pricing_config AS PERMISSIVE FOR SELECT TO public USING (true);

CREATE POLICY print_sizes_admin_write ON public.print_sizes AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY print_sizes_public_read ON public.print_sizes AS PERMISSIVE FOR SELECT TO public USING (true);

CREATE POLICY product_specs_admin_only ON public.product_specs AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY product_types_admin_write ON public.product_types AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY product_types_public_read ON public.product_types AS PERMISSIVE FOR SELECT TO public USING (true);

CREATE POLICY products_admin_write ON public.products AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY products_public_read ON public.products AS PERMISSIVE FOR SELECT TO public USING (true);

CREATE POLICY profiles_insert_own ON public.profiles AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY profiles_select_own ON public.profiles AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY profiles_update_own ON public.profiles AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));

CREATE POLICY project_tasks_admin_only ON public.project_tasks AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY recurring_costs_admin_only ON public.recurring_costs AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Users can delete own designs" ON public.saved_designs AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert own designs" ON public.saved_designs AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update own designs" ON public.saved_designs AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can view own designs" ON public.saved_designs AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));

CREATE POLICY seo_config_admin_write ON public.seo_config AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY seo_config_public_read ON public.seo_config AS PERMISSIVE FOR SELECT TO public USING (true);

-- OUR COST per sheet. This is the single most sensitive table in the database.
CREATE POLICY sheet_rates_admin_only ON public.sheet_rates AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY site_config_admin_write ON public.site_config AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY site_config_public_read ON public.site_config AS PERMISSIVE FOR SELECT TO public USING (true);

CREATE POLICY studio_config_admin_write ON public.studio_config AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY studio_config_public_read ON public.studio_config AS PERMISSIVE FOR SELECT TO public USING (true);

-- DUPLICATE: these two INSERT policies are identical. Permissive policies OR
-- together, so the pair behaves exactly like one of them. Harmless, but if you
-- ever tighten who may log a studio event, you must change BOTH or the looser
-- one keeps letting everything through. Safe to drop "events public insert".
CREATE POLICY "events public insert" ON public.studio_events AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY studio_events_public_insert ON public.studio_events AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY studio_events_admin_read ON public.studio_events AS PERMISSIVE FOR SELECT TO public USING (is_admin());

CREATE POLICY studio_fields_admin_write ON public.studio_fields AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY studio_fields_public_read ON public.studio_fields AS PERMISSIVE FOR SELECT TO public USING (true);

CREATE POLICY studio_prompt_options_admin_write ON public.studio_prompt_options AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY studio_prompt_options_public_read ON public.studio_prompt_options AS PERMISSIVE FOR SELECT TO public USING (true);

CREATE POLICY suppliers_admin_only ON public.suppliers AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());

-- ═══════════════════════════════════════════════════════════════════════════
-- FUNCTIONS  (14)
--
-- SECURITY DEFINER means the function runs as its owner and ignores RLS.
-- Every one of those below exists because a customer needs a single, narrow
-- thing done to a table they must not otherwise touch.
-- ═══════════════════════════════════════════════════════════════════════════

-- Am I an admin? Every admin_write policy in this file calls this. It is
-- SECURITY DEFINER so it can read admin_users without a policy letting it.
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select exists (select 1 from public.admin_users where user_id = auth.uid()) $function$;

-- Counts hits in a named bucket and returns false once over the limit.
-- The only thing that ever writes rate_limits, which has no policies.
CREATE OR REPLACE FUNCTION public.bump_rate_limit(p_bucket text, p_limit integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare current_hits integer;
begin
  insert into public.rate_limits (bucket, hits, window_start)
  values (p_bucket, 1, now())
  on conflict (bucket) do update set hits = public.rate_limits.hits + 1
  returning hits into current_hits;

  delete from public.rate_limits where window_start < now() - interval '2 days';
  return current_hits <= p_limit;      -- false once over the limit
end $function$;

-- Marks the welcome email as sent AND returns the contact in one statement,
-- so two concurrent calls cannot both send it.
CREATE OR REPLACE FUNCTION public.claim_welcome_email(p_email text)
 RETURNS TABLE(email text, name text, unsubscribe_token uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return query
  update public.contacts c
     set welcome_sent_at = now(), updated_at = now()
   where c.email = lower(trim(p_email))
     and c.marketing_consent
     and c.unsubscribed_at is null
     and c.welcome_sent_at is null
  returning c.email, c.name, c.unsubscribe_token;
end $function$;

-- The "from £x" on every product card. Reads the cache table; if the cache is
-- completely empty it works the price out of pricing_config on the fly, which
-- is slow but means a fresh database still shows prices.
-- It only ever considers flat, single-sided rows, so a folded rate cannot
-- masquerade as the cheapest price.
CREATE OR REPLACE FUNCTION public.from_prices()
 RETURNS TABLE(slug text, from_price numeric, display_quantity integer, vat_included boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
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
$function$;

-- Fills from_prices_cache from the published price list. Called by the trigger
-- on pricing_config, so publishing refreshes every "from" price. Returns how
-- many rows it wrote.
CREATE OR REPLACE FUNCTION public.rebuild_from_prices_cache()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  delete from from_prices_cache c
   where not exists (select 1 from product_types pt
                      where pt.slug = c.slug and pt.active);
  return n;
end;
$function$;

-- The trigger body. Statement-level, so one publish means one rebuild.
CREATE OR REPLACE FUNCTION public.pricing_config_refresh_cache()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform rebuild_from_prices_cache();
  return null;
end;
$function$;

-- One product's slice of the published price list. The full pricing_config
-- payload is ~11MB; this hands a product page only what it needs.
CREATE OR REPLACE FUNCTION public.pricing_for(p_slug text)
 RETURNS TABLE(payload jsonb)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'schema_version', c.payload -> 'schema_version',
    'published_at',   c.payload -> 'published_at',
    'papers',         coalesce(c.payload -> 'papers', '[]'::jsonb),
    'products',       coalesce((
      select jsonb_agg(p)
      from jsonb_array_elements(c.payload -> 'products') p
      where p ->> 'slug' = p_slug
    ), '[]'::jsonb)
  )
  from pricing_config c
  order by c.published_at desc
  limit 1
$function$;

-- Just the paper list out of the published payload.
CREATE OR REPLACE FUNCTION public.published_papers()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(c.payload -> 'papers', '[]'::jsonb)
  from pricing_config c
  order by c.published_at desc
  limit 1
$function$;

-- A signed-in customer's order history, shaped for the account page.
-- NOTE: deliberately NOT security definer. It selects "from orders" with no
-- where clause and relies entirely on the users_read_own_orders policy to cut
-- that down to the caller's own rows. Making this SECURITY DEFINER would hand
-- every customer everybody else's orders.
CREATE OR REPLACE FUNCTION public.my_orders()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(j order by created_at desc), '[]'::jsonb)
  from (
    select o.created_at, jsonb_build_object(
      'order_number',  o.order_number,
      'id',            o.id,
      'created_at',    o.created_at,
      'status',        o.status,
      'customer_name', o.customer_name,

      -- money, kept as separate lines so the invoice can show the working
      'subtotal_before_discount', o.subtotal_before_discount,
      'discount_code',   o.discount_code,
      'discount_amount', o.discount_amount,
      'subtotal',        o.subtotal,
      'vat',             o.vat,
      'total',           o.total,

      'paper',            o.paper,
      'envelope',         o.envelope,
      'delivery',         o.delivery,
      'delivery_address', o.delivery_address,
      'artwork_url',      o.artwork_url,

      'carrier',      o.carrier,
      'tracking',     o.dpd_tracking,
      'dispatched_at', o.dispatched_at,
      'delivered_at',  o.delivered_at,

      'items', (
        select coalesce(jsonb_agg(jsonb_build_object(
          -- basis carries the real product; the bare name is the uploaded
          -- filename, which makes a poor invoice line ("IMG_9288 x 50")
          'product', coalesce(
             (select pt.name from product_types pt where pt.slug = b.j ->> 'productSlug'),
             nullif(b.j ->> 'productSlug', ''),
             e ->> 'name'),
          'reference', e ->> 'name',
          'source',    e ->> 'source',
          'size',      coalesce(b.j ->> 'size',      e ->> 'size'),
          'paper',     coalesce(b.j ->> 'paperName', e ->> 'paper'),
          'finish',    nullif(b.j ->> 'finish', 'None'),
          'qty',       coalesce(b.j ->> 'qty',       e ->> 'qty'),
          'total',     e ->> 'total',
          'artwork_url', e ->> 'artworkUrl'
        )), '[]'::jsonb)
        from jsonb_array_elements(
               case when jsonb_typeof(o.items) = 'array' then o.items else '[]'::jsonb end
             ) e
        cross join lateral (
          select case jsonb_typeof(e -> 'basis')
                   when 'object' then e -> 'basis'
                   when 'string' then safe_jsonb(e ->> 'basis')
                   else '{}'::jsonb
                 end as j
        ) b
      )
    ) as j
    from orders o
  ) t;
$function$;

-- Parses text as jsonb and returns {} instead of throwing. Old orders stored
-- the basis as a string; some of those strings are not valid JSON.
CREATE OR REPLACE FUNCTION public.safe_jsonb(t text)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
begin
  return t::jsonb;
exception when others then
  return '{}'::jsonb;
end;
$function$;

-- Records a discount against an order and bumps the code's use count, under a
-- row lock so two checkouts cannot both take the last use. The unique index on
-- order_id makes a repeated webhook delivery a no-op rather than a double count.
-- This is the ONLY thing that may insert into discount_redemptions.
CREATE OR REPLACE FUNCTION public.redeem_discount(p_code text, p_order_id uuid, p_order_number text, p_email text, p_amount numeric)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id uuid; v_max integer; v_used integer; v_inserted integer;
begin
  select id, max_uses, used_count into v_id, v_max, v_used
  from public.discount_codes where upper(code) = upper(p_code) for update;

  if v_id is null then return false; end if;
  if v_max is not null and v_used >= v_max then return false; end if;

  insert into public.discount_redemptions (code_id, code, order_id, order_number, email, discount_amount)
  values (v_id, upper(p_code), p_order_id, p_order_number, lower(nullif(p_email,'')), coalesce(p_amount,0))
  on conflict (order_id) where order_id is not null do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return true;  -- already recorded for this order; nothing more to count
  end if;

  update public.discount_codes set used_count = used_count + 1, updated_at = now() where id = v_id;
  return true;
end $function$;

-- One-click unsubscribe from an email footer. The token is a per-contact uuid,
-- so the link needs no login and reveals no address.
CREATE OR REPLACE FUNCTION public.unsubscribe_by_token(p_token uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare hit integer;
begin
  update public.contacts
     set unsubscribed_at = coalesce(unsubscribed_at, now()),
         marketing_consent = false,
         updated_at = now()
   where unsubscribe_token = p_token;
  get diagnostics hit = row_count;
  return hit > 0;
end $function$;

-- Adds or updates the contact record after a paid order. Consent is one-way
-- here: this can grant it, never withdraw it, and it can never re-subscribe
-- somebody who has unsubscribed.
CREATE OR REPLACE FUNCTION public.upsert_contact_from_order(p_email text, p_name text, p_consent boolean, p_consent_text text, p_source text, p_total numeric, p_products text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.contacts as c
    (email, name, marketing_consent, consent_text, consent_at, consent_source,
     orders_count, total_spent, first_order_at, last_order_at, last_products)
  values
    (lower(trim(p_email)), p_name, coalesce(p_consent,false),
     case when p_consent then p_consent_text else null end,
     case when p_consent then now() else null end,
     case when p_consent then p_source else null end,
     1, coalesce(p_total,0), now(), now(), p_products)
  on conflict (email) do update set
    name           = coalesce(excluded.name, c.name),
    orders_count   = c.orders_count + 1,
    total_spent    = c.total_spent + coalesce(excluded.total_spent,0),
    last_order_at  = now(),
    last_products  = excluded.last_products,
    -- Only ever grant consent here, and never for someone who has unsubscribed.
    marketing_consent = case when c.unsubscribed_at is not null then false
                             when excluded.marketing_consent then true
                             else c.marketing_consent end,
    consent_text   = case when c.unsubscribed_at is null and excluded.marketing_consent
                          then excluded.consent_text else c.consent_text end,
    consent_at     = case when c.unsubscribed_at is null and excluded.marketing_consent
                          then now() else c.consent_at end,
    consent_source = case when c.unsubscribed_at is null and excluded.marketing_consent
                          then excluded.consent_source else c.consent_source end,
    updated_at     = now();
end $function$;

-- Stamps updated_at on the row being changed.
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- ═══════════════════════════════════════════════════════════════════════════
-- TRIGGERS  (3)
-- ═══════════════════════════════════════════════════════════════════════════

-- Publishing a price list refreshes every "from £x" on the site.
CREATE TRIGGER pricing_config_from_prices AFTER INSERT OR UPDATE ON public.pricing_config FOR EACH STATEMENT EXECUTE FUNCTION pricing_config_refresh_cache();
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.saved_designs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- Most other tables carry an updated_at column with no trigger behind it: the
-- admin pages set it explicitly. Worth knowing before you trust one.

-- ═══════════════════════════════════════════════════════════════════════════
-- STORAGE PARAMETERS
--
-- pricing_config holds a single ~11MB jsonb row, which Postgres keeps in a
-- side ("TOAST") table in roughly 700 pieces. Every publish rewrites the row
-- and leaves the old 700 pieces behind as dead weight. Enough of those and the
-- next publish takes longer than the 8 second statement timeout and fails with
-- error 57014. These settings tell autovacuum to clear it after every single
-- change rather than waiting for a percentage of the table to go stale.
-- The toast.* half is the half that matters.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.pricing_config SET (
  autovacuum_vacuum_threshold = 1,
  autovacuum_vacuum_scale_factor = 0,
  autovacuum_vacuum_cost_delay = 0,
  autovacuum_analyze_threshold = 1,
  autovacuum_analyze_scale_factor = 0,
  toast.autovacuum_vacuum_threshold = 1,
  toast.autovacuum_vacuum_scale_factor = 0,
  toast.autovacuum_vacuum_cost_delay = 0
);
