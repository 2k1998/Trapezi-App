# PRD — Phase 0: Foundation & Infrastructure

**Project:** QR/NFC Table Ordering SaaS Platform  
**Phase:** 0 of 7  
**Owner:** Coding  
**Status:** Ready to build  
**Last updated:** March 2026 (v2 — decisions locked)  
**Tools:** Antigravity · Cursor · Claude Code · Supabase · Next.js · Tailwind CSS · Vercel

---

## Decisions Log

The following decisions were locked after the initial PRD draft and are reflected throughout
this document. Do not re-open these unless there is a strong reason.

| # | Decision | Detail |
|---|---|---|
| D1 | Tablet is iPad | Permanent cashier terminal. Leased at €30/mo per restaurant. |
| D2 | No NFC reader on iPad | iPad never reads NFC. Customers tap NFC stickers with their own phones. |
| D3 | Kitchen and bar screens | Not provided by us. Restaurant uses any browser-capable device they already own. |
| D4 | VAT included in all prices | Customer-facing prices are always VAT-inclusive. `tax` column used for accounting records only. |
| D5 | MVP languages | Greek (`el`) and English (`en`) only. |
| D6 | PIN UI deferred | `pin` column exists in schema. UI built in Phase 5, not MVP. |
| D7 | Admin is same Supabase project | `admin` role lives in the same project as restaurant staff. `restaurant_id = null` for admins. |
| D8 | App domain | TBD. Placeholder `app.domain` used throughout. Swap in once decided. |

---

## 1. Purpose

Phase 0 is the bedrock of the entire product. Nothing in Phases 1–7 works without what gets
built here. The goal is not to ship any user-facing feature — it is to establish the schema,
scaffold, design language, and authentication system that every subsequent phase plugs into.

Getting this phase right means the rest of the build moves fast and cleanly. Getting it wrong
means refactoring mid-product, which is expensive.

---

## 2. Goals

- Design and deploy the complete Supabase database schema (all 6 tables)
- Scaffold the Next.js project on Vercel with correct folder structure from day one
- Establish the Tailwind design system and select premium animation libraries
- Implement Supabase Auth with role-based login and automatic screen redirects
- Seed one test restaurant manually so Phases 1 and 2 can begin immediately after

---

## 3. Non-Goals (explicitly out of scope for Phase 0)

- No customer-facing UI
- No ordering logic
- No Stripe integration
- No real-time subscriptions (Supabase Realtime is configured but not wired to UI yet)
- No printer logic
- No restaurant self-signup flow
- No marketing site

---

## 4. Supabase Schema Design

### 4.1 Overview

Six tables. Every table has `id` as a UUID primary key and `created_at` as a timestamp with
timezone defaulting to `now()`. Row Level Security (RLS) is enabled on all tables from day one.

### 4.2 Table: `restaurants`

This is the master record for every restaurant on the platform.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `created_at` | `timestamptz` | default `now()` | |
| `name` | `text` | NOT NULL | Display name, e.g. "Bella Vista" |
| `slug` | `text` | NOT NULL, UNIQUE | URL-safe identifier, e.g. "bella-vista" |
| `plan` | `text` | NOT NULL, default `'free'` | Enum: free, basic, pro, enterprise |
| `plan_expires_at` | `timestamptz` | nullable | Null = no expiry (free plan or lifetime) |
| `stripe_customer_id` | `text` | nullable, UNIQUE | Set on first Stripe interaction |
| `stripe_subscription_id` | `text` | nullable | Current active subscription |
| `is_active` | `boolean` | NOT NULL, default `true` | Master kill switch |
| `owner_email` | `text` | NOT NULL | Used for billing and comms |
| `languages` | `text[]` | NOT NULL, default `'{en,el}'` | MVP supports English and Greek only |
| `default_language` | `text` | NOT NULL, default `'en'` | Fallback language |
| `timezone` | `text` | NOT NULL, default `'UTC'` | For receipt timestamps |
| `currency` | `text` | NOT NULL, default `'EUR'` | ISO 4217 code |
| `logo_url` | `text` | nullable | Public URL for logo image |
| `accent_color` | `text` | nullable | Hex color for menu branding |
| `metadata` | `jsonb` | nullable | Flexible storage for future fields |

