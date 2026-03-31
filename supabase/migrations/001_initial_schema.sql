--- TABLE 1: restaurants ---
CREATE TABLE restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'free' 
    CHECK (plan IN ('free','basic','pro','enterprise')),
  plan_expires_at timestamptz,
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text,
  is_active boolean NOT NULL DEFAULT true,
  owner_email text NOT NULL,
  languages text[] NOT NULL DEFAULT '{en,el}',
  default_language text NOT NULL DEFAULT 'en',
  timezone text NOT NULL DEFAULT 'UTC',
  currency text NOT NULL DEFAULT 'EUR',
  logo_url text,
  accent_color text,
  metadata jsonb
);
CREATE UNIQUE INDEX idx_restaurants_slug ON restaurants(slug);
CREATE INDEX idx_restaurants_active ON restaurants(is_active) 
  WHERE is_active = true;

--- TABLE 2: staff ---
CREATE TABLE staff (
  id uuid PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  restaurant_id uuid REFERENCES restaurants(id),
  role text NOT NULL 
    CHECK (role IN ('owner','kitchen','bar','cashier','admin')),
  display_name text NOT NULL,
  email text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  pin text,
  last_login_at timestamptz
);
CREATE INDEX idx_staff_restaurant_id ON staff(restaurant_id);
CREATE INDEX idx_staff_role ON staff(role);
CREATE INDEX idx_staff_email ON staff(email);

--- TABLE 3: tables ---
CREATE TABLE tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id),
  table_number integer NOT NULL,
  label text,
  is_active boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'available'
    CHECK (status IN ('available','occupied')),
  qr_code_url text,
  nfc_uid text UNIQUE,
  UNIQUE(restaurant_id, table_number)
);
CREATE INDEX idx_tables_restaurant_id ON tables(restaurant_id);
CREATE INDEX idx_tables_status ON tables(status);

--- TABLE 4: menu_items ---
CREATE TABLE menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id),
  name jsonb NOT NULL,
  description jsonb,
  category text NOT NULL,
  type text NOT NULL CHECK (type IN ('food','drink')),
  price numeric(10,2) NOT NULL,
  image_url text,
  is_available boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  allergens text[],
  tags text[],
  metadata jsonb
);
CREATE INDEX idx_menu_items_restaurant_id 
  ON menu_items(restaurant_id);
CREATE INDEX idx_menu_items_restaurant_category 
  ON menu_items(restaurant_id, category);
CREATE INDEX idx_menu_items_is_available 
  ON menu_items(is_available);

--- TABLE 5: orders ---
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id),
  table_id uuid NOT NULL REFERENCES tables(id),
  order_number integer NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','ready','closed')),
  payment_method text 
    CHECK (payment_method IN 
      ('card','apple_pay','google_pay','cash')),
  payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','paid','refunded')),
  stripe_payment_intent_id text,
  subtotal numeric(10,2) NOT NULL,
  tax numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL,
  notes text,
  printed_at timestamptz,
  closed_at timestamptz,
  session_id text
);
CREATE INDEX idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX idx_orders_table_id ON orders(table_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_restaurant_created 
  ON orders(restaurant_id, created_at);
CREATE INDEX idx_orders_session_id ON orders(session_id);

--- TABLE 6: order_items ---
CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  order_id uuid NOT NULL REFERENCES orders(id),
  menu_item_id uuid NOT NULL REFERENCES menu_items(id),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id),
  name_snapshot text NOT NULL,
  type text NOT NULL CHECK (type IN ('food','drink')),
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL,
  line_total numeric(10,2) NOT NULL,
  notes text
);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_restaurant_created 
  ON order_items(restaurant_id, created_at);
CREATE INDEX idx_order_items_type ON order_items(type);

--- ENABLE RLS ---
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

--- RLS POLICIES: restaurants ---
CREATE POLICY "Public can read active restaurant branding"
  ON restaurants FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY "Staff can read own restaurant"
  ON restaurants FOR SELECT TO authenticated
  USING (id IN (
    SELECT restaurant_id FROM staff 
    WHERE id = auth.uid()
  ));

CREATE POLICY "Owner can update own restaurant"
  ON restaurants FOR UPDATE TO authenticated
  USING (id IN (
    SELECT restaurant_id FROM staff 
    WHERE id = auth.uid() AND role = 'owner'
  ));

--- RLS POLICIES: staff ---
CREATE POLICY "Staff can read own row"
  ON staff FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Staff can update own row"
  ON staff FOR UPDATE TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Owner can read team"
  ON staff FOR SELECT TO authenticated
  USING (restaurant_id IN (
    SELECT restaurant_id FROM staff 
    WHERE id = auth.uid() AND role = 'owner'
  ));

--- RLS POLICIES: tables ---
CREATE POLICY "Public can read tables for menu"
  ON tables FOR SELECT TO anon
  USING (true);

CREATE POLICY "Staff can read own restaurant tables"
  ON tables FOR SELECT TO authenticated
  USING (restaurant_id IN (
    SELECT restaurant_id FROM staff WHERE id = auth.uid()
  ));

CREATE POLICY "Owner can manage tables"
  ON tables FOR ALL TO authenticated
  USING (restaurant_id IN (
    SELECT restaurant_id FROM staff 
    WHERE id = auth.uid() AND role = 'owner'
  ));

--- RLS POLICIES: menu_items ---
CREATE POLICY "Public can read available menu items"
  ON menu_items FOR SELECT TO anon
  USING (is_available = true);

CREATE POLICY "Staff can read own restaurant menu"
  ON menu_items FOR SELECT TO authenticated
  USING (restaurant_id IN (
    SELECT restaurant_id FROM staff WHERE id = auth.uid()
  ));

CREATE POLICY "Owner can manage menu items"
  ON menu_items FOR ALL TO authenticated
  USING (restaurant_id IN (
    SELECT restaurant_id FROM staff 
    WHERE id = auth.uid() AND role = 'owner'
  ));

--- RLS POLICIES: orders ---
CREATE POLICY "Anon can place orders"
  ON orders FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Staff can read and update orders"
  ON orders FOR SELECT TO authenticated
  USING (restaurant_id IN (
    SELECT restaurant_id FROM staff WHERE id = auth.uid()
  ));

CREATE POLICY "Staff can update orders"
  ON orders FOR UPDATE TO authenticated
  USING (restaurant_id IN (
    SELECT restaurant_id FROM staff WHERE id = auth.uid()
  ));

--- RLS POLICIES: order_items ---
CREATE POLICY "Anon can insert order items"
  ON order_items FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Staff can read order items"
  ON order_items FOR SELECT TO authenticated
  USING (restaurant_id IN (
    SELECT restaurant_id FROM staff WHERE id = auth.uid()
  ));

--- ENABLE REALTIME ---
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE tables;
