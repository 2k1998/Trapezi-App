-- Migration 007: Phase 5a — Menu Management
-- New tables: categories, menus, menu_schedules, menu_item_assignments,
--             upsell_suggestions, happy_hour_rules, happy_hour_item_assignments
-- Adds flat text columns to menu_items for direct language access.

-- ─── CATEGORIES ────────────────────────────────────────────────────────────
CREATE TABLE categories (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name_el        text NOT NULL,
  name_en        text NOT NULL,
  display_order  int  NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_categories_restaurant ON categories(restaurant_id);

-- Public read for customer menu page
CREATE POLICY "Public can read categories"
  ON categories FOR SELECT TO anon
  USING (true);

CREATE POLICY "Staff can read categories"
  ON categories FOR SELECT TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM staff WHERE id = auth.uid()
    )
  );

CREATE POLICY "Owner can manage categories"
  ON categories FOR ALL TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM staff WHERE id = auth.uid() AND role = 'owner'
    )
  );

-- ─── MENUS ──────────────────────────────────────────────────────────────────
CREATE TABLE menus (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid    NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name_el        text    NOT NULL,
  name_en        text    NOT NULL,
  is_default     boolean NOT NULL DEFAULT false,
  display_order  int     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_menus_restaurant ON menus(restaurant_id);

CREATE POLICY "Public can read menus"
  ON menus FOR SELECT TO anon
  USING (true);

CREATE POLICY "Staff can read menus"
  ON menus FOR SELECT TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM staff WHERE id = auth.uid()
    )
  );

CREATE POLICY "Owner can manage menus"
  ON menus FOR ALL TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM staff WHERE id = auth.uid() AND role = 'owner'
    )
  );

-- ─── MENU SCHEDULES ─────────────────────────────────────────────────────────
CREATE TABLE menu_schedules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id      uuid NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  day_of_week  int  NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time   time NOT NULL,
  end_time     time NOT NULL
);
ALTER TABLE menu_schedules ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_menu_schedules_menu ON menu_schedules(menu_id);

CREATE POLICY "Public can read menu schedules"
  ON menu_schedules FOR SELECT TO anon
  USING (true);

CREATE POLICY "Staff can read schedules"
  ON menu_schedules FOR SELECT TO authenticated
  USING (
    menu_id IN (
      SELECT id FROM menus WHERE restaurant_id IN (
        SELECT restaurant_id FROM staff WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Owner can manage schedules"
  ON menu_schedules FOR ALL TO authenticated
  USING (
    menu_id IN (
      SELECT id FROM menus WHERE restaurant_id IN (
        SELECT restaurant_id FROM staff WHERE id = auth.uid() AND role = 'owner'
      )
    )
  );

-- ─── MENU ITEM ASSIGNMENTS ───────────────────────────────────────────────────
-- Junction table: which items belong to which menu, with per-menu availability.
CREATE TABLE menu_item_assignments (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id       uuid    NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  menu_item_id  uuid    NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  available     boolean NOT NULL DEFAULT true,
  display_order int     NOT NULL DEFAULT 0,
  UNIQUE(menu_id, menu_item_id)
);
ALTER TABLE menu_item_assignments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_menu_item_assignments_menu ON menu_item_assignments(menu_id);
CREATE INDEX idx_menu_item_assignments_item ON menu_item_assignments(menu_item_id);

CREATE POLICY "Public can read item assignments"
  ON menu_item_assignments FOR SELECT TO anon
  USING (true);

CREATE POLICY "Staff can read assignments"
  ON menu_item_assignments FOR SELECT TO authenticated
  USING (
    menu_id IN (
      SELECT id FROM menus WHERE restaurant_id IN (
        SELECT restaurant_id FROM staff WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Owner can manage assignments"
  ON menu_item_assignments FOR ALL TO authenticated
  USING (
    menu_id IN (
      SELECT id FROM menus WHERE restaurant_id IN (
        SELECT restaurant_id FROM staff WHERE id = auth.uid() AND role = 'owner'
      )
    )
  );

-- Cashier can toggle per-item availability (86ing an item mid-service)
CREATE POLICY "Cashier can toggle availability"
  ON menu_item_assignments FOR UPDATE TO authenticated
  USING (
    menu_id IN (
      SELECT id FROM menus WHERE restaurant_id IN (
        SELECT restaurant_id FROM staff WHERE id = auth.uid() AND role = 'cashier'
      )
    )
  );

-- ─── UPSELL SUGGESTIONS ──────────────────────────────────────────────────────
CREATE TABLE upsell_suggestions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id           uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  suggested_item_id uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  restaurant_id     uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  display_order     int  NOT NULL CHECK (display_order IN (1, 2)),
  UNIQUE(item_id, suggested_item_id)
);
ALTER TABLE upsell_suggestions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_upsell_item ON upsell_suggestions(item_id);
CREATE INDEX idx_upsell_restaurant ON upsell_suggestions(restaurant_id);

CREATE POLICY "Public can read upsells"
  ON upsell_suggestions FOR SELECT TO anon
  USING (true);

CREATE POLICY "Staff can read upsells"
  ON upsell_suggestions FOR SELECT TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM staff WHERE id = auth.uid()
    )
  );

CREATE POLICY "Owner can manage upsells"
  ON upsell_suggestions FOR ALL TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM staff WHERE id = auth.uid() AND role = 'owner'
    )
  );

-- ─── HAPPY HOUR RULES ────────────────────────────────────────────────────────
CREATE TABLE happy_hour_rules (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid    NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  label_el        text,
  label_en        text,
  discount_type   text    NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value  numeric NOT NULL,
  day_of_week     int[]   NOT NULL,
  start_time      time    NOT NULL,
  end_time        time    NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE happy_hour_rules ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_happy_hour_restaurant ON happy_hour_rules(restaurant_id);

CREATE POLICY "Public can read happy hour rules"
  ON happy_hour_rules FOR SELECT TO anon
  USING (true);

CREATE POLICY "Staff can read happy hour rules"
  ON happy_hour_rules FOR SELECT TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM staff WHERE id = auth.uid()
    )
  );

