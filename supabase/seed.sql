DO $$
DECLARE
  v_restaurant_id uuid;
BEGIN

  -- 1. Insert Restaurant and capture its ID
  INSERT INTO restaurants (
    name, slug, plan, owner_email, 
    languages, default_language, currency, is_active
  ) VALUES (
    'Test Restaurant', 'test-restaurant', 'pro', 
    'dev@test.com', '{en,el}', 'en', 'EUR', true
  ) RETURNING id INTO v_restaurant_id;

  -- 2. Insert Tables
  INSERT INTO tables (restaurant_id, table_number, is_active, status)
  VALUES 
    (v_restaurant_id, 1, true, 'available'),
    (v_restaurant_id, 2, true, 'available'),
    (v_restaurant_id, 3, true, 'available'),
    (v_restaurant_id, 4, true, 'available'),
    (v_restaurant_id, 5, true, 'available');

  -- 3. Insert Menu Items
  -- Food items (type = 'food')
  INSERT INTO menu_items (restaurant_id, name, category, type, price, sort_order, is_available, is_featured)
  VALUES 
    (v_restaurant_id, '{"en":"Margherita Pizza","el":"Πίτσα Μαργαρίτα"}', 'mains', 'food', 12.50, 1, true, false),
    (v_restaurant_id, '{"en":"Caesar Salad","el":"Σαλάτα Καίσαρα"}', 'starters', 'food', 8.00, 1, true, false),
    (v_restaurant_id, '{"en":"Grilled Chicken","el":"Ψητό Κοτόπουλο"}', 'mains', 'food', 14.00, 2, true, false),
    (v_restaurant_id, '{"en":"Garlic Bread","el":"Ψωμί Σκόρδου"}', 'starters', 'food', 4.50, 2, true, false);

  -- Drink items (type = 'drink')
  INSERT INTO menu_items (restaurant_id, name, category, type, price, sort_order, is_available, is_featured)
  VALUES 
    (v_restaurant_id, '{"en":"Espresso","el":"Εσπρέσο"}', 'hot drinks', 'drink', 2.80, 1, true, false),
    (v_restaurant_id, '{"en":"Fresh Orange Juice","el":"Φρέσκος Χυμός Πορτοκάλι"}', 'soft drinks', 'drink', 3.50, 1, true, false),
    (v_restaurant_id, '{"en":"House Red Wine","el":"Κόκκινο Κρασί"}', 'wine', 'drink', 6.00, 1, true, false),
    (v_restaurant_id, '{"en":"Sparkling Water","el":"Ανθρακούχο Νερό"}', 'soft drinks', 'drink', 2.00, 2, true, false);

END $$;
