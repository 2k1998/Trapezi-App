# PRD — Phase 5a: Menu Management
### Trapezi · Version 1.1 · April 2, 2026

---

## 1. Goals

- Give restaurant owners full control over their menu from the dashboard at `/[slug]/owner`
- Support Basic and Pro plan feature sets with proper gating
- Enable Pro owners to run multiple menus with day/time scheduling
- Auto-translate all menu content via DeepL so owners only write in one language
- Never break the customer ordering experience during menu edits

---

## 2. Non-Goals

- No mobile app for the owner dashboard — desktop/tablet browser only
- No bulk import of menu items (CSV upload) — deferred
- No AI-generated menu descriptions — deferred
- No image cropping or editing tools — owner uploads, we display as-is
- No kitchen/bar routes or roles — ever

---

## 3. User Stories

**All plans:**
> As an owner, I want to add, edit, and delete menu items so I can keep my menu accurate.

> As an owner, I want to upload a photo for each item so customers can see what they're ordering.

> As an owner, I want to create, rename, and delete categories so I can organize my menu logically.

> As an owner, I want to write content in either Greek or English and have it automatically translated.

**Basic + Pro:**
> As an owner, I want to mark an item as unavailable so customers can't order something I've run out of.

> As an owner, I want availability to be per-menu, not global, so I can manage stock independently across menus.

**Pro only:**
> As an owner, I want to create multiple menus (e.g., Lunch, Dinner, Brunch) with different items and scheduling so the right menu shows at the right time.

> As an owner, I want to set a time window per day of the week for each menu so scheduling is precise.

> As an owner, I want to configure upsell suggestions so customers are nudged toward complementary items before they pay.

> As an owner, I want to set a happy hour discount (percentage or fixed amount) on selected items during a defined time window.

---

## 4. Feature Breakdown

### 4.1 Category Management (All plans)
- Owner can create a category with a name (one language — DeepL translates)
- Owner can rename a category
- Owner can delete a category — if items are assigned to it, prompt: "X items will become uncategorized. Continue?"
- Categories have a display order — owner can drag to reorder
- Uncategorized items appear in an "Other" catch-all section on the customer menu

### 4.2 Menu Item CRUD (All plans)
Each item has:
- `name` — owner writes in one language, DeepL auto-fills the other on save
- `description` — same translation logic
- `price` — VAT-inclusive, in euros, decimal input
- `category_id` — selected from owner's categories
- `image` — optional upload to Supabase Storage, public URL stored on item
- `type` — `food` or `drink` (determines which printer receives the slip)
- `allergens` — multi-select from fixed list (gluten, dairy, eggs, nuts, fish, shellfish, soy, sesame)
- `dietary` — multi-select: vegetarian, vegan, gluten-free

DeepL translation rules:
- If owner writes Greek → translate to English on save
- If owner writes English → translate to Greek on save
- Language detection is automatic via DeepL's detect feature
- Translation stored in DB, never re-fetched on customer page load
- Owner can manually override the auto-translated field after generation

### 4.3 Item Availability Toggle (Basic + Pro)
- Each item has an `available` boolean per menu (not global)
- Toggle is visible directly on the menu item card in the dashboard
- Toggling unavailable: item still appears on the customer menu but shown as "Unavailable" — greyed out, cannot be added to cart
- This matches what was already planned in Phase 1 — Phase 5a wires the UI to control it

### 4.4 Multiple Menus with Scheduling (Pro only)
- Owner can create multiple named menus (e.g., "Lunch Menu", "Dinner Menu")
- Each menu has its own item list — items are assigned to menus (many-to-many)
- Each menu can have a schedule: time window per day of the week
  - Owner picks which days the menu is active
  - Sets start time and end time per active day
  - Times are in Europe/Athens timezone
- At any given moment, the system determines the active menu by current day + time
- If no menu schedule matches current time → show all items from all menus (merged, deduplicated by item ID)
- If a Basic restaurant somehow has multiple menus in DB (edge case) → always show first/default only
- Each restaurant has one "Default Menu" that always exists and cannot be deleted — it's the fallback and the Basic plan menu

### 4.5 Upsell Prompts (Pro only)
- Owner links up to 2 suggested items per menu item in the dashboard
- At checkout, just before the payment step, a popup appears
- Popup shows suggestions for all items in the cart, deduplicated, capped at 4 total
- Selection priority: suggestions for the most expensive cart item shown first
- Each suggestion card shows: item image (or placeholder), name, price, one-tap "Add" button
- Customer can dismiss the popup and proceed to payment without adding anything
- If a suggested item is currently unavailable → it is excluded from the popup silently