**Index:** Unique index on `slug`. Partial index on `is_active = true` for fast active lookups.

**Reserved slugs:** The application layer must block the following slugs at signup:
`dashboard`, `admin`, `login`, `signup`, `settings`, `billing`, `api`, `health`, `static`,
`assets`, `null`, `undefined`.

**RLS policy:** Master admin service role has full access. Restaurant owner can read and update
their own row. Staff can read their own restaurant row (for branding on screens). Customers
have no direct access to this table.

---

### 4.3 Table: `staff`

All human users of the system except customers. This includes kitchen staff, bar staff,
cashiers, restaurant owners, and platform admins.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, FK → `auth.users.id` | Matches Supabase Auth user ID |
| `created_at` | `timestamptz` | default `now()` | |
| `restaurant_id` | `uuid` | FK → `restaurants.id`, nullable | Null = platform admin |
| `role` | `text` | NOT NULL | Enum: owner, kitchen, bar, cashier, admin |
| `display_name` | `text` | NOT NULL | Shown on screens |
| `email` | `text` | NOT NULL | Mirrors auth.users.email |
| `is_active` | `boolean` | NOT NULL, default `true` | Soft-delete / suspend |
| `pin` | `text` | nullable | Hashed 4-digit PIN. Column reserved; UI built in Phase 5. |
| `last_login_at` | `timestamptz` | nullable | |

**Index:** Index on `restaurant_id`. Index on `role` for redirect lookups. Index on `email`.

**RLS policy:** A staff member can read their own row. A restaurant owner can read all staff
rows belonging to their restaurant. The admin service role has full access.

**Note on admin role:** Platform admins have `restaurant_id = null` in this table. They live
in the same Supabase project as restaurant staff — no separate project or org. RLS policies
check for `role = 'admin'` to grant cross-restaurant read access via the service role key,
called only from server-side API routes. Admins never hit the database directly from the
browser with elevated privileges.

**Note on auth flow:** When a staff member authenticates via Supabase Auth, the application
reads their `role` from this table and redirects accordingly:

| Role | Redirect target |
|---|---|
| `kitchen` | `/[slug]/kitchen` |
| `bar` | `/[slug]/bar` |
| `cashier` | `/[slug]/cashier` |
| `owner` | `/[slug]/dashboard` |
| `admin` | `/admin` |

---

### 4.4 Table: `tables`

Physical tables in a restaurant, each mapped to a unique QR code and NFC sticker. The QR
code and NFC sticker on each table stand encode the exact same URL. Customers either scan
the QR with their phone camera or tap the NFC sticker with their phone. Both open the menu
in the customer's browser instantly. The iPad never reads NFC — that interaction happens
entirely between the customer's phone and the passive NFC sticker.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `created_at` | `timestamptz` | default `now()` | |
| `restaurant_id` | `uuid` | NOT NULL, FK → `restaurants.id` | |
| `table_number` | `integer` | NOT NULL | Human-readable number, e.g. 4 |
| `label` | `text` | nullable | Optional label, e.g. "Terrace 4" |
| `is_active` | `boolean` | NOT NULL, default `true` | Can deactivate without deleting |
| `status` | `text` | NOT NULL, default `'available'` | Enum: available, occupied |
| `qr_code_url` | `text` | nullable | Stored URL of generated QR image |
| `nfc_uid` | `text` | nullable, UNIQUE | Physical NFC tag UID |

**Unique constraint:** `(restaurant_id, table_number)` — no two tables in the same restaurant
can share the same number.

**Index:** Index on `restaurant_id`. Index on `status` for fast available-table lookups.

**QR URL encoding:** The QR code encodes the URL:
`https://app.[domain]/[slug]?table=[table_number]`

The app reads `slug` from the URL path and `table` from the query param. No table selection
by the customer — it is encoded in the QR code itself.

**RLS policy:** Staff of the restaurant can read all tables. Owner can create and update.
Customers have no direct access (table info is resolved server-side from the URL params).

