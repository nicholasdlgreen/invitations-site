-- ─── ADD SIZE + DESIGN-STUDIO COLUMNS TO ORDERS ──────────────
-- Run in Supabase SQL Editor (Database → SQL Editor → New query).
--
-- This adds three columns so size + design-studio specifics flow
-- through to your back-end records:
--
--   • size          — A5 / A6 / 5x7 / DL / Square (text)
--   • template_id   — Which design-studio template this is (text, nullable)
--   • design_state  — Full customisation state for re-rendering (jsonb, nullable)
--
-- Upload-and-print orders will have:  size = chosen, template_id = NULL
-- Design-studio orders will have:     size = chosen, template_id = 'botanic',
--                                     design_state = {colour, fonts, text…}

-- You need to check your actual table name first. It might be `orders`,
-- `order_items`, or `inv_orders`. Open Supabase → Table Editor and look
-- at what holds your line items, then replace `order_items` below.

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS size text,
  ADD COLUMN IF NOT EXISTS template_id text,
  ADD COLUMN IF NOT EXISTS design_state jsonb;

-- Optional: index template_id if you want to query "all orders for the
-- Botanic template" quickly later (for popularity analysis etc.)
CREATE INDEX IF NOT EXISTS order_items_template_id_idx
  ON order_items (template_id) WHERE template_id IS NOT NULL;

-- Verify the columns were added:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'order_items' AND column_name IN ('size','template_id','design_state');