### 4.6 Happy Hour / Scheduled Pricing (Pro only)
- Owner creates a happy hour rule with:
  - Selected items (multi-select from item list)
  - Discount type: percentage (e.g., 20%) or fixed amount (e.g., €2.00 off)
  - Time window: start time, end time, days of week active
  - Optional label shown to customer (e.g., "Happy Hour 🍹") — auto-translated
- At customer menu load, the server checks if a happy hour rule is currently active
- If active: discounted price shown in green, original price struck through
- Discount applied server-side in `create-payment-intent` — never trust client price
- Multiple rules can coexist — if an item matches two rules, the higher discount wins
- Happy hour rules are independent of menu scheduling

---

## 5. Technical Specification

### 5.1 New Database Tables

**`menus`**
```
id uuid PK
restaurant_id uuid FK → restaurants
name_el text
name_en text
is_default boolean default false
display_order int
created_at timestamptz
```

**`menu_schedules`**
```
id uuid PK
menu_id uuid FK → menus
day_of_week int (0=Sun … 6=Sat)
start_time time
end_time time
```

**`menu_items` — new columns**
```
name_el text
name_en text
description_el text
description_en text
image_url text
allergens text[] default '{}'
dietary text[] default '{}'
category_id uuid FK → categories (nullable)
deleted_at timestamptz (nullable — soft delete, OQ3 resolved)
```
*(Existing `name` and `description` columns migrated into `name_el`/`name_en` based on restaurant's primary language)*
*(Items where `deleted_at IS NOT NULL` are hidden from all menus and customer pages but retained for order history)*

**`categories`**
```
id uuid PK
restaurant_id uuid FK → restaurants
name_el text
name_en text
display_order int
created_at timestamptz
```

**`menu_item_assignments`** (junction — item belongs to menu)
```
id uuid PK
menu_id uuid FK → menus
menu_item_id uuid FK → menu_items
available boolean default true
display_order int
UNIQUE(menu_id, menu_item_id)
```

**`upsell_suggestions`**
```
id uuid PK
item_id uuid FK → menu_items
suggested_item_id uuid FK → menu_items
restaurant_id uuid FK → restaurants
display_order int (1 or 2)
UNIQUE(item_id, suggested_item_id)
```

**`happy_hour_rules`**
```
id uuid PK
restaurant_id uuid FK → restaurants
label_el text
label_en text
discount_type text CHECK IN ('percentage', 'fixed')
discount_value numeric
day_of_week int[] (array of 0–6)
start_time time
end_time time
created_at timestamptz
```

**`happy_hour_item_assignments`**
```
id uuid PK
rule_id uuid FK → happy_hour_rules
menu_item_id uuid FK → menu_items
```

### 5.2 New API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/menu/categories` | GET, POST | List or create categories |
| `/api/menu/categories/[id]` | PATCH, DELETE | Rename or delete category |
| `/api/menu/items` | GET, POST | List or create items |
| `/api/menu/items/[id]` | PATCH, DELETE | Edit or delete item |
| `/api/menu/items/[id]/image` | POST | Upload image to Supabase Storage |
| `/api/menu/menus` | GET, POST | List or create menus |
| `/api/menu/menus/[id]` | PATCH, DELETE | Edit or delete menu |
| `/api/menu/menus/[id]/schedule` | PUT | Replace schedule for a menu |
| `/api/menu/menus/[id]/items` | GET, POST, DELETE | Manage item assignments |
| `/api/menu/upsells` | GET, POST, DELETE | Manage upsell links |
| `/api/menu/happy-hour` | GET, POST | List or create happy hour rules |
| `/api/menu/happy-hour/[id]` | PATCH, DELETE | Edit or delete rule |
| `/api/menu/translate` | POST | DeepL translation call (server-side only) |
| `/api/menu/active` | GET | Returns active menu for current time (used by customer page) |

### 5.3 Translation Implementation
- DeepL Free API key stored in Vercel env as `DEEPL_API_KEY`
- All translation calls happen server-side in `/api/menu/translate`
- Never expose DeepL key to client
- Translation triggered on item/category/menu/happy-hour save — not on every load
- DeepL language codes: `EL` (Greek), `EN-GB` (English)
- Auto-detect source language via DeepL's `detect_language` feature
- If DeepL call fails: save the item with the entered language only, log the error, show a non-blocking warning to owner: "Auto-translation failed. You can add the translation manually."

### 5.4 Active Menu Logic (server-side)
```
1. Load all menus for restaurant
2. Get current Athens time (Europe/Athens)
3. Find menus where a schedule exists matching current day + current time falls within start_time–end_time
4. If one match → serve that menu's items
5. If multiple matches → merge items, deduplicate by item ID
6. If no match → return all items from all menus merged (fallback)
7. For Basic plan → always return default menu only, ignore scheduling
```

### 5.5 Happy Hour Pricing (server-side enforcement)
- `/api/menu/active` returns items with computed `discounted_price` if a rule is active
- `create-payment-intent` re-validates discounted price server-side before creating intent
- Client price is never trusted for discounted items — same pattern as base price validation

### 5.6 Image Upload
- Upload to Supabase Storage bucket: `menu-images`
- Bucket is public (images are not sensitive)
- File naming: `[restaurant_id]/[item_id]/[timestamp].[ext]`
- Max file size: 5MB
- Accepted formats: jpg, png, webp
- Old image deleted from Storage when replaced
- **Store original; serve compressed via Supabase image transforms** (OQ4 resolved) — customer pages request resized URL (e.g. `?width=400&quality=80`), dashboard shows original

### 5.7 RLS Policies (new tables)
- All new tables: owner/staff of that restaurant can read
- Only owner role can insert/update/delete on all menu management tables
- `menu_item_assignments.available` — cashier can also update (availability toggle exposed on cashier screen — OQ2 resolved: confirmed)
- `push_subscriptions` — existing policies unchanged

---

## 6. Plan Gating Summary

| Feature | Free | Basic | Pro |
|---|---|---|---|
| View menu items | ✅ | ✅ | ✅ |
| Create/edit/delete items | ✅ | ✅ | ✅ | <!-- OQ1 resolved: Free plan confirmed -->
| Category management | ✅ | ✅ | ✅ |
| Image upload | ✅ | ✅ | ✅ |
| Allergen/dietary management | ✅ | ✅ | ✅ |
| Item availability toggle | ❌ | ✅ | ✅ |
| Multiple menus | ❌ | ❌ | ✅ |
| Menu scheduling | ❌ | ❌ | ✅ |
| Upsell prompts | ❌ | ❌ | ✅ |
| Happy hour pricing | ❌ | ❌ | ✅ |
| Auto-translation (DeepL) | ✅ | ✅ | ✅ |

---

## 7. Acceptance Criteria

- [ ] Owner can create, edit, delete menu items with all fields
- [ ] Owner can upload an image; old image is deleted from Storage on replacement
- [ ] DeepL auto-translates name and description on save; owner can override
- [ ] DeepL failure is non-blocking — item saves, warning shown
- [ ] Owner can create, rename, delete categories with drag-to-reorder
- [ ] Deleting a category with items prompts confirmation; items become uncategorized
- [ ] Basic owner sees only one menu (default); multiple menu UI is hidden
- [ ] Pro owner can create multiple menus and assign items to each
- [ ] Pro owner can set schedules per menu per day with start/end times in Athens time
- [ ] Active menu logic returns correct menu at any given time
- [ ] No schedule active → all items shown (merged, deduplicated)
- [ ] Item availability toggle works per-menu, not globally
- [ ] Unavailable items show as greyed out on customer page — not orderable
- [ ] Upsell popup appears before payment step with max 4 suggestions
- [ ] Suggestions from unavailable items are excluded from popup
- [ ] Happy hour discount displayed with green price + strikethrough on customer page
- [ ] Happy hour discount validated server-side in `create-payment-intent`
- [ ] Higher discount wins if item matches multiple happy hour rules
- [ ] All new tables have correct RLS policies

---

## 8. Resolved Decisions

| # | Question | Resolution |
|---|---|---|
| OQ1 | Free plan item management | ✅ Confirmed — Free plan can create/edit/delete items |
| OQ2 | Availability toggle on cashier screen | ✅ Confirmed — cashier can toggle item availability from cashier screen |
| OQ3 | Delete behaviour for items with order history | ✅ Soft delete — `deleted_at` column, item hidden from menus, row kept for order history |
| OQ4 | Image storage: original or compressed | ✅ Store original, serve compressed via Supabase image transforms on customer pages |

---

## 9. Sub-phase Prompt Order

When ready to build, prompts will be delivered in this order:

1. **Claude Code first:** DB migrations, API routes, DeepL integration, active menu logic, happy hour price validation
2. **Cursor second:** Owner dashboard UI — item list, forms, category manager, menu scheduler, upsell configurator, happy hour rule builder