---

### 4.5 Table: `menu_items`

Every product a restaurant sells. Supports multi-language translations natively.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `created_at` | `timestamptz` | default `now()` | |
| `restaurant_id` | `uuid` | NOT NULL, FK → `restaurants.id` | |
| `name` | `jsonb` | NOT NULL | `{"en": "Burger", "el": "Μπέργκερ"}` |
| `description` | `jsonb` | nullable | Same structure as name |
| `category` | `text` | NOT NULL | e.g. "starters", "mains", "drinks" |
| `type` | `text` | NOT NULL | Enum: food, drink — drives printer routing |
| `price` | `numeric(10,2)` | NOT NULL | In the restaurant's currency |
| `image_url` | `text` | nullable | Public CDN URL |
| `is_available` | `boolean` | NOT NULL, default `true` | Toggle 86'd items |
| `is_featured` | `boolean` | NOT NULL, default `false` | Highlighted on menu |
| `sort_order` | `integer` | NOT NULL, default `0` | Manual sort within category |
| `allergens` | `text[]` | nullable | Array of allergen codes |
| `tags` | `text[]` | nullable | e.g. `{vegan, spicy, gluten-free}` |
| `metadata` | `jsonb` | nullable | Flexible for future attributes |

**Critical field — `type`:** This field determines which printer receives the item. `food`
items go to the kitchen printer. `drink` items go to the bar printer. All items go to the
cashier printer regardless of type. This is the core routing logic for Phase 3.

**Multi-language structure:** `name` and `description` are JSONB objects keyed by language
code. The application falls back to `en` if the customer's language is not present. The
restaurant owner adds translations per item in their dashboard (Phase 5).

**Index:** Index on `restaurant_id`. Index on `(restaurant_id, category)` for menu page
queries. Index on `is_available` for filtering.

**RLS policy:** Any authenticated user can read items for their restaurant. Owner can create,
update, and delete. Customers can read available items via a public API route (anon key with
RLS allowing reads on `is_available = true`).

---

### 4.6 Table: `orders`

One row per order placed by a customer. A table can have multiple orders (running tab).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `created_at` | `timestamptz` | default `now()` | |
| `restaurant_id` | `uuid` | NOT NULL, FK → `restaurants.id` | |
| `table_id` | `uuid` | NOT NULL, FK → `tables.id` | |
| `order_number` | `integer` | NOT NULL | Sequential per restaurant per day |
| `status` | `text` | NOT NULL, default `'pending'` | Enum: pending, confirmed, ready, closed |
| `payment_method` | `text` | nullable | Enum: card, apple_pay, google_pay, cash |
| `payment_status` | `text` | NOT NULL, default `'unpaid'` | Enum: unpaid, paid, refunded |
| `stripe_payment_intent_id` | `text` | nullable | For card/digital payments |
| `subtotal` | `numeric(10,2)` | NOT NULL | Sum of all items before tax |
| `tax` | `numeric(10,2)` | NOT NULL, default `0` | For accounting records only. All customer-facing prices are VAT-inclusive (see D4). |
| `total` | `numeric(10,2)` | NOT NULL | subtotal + tax |
| `notes` | `text` | nullable | Customer notes on the order |
| `printed_at` | `timestamptz` | nullable | Set when all 3 printers confirm |
| `closed_at` | `timestamptz` | nullable | Set when cashier closes the tab |
| `session_id` | `text` | nullable | Groups orders from the same table visit |

**Order number:** Generated as a daily sequential integer per restaurant (not global). Resets
to 1 at midnight in the restaurant's timezone. Readable on all three printed receipts.

**Tab logic:** Multiple orders from the same table in the same visit share a `session_id`.
The cashier screen shows the running total across all orders in the session. Closing the tab
marks all orders in the session as `closed` and resets the table status to `available`.

**Index:** Index on `restaurant_id`. Index on `table_id`. Index on `status`. Index on
`(restaurant_id, created_at)` for analytics queries. Index on `session_id`.