CREATE POLICY "Owner can manage happy hour rules"
  ON happy_hour_rules FOR ALL TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM staff WHERE id = auth.uid() AND role = 'owner'
    )
  );

-- ─── HAPPY HOUR ITEM ASSIGNMENTS ─────────────────────────────────────────────
CREATE TABLE happy_hour_item_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id       uuid NOT NULL REFERENCES happy_hour_rules(id) ON DELETE CASCADE,
  menu_item_id  uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE
);
ALTER TABLE happy_hour_item_assignments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_happy_hour_assignments_rule ON happy_hour_item_assignments(rule_id);

CREATE POLICY "Public can read happy hour assignments"
  ON happy_hour_item_assignments FOR SELECT TO anon
  USING (true);

CREATE POLICY "Staff can read happy hour assignments"
  ON happy_hour_item_assignments FOR SELECT TO authenticated
  USING (
    rule_id IN (
      SELECT id FROM happy_hour_rules WHERE restaurant_id IN (
        SELECT restaurant_id FROM staff WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Owner can manage happy hour assignments"
  ON happy_hour_item_assignments FOR ALL TO authenticated
  USING (
    rule_id IN (
      SELECT id FROM happy_hour_rules WHERE restaurant_id IN (
        SELECT restaurant_id FROM staff WHERE id = auth.uid() AND role = 'owner'
      )
    )
  );

-- ─── ALTER menu_items ────────────────────────────────────────────────────────
-- Add flat text language columns (name/description are already jsonb but we
-- add separate text columns for direct language access and future migration).
-- allergens and image_url already exist from migration 001 — skip those.
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS name_el        text,
  ADD COLUMN IF NOT EXISTS name_en        text,
  ADD COLUMN IF NOT EXISTS description_el text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS dietary        text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS category_id    uuid REFERENCES categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at     timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_deleted ON menu_items(deleted_at) WHERE deleted_at IS NULL;

-- Migrate existing jsonb name/description into flat text columns
UPDATE menu_items
  SET name_el = name->>'el'
  WHERE name_el IS NULL AND name->>'el' IS NOT NULL;

UPDATE menu_items
  SET name_en = name->>'en'
  WHERE name_en IS NULL AND name->>'en' IS NOT NULL;

UPDATE menu_items
  SET description_el = description->>'el'
  WHERE description_el IS NULL AND description->>'el' IS NOT NULL;

UPDATE menu_items
  SET description_en = description->>'en'
  WHERE description_en IS NULL AND description->>'en' IS NOT NULL;

-- ─── SEED: default menu for test-restaurant ──────────────────────────────────
INSERT INTO menus (restaurant_id, name_el, name_en, is_default, display_order)
SELECT id, 'Κύριο Μενού', 'Main Menu', true, 0
FROM restaurants
WHERE slug = 'test-restaurant'
ON CONFLICT DO NOTHING;

-- Assign all existing items for test-restaurant to the default menu
INSERT INTO menu_item_assignments (menu_id, menu_item_id, available, display_order)
SELECT
  m.id,
  mi.id,
  true,
  ROW_NUMBER() OVER (ORDER BY mi.created_at)
FROM menus m
JOIN menu_items mi ON mi.restaurant_id = m.restaurant_id
WHERE m.is_default = true
  AND m.restaurant_id = (SELECT id FROM restaurants WHERE slug = 'test-restaurant')
ON CONFLICT DO NOTHING;
