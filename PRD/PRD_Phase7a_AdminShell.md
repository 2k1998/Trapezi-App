# PRD — Phase 7a: Admin Shell, Auth & Restaurant List
**Version:** 1.0 | **Status:** Locked  
**Project:** Trapezi | **Author:** Kostas (via Claude)

---

## 1. Goals

- Set up subdomain routing so `dashboard.trapeziapp.com` serves the admin panel from within the same Next.js project
- Create the admin account (one-time script)
- Build the admin login page with role-based auth guard
- Build the admin shell (layout, sidebar, navigation)
- Build the restaurant list — all restaurants with key info at a glance
- Build the restaurant detail page — full read-only view of everything a restaurant has
- Build the onboard new restaurant form

---

## 2. Non-Goals

- Editing restaurant data (Phase 7c)
- Subscription management UI (Phase 7b)
- Platform analytics/charts (Phase 7d)
- Live order monitoring (Phase 7d)

---

## 3. Locked Decisions

| Decision | Value |
|---|---|
| Admin panel location | Same Next.js project, subdomain via middleware |
| Admin subdomain | `dashboard.trapeziapp.com` |
| Internal route prefix | `app/admin/*` — rewritten by middleware |
| Admin auth | Supabase Auth, `role = 'admin'`, `restaurant_id = null` |
| Admin DB access | `SUPABASE_SERVICE_ROLE_KEY` — bypasses RLS for all admin queries |
| Admin account creation | One-time script `scripts/create-admin.ts` |
| Restaurant detail | Read-only in Phase 7a — full edit comes in Phase 7c |

---

## 4. Subdomain Routing Architecture

The existing `middleware.ts` handles restaurant slug routing. Extend it to also handle the admin subdomain.

### Logic:
```ts
const host = request.headers.get('host') ?? ''
const isDashboard = host.startsWith('dashboard.')

if (isDashboard) {
  // Rewrite: dashboard.trapeziapp.com/restaurants → internally /admin/restaurants
  const pathname = request.nextUrl.pathname
  return NextResponse.rewrite(new URL(`/admin${pathname}`, request.url))
}
// existing slug routing continues unchanged below
```

### Admin route protection:
Add to middleware — if `isDashboard` and path is not `/admin/login`:
1. Check for Supabase session
2. Verify `role = 'admin'` on the session user via `staff` table
3. If not authenticated or not admin → redirect to `dashboard.trapeziapp.com/login`

Use the existing Supabase server client pattern from `lib/supabase/server.ts`.

---

## 5. Admin Account Creation Script

Create `scripts/create-admin.ts`:

- Reads `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_URL` from `.env.local`
- Accepts email and password as CLI args: `npx ts-node scripts/create-admin.ts --email admin@trapeziapp.com --password <password>`
- Creates a Supabase Auth user via `supabase.auth.admin.createUser()`
- Inserts a record into `staff` table: `role = 'admin'`, `restaurant_id = null`, `email = <email>`, `name = 'Kostas'`
- Prints confirmation: `✅ Admin account created: admin@trapeziapp.com`
- Exits cleanly — safe to run once only (checks for existing admin before creating)

---

## 6. Database Queries

All admin queries use the **service role Supabase client** (bypasses RLS). Create `lib/supabase/admin.ts`:

```ts
import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

This client is used exclusively in admin API routes — never exposed to the browser.

---

## 7. New API Routes

### `GET /api/admin/restaurants`
Auth: admin role required (check session + staff.role)

Returns all restaurants with:
```ts
{
  id, name, slug, plan, subscription_status, dunning_day,
  contract_start_date, current_period_end, stripe_customer_id,
  stripe_subscription_id, created_at, metadata,
  // computed:
  staff_count: number,
  menu_items_count: number,
  tables_count: number,
  orders_count_30d: number,
  revenue_30d: number  // sum of orders.total in last 30 days
}
```

### `GET /api/admin/restaurants/[restaurantId]`
Auth: admin role required

Returns full restaurant detail:
```ts
{
  // restaurant row (all columns)
  restaurant: Restaurant,
  // related data
  staff: Staff[],
  tables: Table[],
  sections: Section[],
  categories: Category[],
  menu_items: MenuItem[],  // include soft-deleted (deleted_at not null)
  menus: Menu[],
  recent_orders: Order[],  // last 20 orders with order_items
  push_subscriptions_count: number,
  printers: PrinterConfig[],  // from metadata.printers
}
```

### `POST /api/admin/restaurants`
Auth: admin role required

Creates a new restaurant. Body:
```ts
{
  name: string
  slug: string
  owner_email: string
  plan: 'free' | 'basic' | 'pro'
  printer_ips?: string[]  // optional, stored in metadata.printers
}
```

Logic:
1. Validate slug is not reserved and not taken
2. Insert restaurant row
3. Create Supabase Auth user for owner (auto-generate password)
4. Insert staff row: `role = 'owner'`, `restaurant_id = new restaurant id`
5. If plan is `basic` or `pro`: call activate-subscription logic (reuse `lib/billing/` utilities)
6. Return: `{ restaurant_id, owner_email, generated_password }`
7. Show generated password once in the UI — not stored in plain text after this

---

## 8. Admin Shell (Layout)

### File: `app/admin/layout.tsx` (server component)
- Fetches session, verifies admin role
- Passes restaurant count + admin name to shell

### File: `components/admin/AdminShell.tsx` (client component)

**Sidebar:**
- Same brand gradient as the rest of the platform (`bg-brand-950`)
- Trapezi logo (`public/logo.png`) at top — white, same as owner sidebar
- Nav items:
  - 🏠 Restaurants (default)
  - 📊 Analytics *(greyed out — Phase 7d)*
  - ⚙️ Settings *(greyed out — future)*
- Bottom: logged-in admin name + logout button

**Main content area:**
- `bg-brand-50` — light background
- Top bar: page title + optional action button (e.g. "New Restaurant")

---

## 9. Admin Login Page

### File: `app/admin/login/page.tsx`

- Same gradient background as other auth pages
- Trapezi logo centered above card
- Email + password form
- On submit: `supabase.auth.signInWithPassword()`
- On success: verify `role = 'admin'` in staff table — if not admin, sign out and show error "Access denied"
- On success + admin: redirect to `dashboard.trapeziapp.com/restaurants`
- No "forgot password" link — admin only, handled manually

---

## 10. Restaurant List Page

### File: `app/admin/restaurants/page.tsx`

Fetches from `GET /api/admin/restaurants`.

**Layout:** Full-width table/card list

**Columns:**
| Column | Details |
|---|---|
| Restaurant | Name + slug badge |
| Plan | Free / Basic / Pro badge (color coded) |
| Status | Active / Past Due / Cancelled badge |
| Next Billing | Formatted date or `—` |
| Contract End | Formatted date or `—` |
| MRR | €69 / €129 / €0 based on plan |
| Staff | Count |
| Menu Items | Count |
| Orders (30d) | Count |
| Revenue (30d) | €X.XX |
| Actions | "View" button → restaurant detail |

**Features:**
- Search by name or slug
- Filter by plan (All / Free / Basic / Pro)
- Filter by status (All / Active / Past Due / Cancelled)
- Sort by name, plan, next billing date, revenue
- "New Restaurant" button → opens onboarding form/modal

**Empty state:** "No restaurants yet. Click 'New Restaurant' to onboard your first client."

---

## 11. Restaurant Detail Page (Read-Only)

### File: `app/admin/restaurants/[restaurantId]/page.tsx`

Fetches from `GET /api/admin/restaurants/[restaurantId]`.

Organised into tabs:

### Tab 1 — Overview
- Restaurant name, slug, created date
- Plan badge + subscription status badge
- Billing: next billing date, contract start/end, early exit fee
- Stripe customer ID + subscription ID (clickable → opens Stripe Dashboard)
- Printer IPs from metadata

### Tab 2 — Staff
- Table: name, email, role, created_at
- PIN status (set / not set)

### Tab 3 — Menu
- Categories list with item counts
- Menu items table: name (el/en), price, type, available, deleted_at
- Show soft-deleted items with strikethrough

### Tab 4 — Tables & Sections
- Sections list with table counts
- Tables: number, name, capacity, section

### Tab 5 — Orders (last 20)
- Order cards: table, items, total, status, created_at
- Link to full order history (Phase 7d)

### Tab 6 — Branding
- Shows current accent color (color swatch)
- Logo image if set
- Font, secondary color, confirmation message

---

## 12. New Restaurant Onboarding Form

Triggered by "New Restaurant" button on the restaurant list page. Renders as a full-page form or slide-over panel.

**Fields:**
| Field | Type | Notes |
|---|---|---|
| Restaurant name | Text | Required |
| Slug | Text | Auto-generated from name, editable. Validated against reserved slugs |
| Owner email | Email | Required — Supabase Auth account created |
| Plan | Select | Free / Basic / Pro |
| Printer IPs | Text (repeatable) | Optional, comma-separated or add/remove rows |

**On submit:**
- Calls `POST /api/admin/restaurants`
- Shows success modal with:
  - Restaurant URL: `trapeziapp.com/[slug]`
  - Owner login URL: `trapeziapp.com/[slug]/login`
  - Owner email
  - **Generated password** (shown once, copy button)
  - "Done" button

**Validation:**
- Slug: lowercase, letters/numbers/hyphens only, not in reserved list, not already taken
- Email: valid format, not already in use

---

## 13. Acceptance Criteria

- [ ] `dashboard.trapeziapp.com` serves the admin panel (middleware rewrite working)
- [ ] Non-admin users redirected to login on any admin route
- [ ] Admin login works with email + password
- [ ] Non-admin Supabase users cannot access admin panel even with valid session
- [ ] Restaurant list loads all restaurants with correct data
- [ ] Search, filter, and sort work on restaurant list
- [ ] Restaurant detail shows all 6 tabs with correct data
- [ ] New restaurant form creates restaurant + owner account + activates subscription
- [ ] Generated password shown once on success
- [ ] Admin account creation script runs cleanly and checks for duplicates
- [ ] All admin API routes return 401 for non-admin requests

---

## 14. Files to Create / Modify

### New Files
| File | Purpose |
|---|---|
| `scripts/create-admin.ts` | One-time admin account creation |
| `lib/supabase/admin.ts` | Service role Supabase client |
| `app/admin/login/page.tsx` | Admin login page |
| `app/admin/layout.tsx` | Admin layout with auth guard |
| `app/admin/restaurants/page.tsx` | Restaurant list |
| `app/admin/restaurants/[restaurantId]/page.tsx` | Restaurant detail |
| `components/admin/AdminShell.tsx` | Admin sidebar + layout shell |
| `components/admin/RestaurantList.tsx` | Restaurant list table component |
| `components/admin/RestaurantDetail.tsx` | Restaurant detail tabs component |
| `components/admin/NewRestaurantForm.tsx` | Onboarding form |
| `app/api/admin/restaurants/route.ts` | GET all + POST new restaurant |
| `app/api/admin/restaurants/[restaurantId]/route.ts` | GET restaurant detail |
| `lib/types/admin.ts` | Admin-specific TypeScript types |

### Modified Files
| File | Change |
|---|---|
| `middleware.ts` | Add subdomain detection + admin route protection |

---

## 15. Open Questions

None — all decisions locked.