**RLS policy:** Staff can read and update orders for their restaurant. Customers can insert
new orders via the anon key (with server-side validation). No direct delete is permitted.

---

### 4.7 Table: `order_items`

Line items within an order. Child table of `orders`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `created_at` | `timestamptz` | default `now()` | |
| `order_id` | `uuid` | NOT NULL, FK → `orders.id` | |
| `menu_item_id` | `uuid` | NOT NULL, FK → `menu_items.id` | |
| `restaurant_id` | `uuid` | NOT NULL, FK → `restaurants.id` | Denormalized for fast queries |
| `name_snapshot` | `text` | NOT NULL | Item name at time of order (in English) |
| `type` | `text` | NOT NULL | Enum: food, drink — copied from menu_item |
| `quantity` | `integer` | NOT NULL, default `1` | |
| `unit_price` | `numeric(10,2)` | NOT NULL | Price at time of order |
| `line_total` | `numeric(10,2)` | NOT NULL | quantity × unit_price |
| `notes` | `text` | nullable | Per-item customer note |

**Why snapshot the name:** Menu item names can change after an order is placed. The receipt
must always reflect what was actually ordered. `name_snapshot` freezes the name at order time.

**Why copy `type`:** The printer routing logic (Phase 3) reads `type` on order items directly
without joining back to `menu_items`. Denormalizing it here makes the query simpler and faster.

**Why include `restaurant_id`:** Allows direct queries on order items by restaurant without
always joining through orders. Required for analytics in Phase 5.

**Index:** Index on `order_id`. Index on `(restaurant_id, created_at)`. Index on `type` for
printer routing queries.

**RLS policy:** Mirrors `orders` — staff can read, customers can insert via server route.

---

### 4.8 Entity Relationship Summary

```
restaurants
    ├── staff (many)
    ├── tables (many)
    ├── menu_items (many)
    └── orders (many)
            └── order_items (many)
                    └── menu_items (ref)
```

`order_items.restaurant_id` is denormalized from `orders.restaurant_id` for query performance.
`order_items.type` is denormalized from `menu_items.type` for printer routing performance.

---

### 4.9 Supabase Realtime Configuration

Enable Realtime on these tables from the start:

| Table | Channel name pattern | Used by |
|---|---|---|
| `orders` | `orders:[restaurant_id]` | Kitchen, bar, cashier screens |
| `order_items` | `order_items:[restaurant_id]` | Kitchen, bar screens |
| `tables` | `tables:[restaurant_id]` | Cashier screen (status updates) |

Realtime is configured but not wired to any UI in Phase 0. It is ready for Phase 2.

---

## 5. Hardware Context

This section documents the physical deployment context so all screen and session decisions
in the codebase are made with the correct mental model.

### 5.1 The iPad (cashier terminal)

One iPad is provided per restaurant as part of the Pro hardware bundle, leased at €30/month.
It is permanently stationed next to the till. It is plugged in at all times. It never goes
home with anyone.

The iPad runs two things simultaneously:

- **Safari, always open** on the cashier screen URL (`/[slug]/cashier`). The cashier uses
  this to see the running tab per table, manage payments, and close tabs.
- **QZ Tray, running in the background** as a persistent process. It listens for print jobs
  and routes ESC/POS commands to the three thermal printers over the restaurant's WiFi.

The iPad is set up once by your hardware friend during onboarding: QZ Tray installed and
set to auto-start, Safari opened on the cashier URL, screen auto-lock disabled, guided
access enabled so the cashier cannot accidentally navigate away.

### 5.2 Kitchen and bar screens

These are not provided by the platform. The restaurant uses whatever browser-capable device
they already have — an old Android tablet, a wall-mounted monitor with a laptop, anything.
The kitchen screen and bar screen are just URLs opened in a browser. Your hardware friend
may assist with setup but the hardware itself is the restaurant's responsibility.

### 5.3 Customer interaction

Customers never use the iPad. They use their own phones. Each table has a plastic stand with
a printed QR code on one face and a passive NFC sticker embedded on the other. Scanning the
QR or tapping the NFC opens the menu in the customer's browser. No app download required.

---

## 6. Next.js Project Scaffold

### 6.1 Framework and version

Next.js 14+ with the App Router. No Pages Router. Server Components by default; Client
Components only where interactivity requires it (cart, animations, real-time subscriptions).

### 6.2 Folder structure

```
/app
  /[slug]                        Customer-facing ordering app
    /page.tsx                    Menu page (Phase 1)
    /cart/page.tsx               Cart page (Phase 1)
    /checkout/page.tsx           Checkout page (Phase 1)
    /order/[orderId]/page.tsx    Order status page (Phase 1)
    /kitchen/page.tsx            Kitchen screen (Phase 2)
    /bar/page.tsx                Bar screen (Phase 2)
    /cashier/page.tsx            Cashier screen (Phase 2)
    /dashboard/page.tsx          Restaurant owner panel (Phase 5)

  /admin                         Master admin panel (Phase 7)
    /page.tsx

  /login
    /page.tsx                    Staff login

  /api                           Server-side API routes
    /orders/route.ts             Order placement (Phase 1)
    /webhooks/stripe/route.ts    Stripe webhooks (Phase 6)
    /print/route.ts              Print trigger (Phase 3)

/components
  /ui                            Shared primitives (button, card, badge, etc.)
  /menu                          Menu-specific components (Phase 1)
  /staff                         Staff screen components (Phase 2)
  /admin                         Admin panel components (Phase 7)

/lib
  /supabase
    /client.ts                   Browser Supabase client
    /server.ts                   Server Supabase client
    /middleware.ts               Auth middleware
  /stripe
    /client.ts                   Stripe client
  /print
    /escpos.ts                   ESC/POS formatting utilities (Phase 3)
    /qztray.ts                   QZ Tray WebSocket bridge (Phase 3)
  /hooks
    /useCart.ts                  Cart state hook
    /useRealtime.ts              Supabase Realtime hook
  /utils
    /slugify.ts
    /currency.ts
    /language.ts

/public
  /fonts
  /icons

/styles
  globals.css

middleware.ts                    Auth guard and slug resolution
```

### 6.3 Environment variables

The following `.env.local` keys are required from day one:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_APP_DOMAIN=

# Added in later phases:
# STRIPE_SECRET_KEY=
# STRIPE_WEBHOOK_SECRET=
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
# TWILIO_ACCOUNT_SID=
# TWILIO_AUTH_TOKEN=
# RESEND_API_KEY=
```

### 6.4 Vercel configuration

- Production branch: `main`
- Preview branches: all other branches
- Environment variables set in Vercel dashboard (not committed to repo)
- Framework preset: Next.js (auto-detected)
- Build command: `next build` (default)
- Output directory: `.next` (default)

One custom Vercel config is needed for the slug routing — `vercel.json` should not redirect
the `[slug]` path since it is handled by the App Router dynamic segment.

---

## 7. Design System

### 7.1 Philosophy

The product must feel premium from the first customer interaction. Restaurants paying €49–490/mo
expect a product that feels like it belongs in a Michelin-starred restaurant's hands, not a
startup side project. Every transition, every state change, every loading moment must feel
intentional and polished.

The standard for premium feel: smooth, never flashy. Purposeful motion, never distracting.

### 7.2 Tailwind CSS setup

Install Tailwind CSS v3+ with the following custom configuration additions to `tailwind.config.ts`:

**Custom colors (extend the default palette):**

```
brand
  50:  #FAFAF7   Very light warm off-white
  100: #F2F1EB   Background surface
  200: #E3E1D9   Border default
  300: #C8C5BB   Border strong
  400: #9D9A8E   Muted text
  500: #6B6860   Secondary text
  600: #3D3C37   Primary text
  700: #2A2925   Heading
  800: #1A1916   Near-black
  900: #0F0E0D   True near-black

accent
  400: #D4A853   Gold — used for highlights, premium badges
  500: #B8892E   Gold dark — hover state
  600: #8C6420   Gold deeper — active state
```

**Custom font family:**

Primary: `Inter` (via `next/font/google`, subset latin, variable weight)
Display: `Playfair Display` (via `next/font/google`, for hero text on menu pages)

**Custom animation utilities (added to the Tailwind config):**

```
animate-fade-in:      opacity 0→1, translateY 8px→0, duration 320ms, ease-out
animate-fade-up:      opacity 0→1, translateY 16px→0, duration 400ms, ease-out
animate-scale-in:     opacity 0→1, scale 0.96→1, duration 280ms, ease-out
animate-slide-right:  translateX -12px→0, opacity 0→1, duration 350ms, ease-out
animate-shimmer:      shimmer skeleton loading effect, duration 1.5s, loop
```

**Custom box-shadow tokens:**

```
shadow-premium:   0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)
shadow-card:      0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04)
shadow-elevated:  0 4px 16px rgba(0,0,0,0.08), 0 16px 40px rgba(0,0,0,0.06)
```

### 7.3 Animation library: Framer Motion

**Why Framer Motion over CSS animations alone:** The product has complex animation needs —
staggered list entries, layout animations when items are added to cart, shared element
transitions between screens, and gesture-driven interactions. CSS keyframes handle simple
transitions. Framer Motion handles everything else without fighting the browser.

**Key usage patterns:**

`motion.div` with `initial`, `animate`, `exit` — for page transitions and component mounts.

`AnimatePresence` — for cart item add/remove animations and order item additions to staff
screens.

`useMotionValue` and `useSpring` — for the cart quantity counter spring animation and the
order total counter increment.

`layout` prop — for smooth list reordering when items are added to cart or orders are sorted
on the kitchen screen.

`staggerChildren` in `variants` — for the menu category items fading in sequentially on page
load, giving the menu a premium reveal feel.

**The install:** `framer-motion` as a dependency. Import only what is needed per component —
do not import the full library in a single place.

### 7.4 Animation library: AutoAnimate

**Why AutoAnimate alongside Framer Motion:** AutoAnimate is a zero-config drop-in for list
animations. When a new order appears on the kitchen screen in real time, AutoAnimate handles
the insertion animation automatically with a single `useAutoAnimate` hook call. No manual
`AnimatePresence` setup required for simple list mutations.

Use AutoAnimate for: kitchen screen order list, bar screen order list, cashier screen tab
items.
Use Framer Motion for: page transitions, cart interactions, order confirmation sequences,
anything requiring choreographed multi-step animation.

### 7.5 Specific premium animation moments to implement

These are the highest-impact animation moments in the product. Each one must be designed
deliberately:

**Menu page load:** Category headings and item cards stagger in from below with a 40ms delay
between each card. The effect is a smooth cascade from top to bottom.

**Add to cart:** The item card scales up 1.02 then back to 1.0 over 200ms. A small quantity
badge on the cart icon animates from scale 0 to 1 with a spring. The cart icon itself gives
a brief pulse.

**Cart open:** The cart drawer slides in from the right with a spring-based entrance
(stiffness: 300, damping: 30). Item rows animate in with stagger.

**Cart item remove:** The row shrinks height to 0 with opacity 0 over 250ms before being
removed from the DOM. No jarring jump.

**Order placed confirmation:** Full-screen overlay with a check mark that draws itself with
an SVG stroke animation. Below it, the order number counts up from 0 to the actual number.
The background uses a very subtle radial gradient pulse.

**Kitchen/bar screen — new order arrival:** The new order card slides in from the top of the
list and the rest of the cards animate down smoothly. The card has a 2-second highlight state
(a subtle amber left border that fades out) to draw attention.

**Cashier screen — tab total update:** The running total number animates with a spring-based
counter increment. Never a jump — always a smooth roll.

---

## 8. Supabase Auth Implementation

### 8.1 Auth strategy

Supabase Auth handles all authentication. Email + password only for the MVP. No OAuth, no
magic links in Phase 0 (can be added later). Customers do not log in — they are anonymous
users identified by session and table number.

### 8.2 Middleware (the auth guard)

`middleware.ts` at the project root runs on every request. It handles three responsibilities:

**1. Session refresh:** Calls `supabase.auth.getUser()` on every request to refresh the JWT
cookie silently. This keeps staff sessions alive on screens that are open all day.

**Critical iPad requirement:** The cashier screen runs on an iPad that is permanently on and
never closed. Safari on iPad will eventually let the Supabase JWT expire if the tab sits idle
between customer interactions. The session refresh in middleware handles requests triggered
by user interaction, but for true always-on resilience the cashier page must also run a
client-side silent refresh on a 10-minute interval using `supabase.auth.getSession()`. This
prevents the cashier waking up mid-service to a logged-out state. Implement this in Phase 2
when the cashier screen is built.

**2. Route protection:** Protects all staff routes:

```
/[slug]/kitchen      → Requires role: kitchen or owner or admin
/[slug]/bar          → Requires role: bar or owner or admin
/[slug]/cashier      → Requires role: cashier or owner or admin
/[slug]/dashboard    → Requires role: owner or admin
/admin               → Requires role: admin
```

If a staff member hits a protected route without a valid session, redirect to `/login`.

If a staff member hits a protected route but their role does not match, redirect to their
correct screen (not a 403 — this prevents confusion if a kitchen staff member lands on
the cashier URL).

**3. Slug validation:** When a request hits `/[slug]/*`, the middleware verifies the slug
exists in the `restaurants` table and `is_active = true`. If not found, return a 404. This
prevents crawling and probing of inactive slugs.

### 8.3 Login page (`/login`)

Simple, clean screen. No branding specific to a restaurant — this is a staff-internal page.

Fields: email + password. A single "Sign in" button.

On successful auth, immediately query the `staff` table for the user's `role` and
`restaurant_id`, then redirect to the appropriate screen:

| Role | Destination |
|---|---|
| `kitchen` | `/[restaurant_slug]/kitchen` |
| `bar` | `/[restaurant_slug]/bar` |
| `cashier` | `/[restaurant_slug]/cashier` |
| `owner` | `/[restaurant_slug]/dashboard` |
| `admin` | `/admin` |

On error, show the Supabase error message inline (not a toast — inline, below the password
field).

### 8.4 Supabase client setup

Two clients are needed:

**Browser client** (`/lib/supabase/client.ts`): Created with `createBrowserClient` from
`@supabase/ssr`. Used in Client Components and hooks. Singleton pattern — do not instantiate
on every render.

**Server client** (`/lib/supabase/server.ts`): Created with `createServerClient` from
`@supabase/ssr`, reading cookies from the Next.js request context. Used in Server Components,
Server Actions, and API routes. A new instance per request (Next.js server context).

**Middleware client** (`/lib/supabase/middleware.ts`): Created with `createServerClient` in
the middleware context, reading and writing cookies from the middleware request/response. This
is the one that handles session refresh.

### 8.5 RLS policies to configure in Phase 0

These policies are set up in the Supabase dashboard (or via migration SQL) now, so they do
not need to be revisited in later phases:

**`restaurants` table:**
- Anon can read `name`, `slug`, `languages`, `default_language`, `accent_color`, `logo_url`
  where `is_active = true` (needed for the public menu page)
- Authenticated staff can read all columns for their `restaurant_id`
- Service role has full access

**`staff` table:**
- Authenticated user can read and update their own row (`id = auth.uid()`)
- Owner can read all rows where `restaurant_id` matches their own `restaurant_id`
- Service role has full access

**`tables` table:**
- Anon can read `table_number`, `status` where `restaurant_id` matches (for QR URL resolution)
- Authenticated staff can read all columns for their `restaurant_id`
- Owner can create and update
- Service role has full access

**`menu_items` table:**
- Anon can read all columns where `is_available = true` and `restaurant_id` matches
- Authenticated staff can read all columns for their `restaurant_id`
- Owner can create, update, delete
- Service role has full access

**`orders` table:**
- Anon can insert (for customer order placement — validated server-side)
- Authenticated staff can read and update for their `restaurant_id`
- Service role has full access

**`order_items` table:**
- Anon can insert (created alongside the order — validated server-side)
- Authenticated staff can read for their `restaurant_id`
- Service role has full access

---

## 9. Test Restaurant Seed Data

At the end of Phase 0, one restaurant must be seeded manually in Supabase to enable Phase 1
and Phase 2 development without a self-signup flow.

**Restaurant record:**

| Field | Value |
|---|---|
| `name` | Test Restaurant |
| `slug` | test-restaurant |
| `plan` | pro |
| `owner_email` | dev@test.com |
| `languages` | `{en, el}` |
| `default_language` | en |
| `currency` | EUR |

**Tables:** 5 tables, numbered 1–5, all `available`.

**Staff accounts (created via Supabase Auth, then mirrored in `staff` table):**

| Email | Password | Role |
|---|---|---|
| kitchen@test.com | test1234 | kitchen |
| bar@test.com | test1234 | bar |
| cashier@test.com | test1234 | cashier |
| owner@test.com | test1234 | owner |

**Menu items:** At minimum 8 items — 4 food and 4 drinks — with English and Greek
translations, covering at least 2 categories. This gives Phase 1 enough real content
to test the menu page, cart, and Phase 3 printer routing (food vs drink split).

---

## 10. Tooling Workflow Notes

### Antigravity
Use for the initial project scaffold — generates the Next.js boilerplate, sets up Tailwind,
installs dependencies, and connects the Supabase client. Do not fight its conventions.
Accept its folder structure and adapt it to the spec above where needed.

### Cursor
Primary coding environment. Use `.cursorrules` at the project root to encode the schema
context, component conventions, and naming patterns so Cursor autocomplete is aware of the
data model throughout the project.

The `.cursorrules` file should include: the six table names and their key columns, the role
enum values, the routing map (role → URL), and the Tailwind color token names so Cursor
stops suggesting hardcoded hex values.

### Claude Code
Use for: migration SQL generation, RLS policy generation, complex hooks, and any logic that
involves multiple files at once. Claude Code is the right tool when a change requires touching
more than 3 files simultaneously.

---

## 11. Acceptance Criteria

Phase 0 is complete when every item below is confirmed:

- [ ] All 6 tables exist in Supabase with the correct columns, types, constraints, and indexes
- [ ] RLS is enabled on all 6 tables and the policies defined in section 8.5 are active
- [ ] Supabase Realtime is enabled on `orders`, `order_items`, and `tables`
- [ ] Next.js project is scaffolded with the folder structure in section 6.2
- [ ] Project deploys to Vercel with no build errors on the `main` branch
- [ ] Environment variables are configured in Vercel dashboard
- [ ] Tailwind config includes the custom colors, fonts, shadow tokens, and animation utilities
- [ ] Framer Motion and AutoAnimate are installed as dependencies
- [ ] The auth middleware runs on every request and refreshes the session cookie
- [ ] Visiting `/login` renders the login form
- [ ] Logging in as `kitchen@test.com` redirects to `/test-restaurant/kitchen`
- [ ] Logging in as `bar@test.com` redirects to `/test-restaurant/bar`
- [ ] Logging in as `cashier@test.com` redirects to `/test-restaurant/cashier`
- [ ] Logging in as `owner@test.com` redirects to `/test-restaurant/dashboard`
- [ ] Visiting `/test-restaurant/kitchen` without a session redirects to `/login`
- [ ] Visiting a non-existent slug (e.g. `/fake-slug`) returns a 404
- [ ] Reserved slugs return a 404 when visited
- [ ] Test restaurant seed data is present: restaurant row, 5 tables, 4 staff accounts, 8 menu items
- [ ] `cursorrules` file is present and encodes the schema and routing context
- [ ] iPad session refresh interval is documented in the cashier screen spec (Phase 2 ticket created)
- [ ] Hardware context section (section 5) has been reviewed and signed off by hardware friend

---

## 12. Open Questions

All questions from the initial draft have been resolved except one:

| # | Question | Owner | Impact |
|---|---|---|---|
| D8 | What is the final app domain? | Product | Needed for QR URL encoding and Vercel config. Use `app.domain` as placeholder until decided. |

---

*End of PRD — Phase 0: Foundation & Infrastructure (v2)*
