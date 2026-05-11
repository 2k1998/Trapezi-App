CLAUDE.md — Project Intelligence File
QR/NFC Restaurant Table Ordering SaaS Platform
Read this file fully before responding to any request.

What this project is
A SaaS platform that lets restaurant customers order food and
drinks by scanning a QR code or tapping an NFC sticker on their
table. Orders fire in real time to the cashier screen and
simultaneously trigger three thermal printers automatically.
Kitchen and bar staff receive printed slips only — they have
no screens and no logins.
This is not a prototype. This is a real coded product being
built for paying restaurant clients.

Tech stack

Next.js 14+ with App Router (never Pages Router)
TypeScript strict mode throughout
Supabase: database, auth, realtime, storage
Tailwind CSS v3+ with custom design tokens
Framer Motion + AutoAnimate for animations
Stripe + Stripe Billing for payments and subscriptions
QZ Tray for thermal printer communication (ESC/POS over WiFi)
Vercel for hosting
Resend or Postmark for transactional email
Twilio for SMS fallback notifications
Web Push API for customer order-ready notifications


Database schema (memorise this)
restaurants
id, name, slug, plan (free|basic|pro|enterprise),
plan_expires_at, stripe_customer_id, stripe_subscription_id,
is_active, owner_email, languages (text[]), default_language,
timezone, currency, logo_url, accent_color, metadata (jsonb)
staff
id (= auth.uid()), restaurant_id, role (owner|cashier|admin),
display_name, email, is_active, pin, last_login_at
NOTE: kitchen and bar roles do not exist and must never be
created. Kitchen and bar staff have no accounts, no screens,
and no logins. They receive orders via thermal printer only.
tables
id, restaurant_id, table_number, label, is_active,
status (available|occupied), qr_code_url, nfc_uid
menu_items
id, restaurant_id, name (jsonb), description (jsonb),
category, type (food|drink), price, image_url,
is_available, is_featured, sort_order, allergens (text[]),
tags (text[]), metadata (jsonb)
orders
id, restaurant_id, table_id, order_number, status
(pending|confirmed|ready|closed), payment_method
(card|apple_pay|google_pay|cash), payment_status
(unpaid|paid|refunded), stripe_payment_intent_id,
subtotal, tax, total, notes, printed_at, closed_at,
session_id
order_items
id, order_id, menu_item_id, restaurant_id, name_snapshot,
type (food|drink), quantity, unit_price, line_total, notes

Business rules (never violate these)

Prices are always VAT-inclusive. No tax added on top
for customers. The tax column is accounting-only.
menu_items.type and order_items.type drive printer routing:

food → kitchen thermal printer only
drink → bar thermal printer only
all items → cashier thermal printer always


Printers fire automatically the moment a customer places
an order. No human interaction required. No one needs to
be watching a screen for printing to happen.
order_items.name_snapshot freezes the item name at order
time. Never use menu_items.name for receipt or display.
order_items.type is denormalized from menu_items.type.
Copy it at insert time. Never join back to get it.
order_items.restaurant_id is denormalized from
orders.restaurant_id. Copy it at insert time.
session_id groups all orders from the same table visit.
The cashier sees a running total across all orders in
the session.
Closing a tab:

Set all orders with that session_id to status = 'closed'
Set tables.status = 'available'
Never delete any order data


On plan downgrade: never delete data. Only flip the plan
column on the restaurants row.
Reserved slugs — never allow as restaurant slugs:
dashboard, admin, login, signup, settings, billing,
api, health, static, assets, null, undefined


UI customization by plan
free:       Zero customization. Default platform UI only.
basic:      Logo upload + accent color only.
pro:        Full white-label. Owner controls all branding
through the dashboard. Platform branding disappears.
enterprise: Fully custom. Built by us to their exact spec.
Custom fonts, layouts, fully bespoke if they want.
The menu page must be built with theming in mind from Phase 1.
Even Free restaurants see the default theme. The component
architecture must read from the restaurant's branding config
so swapping in a custom theme later requires zero structural
changes.

Language rules
MVP supports English (en) and Greek (el) only.
menu_items.name and description are jsonb: {"en":"...","el":"..."}
Always fall back to 'en' if a language key is missing.
The customer's browser language is auto-detected on menu load.
A manual language switcher is always visible to the customer.

Role → route map
cashier  → /[slug]/cashier
owner    → /[slug]/dashboard
admin    → /admin
IMPORTANT: kitchen and bar roles do not exist. Never create
routes, accounts, or redirects for kitchen or bar staff.
The only staff-facing screen in a restaurant is the cashier
screen on the iPad. Everything else is handled by printers.

URL structure
Customer menu:    https://app.domain/[slug]?table=[number]
Cashier screen:   https://app.domain/[slug]/cashier
Owner dashboard:  https://app.domain/[slug]/dashboard
Master admin:     https://app.domain/admin
app.domain is a placeholder. Replace when the domain is decided.
Pages that do NOT exist and must never be created:

/[slug]/kitchen  (no kitchen screen)
/[slug]/bar      (no bar screen)


Hardware context
iPad (one per restaurant, leased at €30/mo)

Permanently stationed at the cashier position
Plugged in at all times, never moved, never taken home
Runs Safari permanently open on /[slug]/cashier
Runs QZ Tray permanently in the background as print server
Session must silently refresh every 10 minutes via a
client-side interval on the cashier page to prevent
logout on an idle iPad mid-service
Screen auto-lock disabled, guided access enabled
Set up once by hardware team during restaurant onboarding

Kitchen and bar

No screens, no logins, no accounts, no routes
Kitchen staff receive food-only order slips from the
kitchen thermal printer automatically
Bar staff receive drink-only order slips from the bar
thermal printer automatically
Printers fire the moment a customer places an order
The printed slip is the only interface kitchen and bar have
No human interaction is needed for printing to happen

Thermal printers (3 per restaurant)

Cheap Chinese WiFi thermal printers (Xprinter, RONGTA etc.)
All three connected to restaurant WiFi with static local IPs
QZ Tray on the iPad routes ESC/POS commands to each printer
Kitchen printer: food items only (type = 'food')
Bar printer: drink items only (type = 'drink')
Cashier printer: full bill with all items, quantities, totals
Every printed slip includes: order number, table number, time
All three slips from the same order share the same order
number so they can be cross-referenced by staff
QZ Tray WebSocket runs on localhost:8181 on the iPad

NFC and QR table stands

Each table has a plastic stand with a printed QR code on
one face and a passive NFC sticker on the other
QR and NFC both encode the exact same URL:
https://app.domain/[slug]?table=[number]
Customer scans QR with phone camera or taps NFC sticker
Both open the menu instantly in the customer's browser
No app download required, no account needed
iPad never reads NFC — customers use their own phones
NFC stickers are written once by hardware team at setup


Supabase client rules
Always use the correct client for the context:

/lib/supabase/client.ts → browser, client components only
/lib/supabase/server.ts → server components, API routes
/lib/supabase/middleware.ts → middleware.ts only

Never use the service role key in client-side code.
Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
Service role key is used only in server-side scripts and
API routes that require cross-restaurant or admin access.

Tailwind design tokens
Always use these tokens. Never hardcode hex values.
Colors:
brand-50 → brand-900 (warm off-white to near-black)
accent-400 (gold), accent-500 (hover), accent-600 (active)
Shadows:
shadow-premium, shadow-card, shadow-elevated
Animations:
animate-fade-in     (320ms, items appearing)
animate-fade-up     (400ms, page sections)
animate-scale-in    (280ms, modals, cards)
animate-slide-right (350ms, drawers)
animate-shimmer     (skeleton loading)
Fonts:
font-sans     → Inter (body, UI, labels)
font-display  → Playfair Display (hero text, menu headings)

Animation approach
Framer Motion:

Page transitions between routes
Cart drawer open/close (spring physics)
Cart item add/remove (layout animation)
Order placed confirmation sequence
Anything with choreographed multi-step motion

AutoAnimate (@formkit/auto-animate):

Cashier screen tab item list (items being added)
Any simple list that gains or loses items

Rule: if it is a list that changes, use AutoAnimate.
If it requires choreography or physics, use Framer Motion.

Premium animation moments (build these deliberately)

Menu page load — items cascade in from below, 40ms stagger
between each card
Add to cart — item card pulses scale 1.02 then back,
cart badge springs in from scale 0
Cart drawer — slides in from right with spring physics
stiffness 300, damping 30
Cart item remove — row shrinks to height 0 with opacity 0
over 250ms before DOM removal
Order placed — SVG checkmark draws itself via stroke
animation, order number counts up with spring
New order on cashier screen — card slides in, subtle
highlight fades out over 2 seconds
Cashier tab total — number rolls up smoothly with spring,
never jumps


Subscription plans
free:       €0/mo — digital menu + QR only, no ordering
basic:      €59/mo — ordering + notifications, software only
pro:        €129/mo — full ordering + payments + iPad + printers
enterprise: €490/mo — everything + custom hardware + white glove
Hardware bundle is included in Pro and Enterprise only.
Basic is software-only — client uses their own setup.
Stripe Billing dunning flow:

7 days before renewal: warning email via Resend
3 days before renewal: urgent warning email
Payment fails: immediate downgrade to free (flip plan only)
Payment restored: immediate full restoration (flip plan only)
Data is NEVER deleted on downgrade under any circumstance


Order flow (end to end)

Customer scans QR or taps NFC on table stand
Menu opens in customer's browser with correct table number
already known from the URL query param
Customer browses menu, adds items to cart
Customer places order (Stripe checkout or cash)
Order and order_items rows created in Supabase
Supabase Realtime fires simultaneously to:

Cashier screen on iPad (full order + running tab)
QZ Tray on iPad (triggers all 3 printers)


Kitchen printer fires automatically (food items only)
Bar printer fires automatically (drink items only)
Cashier printer fires automatically (full bill)
Kitchen staff picks up printed slip and cooks
Bar staff picks up printed slip and makes drinks
Cashier manages payment and closes tab when done
Closing tab sets all session orders to 'closed' and
resets tables.status to 'available'


What has been built (update after each phase)
### Phase 0 — COMPLETE

All 6 Supabase tables deployed with RLS, indexes, Realtime
staff.role CHECK constraint: owner|cashier|admin only
Next.js 14 App Router scaffold on Vercel
Tailwind design system with custom brand/accent tokens
Framer Motion + AutoAnimate installed
Supabase Auth with role-based redirects in middleware
Login page at /login — functional
Three Supabase client files configured
CLAUDE.md created and populated
.cursorrules created and populated
Test restaurant seeded: 5 tables, 8 menu items (4 food, 4 drink)
Staff accounts active: cashier@test.com, owner@test.com
No kitchen or bar accounts — not needed (printer-only)

### Phase 1 — COMPLETE (March 2026)
- Migration 002 applied: customer_name, customer_phone on orders,
  stripe_account_id on restaurants, session_id index
- Stripe Connect create-payment-intent route (server-side, with
  application_fee_amount 0.25%)
- Webhook handler with idempotency check (prevents duplicate orders)
- Order fetch route
- Menu page: category browsing, item cards (image + text fallback),
  language switcher (en/el), auto-detects browser language
- Cart hook + cart drawer (Framer Motion spring animation)
- Per-item optional notes field (stored in order_items.notes)
- Checkout screen: name + phone (Greek and international validation)
- Payment page: Stripe Elements with Stripe Connect
- Dev-mode bypass: charges platform account when stripe_account_id
  is null and NODE_ENV=development (blocked in production)
- Confirmation screen: order number, "Order More" button always visible
- Full flow tested: menu → cart → checkout → payment → confirmation
- Order and order_items correctly created in Supabase via webhook
- Decisions locked: D30 (domain TBD), D31 (phone validation),
  D32 (per-item notes), D33 (Order More always visible)


### ### Phase 2 — COMPLETE (March 2026)
- Cashier screen built at /[slug]/cashier
- Split view layout: tables left panel, tab detail right panel
- Left panel: occupied tables with running total, order count,
  time of first order, amber dot indicator
- Right panel: full tab detail, all orders per session,
  order items with name snapshot, quantity, notes, line total
- Mark as Ready: sets order status to 'ready', updates badge instantly
- Close Tab: confirmation modal, sets all session orders to 'closed',
  sets table to 'available'
- Supabase Realtime: 3 channels (orders, order_items, tables)
  all working — new orders appear on cashier without refresh
- Session refresh: silent every 10 minutes, prevents idle logout
- Fixed: client/server import boundary split (index.server.ts
  and index.client.ts)
- Fixed: webhook path corrected to /api/webhooks/stripe
- Fixed: Supabase Realtime enabled on orders, order_items, tables
- Fixed: confirmation page polling resolves correctly on 200
- Decisions locked: D34–D39


###### Phase 3 — COMPLETE (March 2026)
- ESC/POS slip generation: kitchen (food only), bar (drink only),
  cashier (all items + total)
- QZ Tray WebSocket client at ws://localhost:8181
- printOrder() uses Promise.allSettled — partial printer failure
  never crashes the cashier screen
- Print triggered automatically from CashierScreen onOrderChange
  INSERT handler — no human interaction required
- /api/orders/mark-printed route sets printed_at = now() on success
- Printer IPs stored in restaurants.metadata.printers (not env vars)
  — scales automatically to any number of restaurants
- Hardware friend sets 3 IPs once during onboarding via Phase 5
- Physical print test deferred until hardware is available
- Decisions locked: D40–D46


### Phase 4 — COMPLETE (April 2026)
What Was Built

Web Push API with VAPID keys for staff (cashier + owner)
Push fires on: new order placed, order marked ready, tab closed
Push subscriptions stored in push_subscriptions Supabase table
Weekly email report via Resend — every Monday 10:00 AM Athens time (Pro plan only)
Cron job via Vercel Cron — failures logged to cron_failures table, retried once after 30 minutes
Confirmation screen polls for order status and shows "Your order is ready 🎉" when ready
Service worker at public/sw.js handles push display and notification click

What Was Removed

Twilio/SMS entirely removed — lib/sms/index.ts deleted
Customer push notifications removed — confirmation screen polling used instead
app/api/push/customer-subscribe/route.ts deleted

Key Decisions

D47: Cashier iPad must run cashier screen as PWA added to Home Screen — mandatory for push on iOS Safari
D48: SMS/Twilio removed entirely — replaced by Web Push API for staff
D49: Customer push removed — confirmation screen polls and shows ready status inline
D50: Login is restaurant-specific at /[slug]/login — no generic /login route

Technical Notes

VAPID keys: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_SUBJECT
Push works on Firefox and Safari PWA — Brave/Chrome has FCM issues
subscriber_type column on push_subscriptions: 'staff' only
Weekly email skips restaurants with zero orders
Cron expression: 0 8 * * 1 (08:00 UTC = 10:00 Athens)

Migrations Applied

003_phase4_notifications.sql — push_subscriptions table, customer_locale, sms columns on orders
004_cron_failures.sql — cron_failures table
005_customer_push.sql — order_id, subscriber_type on push_subscriptions, confirmed_push_sent on orders
Unique constraint added on push_subscriptions.endpoint
RLS policies: separate INSERT/SELECT/DELETE for staff

Deployment

Live at: https://trapeziapp.com
Stripe webhook: Connected accounts webhook for payment_intent.succeeded
STRIPE_WEBHOOK_SECRET updated on Vercel with connected accounts webhook secret
stripe_account_id set on test-restaurant in Supabase


### Phase 5a — Menu Management (COMPLETE)

### New Tables (migration 006_phase5a_menu_management.sql)
- `categories` — per-restaurant, bilingual, drag-to-reorder
- `menus` — each restaurant has one default menu; Pro can have multiple
- `menu_schedules` — time windows per day of week per menu (Europe/Athens)
- `menu_item_assignments` — junction: item ↔ menu, with per-menu `available` boolean
- `upsell_suggestions` — up to 2 suggestions per item, Pro only
- `happy_hour_rules` — percentage or fixed discount, time-windowed, Pro only
- `happy_hour_item_assignments` — items assigned to a happy hour rule

### Columns added to menu_items
- `name_el`, `name_en`, `description_el`, `description_en` — bilingual content
- `image_url` — public URL from Supabase Storage (bucket: menu-images)
- `allergens text[]`, `dietary text[]`
- `category_id uuid` FK → categories (nullable)
- `deleted_at timestamptz` — soft delete, never hard delete menu items

### New Files
- `lib/menu/translate.ts` — DeepL Free API utility, server-side only
- `lib/menu/active-menu.ts` — active menu resolution logic (plan-aware, timezone-aware)
- `lib/types/menu.ts` — all Phase 5a TypeScript types
- `app/api/menu/*` — full CRUD routes for items, categories, menus, schedules, upsells, happy hour
- `app/api/menu/active/route.ts` — public endpoint, returns active menu with discounted prices
- `app/api/menu/translate/route.ts` — server-side DeepL proxy
- `app/[slug]/owner/layout.tsx` — authenticated owner layout with sidebar
- `app/[slug]/owner/menu/page.tsx` — menu management UI (Items, Categories, Menus, Upsells, Happy Hour tabs)

### Key Decisions
- Soft delete only — deleted_at column, never hard delete items (preserves order history)
- Translation via DeepL Free API (DEEPL_API_KEY env var) — fires on save, stored in DB, never on page load
- Translation failure is non-blocking — item saves, warning shown to owner
- Images stored as originals in Supabase Storage; customer pages request compressed via Supabase transforms (?width=400&quality=80)
- Item availability is per-menu via menu_item_assignments.available (not global)
- Cashier can toggle availability from cashier screen (RLS allows cashier role to UPDATE menu_item_assignments)
- Active menu logic: Pro = schedule-aware; Basic/Free = default menu only
- No schedule active → all items from all menus merged and deduplicated
- Happy hour discount validated server-side in create-payment-intent — client price never trusted
- Upsell popup: fires before payment, max 4 suggestions, deduplicated, prioritised by most expensive cart item
- Unavailable items show greyed out on customer page — not orderable but still visible

### Environment Variables Added
- `DEEPL_API_KEY` — DeepL Free API key (Vercel + .env.local)

### Supabase Storage
- Bucket: `menu-images` (public)
- Path pattern: [restaurant_id]/[item_id]/[timestamp].[ext]

### Plan Gating
- Free + Basic + Pro: item CRUD, categories, images, allergens, dietary, translation
- Basic + Pro: item availability toggle
- Pro only: multiple menus, scheduling, upsells, happy hour

### Phase 5b - — Analytics & Reporting (COMPLETE)

### New Migration
- `007_phase5b_analytics.sql` — indexes on orders.created_at and
  (restaurant_id, created_at), manager role added to staff.role
  constraint, RLS policies updated for manager role across all tables,
  SECURITY DEFINER function rebuilt to fix infinite recursion bug

### Manager Role
- New valid value in staff.role: 'owner' | 'cashier' | 'manager'
- Manager has full owner dashboard access — menu management + analytics
- All RLS policies updated to role IN ('owner', 'manager') for read
  and write on menu + analytics tables
- Owner layout auth guard updated to allow manager role

### New API Routes
- /api/analytics/orders — paginated filtered order history
- /api/analytics/metrics — KPI cards (Pro only)
- /api/analytics/best-sellers — top items + categories (Pro only)
- /api/analytics/heatmap — peak hours grid (Pro only)
- /api/analytics/revenue-chart — daily/hourly revenue series (Pro only)
- /api/analytics/export — single .xlsx file with two sheets (Pro only)
- /api/analytics/stripe-dashboard-link — Stripe Express login link (Pro only)
- /api/analytics/report-settings — GET/PATCH weekly report preferences (Pro only)

### New Files
- lib/analytics/queries.ts — all DB query functions for analytics
- lib/types/analytics.ts — TypeScript types for all analytics data
- app/[slug]/owner/analytics/page.tsx — analytics UI with 4 tabs:
  Overview, Order History, Payouts, Reports

### Key Decisions
- Basic plan: order history locked to last 7 days, enforced server-side
- Pro plan: unlimited order history, all analytics features
- Export: single .xlsx file with two sheets (Orders + Order Items)
  using ExcelJS — no zip, no CSV, Greek characters render correctly
- Stripe Payouts tab: generates fresh Stripe Express Dashboard login
  link on every click via stripe.accounts.createLoginLink()
  Note: only works for Express connected accounts — Standard accounts
  (used in test mode) will show an error, expected behaviour
- Weekly report cron updated to check
  restaurants.metadata.weekly_report_enabled before sending
- Weekly report recipient reads from
  restaurants.metadata.weekly_report_email, falls back to owner email
- Analytics timezone: Europe/Athens for all heatmap and chart grouping
- WoW change: compares current period vs equivalent prior period,
  null if no prior data

### Dependencies Added
- exceljs — server-side Excel file generation

### Bugs Fixed
- RLS infinite recursion re-introduced by migration 008 — fixed by
  rebuilding current_user_is_owner_or_manager_of_restaurant() as
  SECURITY DEFINER function following migration 003 pattern
- parseInt on non-numeric tableNumber returning NaN passed to Supabase
  — fixed with isNaN guard in orders route
- Frontend download handler saving .xlsx as .zip — fixed MIME type
  and filename extension in export button click handler

  
### ## Phase 5c — Staff, Settings & Onboarding (COMPLETE)

### New Migration
- `009_phase5c_staff_settings.sql` — added pin_hash, 
  failed_pin_attempts, locked_until, deleted_at to staff table;
  created sections table with RLS; added name, capacity, 
  section_id, deleted_at to tables table

### Authentication Model
- Full login: email + password via Supabase Auth
- Passwords auto-generated by owner dashboard, never set by staff
- PIN lock screen activates after configurable inactivity timeout
- Cashier: PIN lock only, NEVER auto-logged out — only manual 
  "End Service" with PIN confirmation
- Owner/Manager: PIN lock escalates to full logout after 5 
  failed attempts
- PINs stored as bcrypt hash — never plain text in DB

### Staff Management
- Owner creates staff with auto-generated password + 4-digit PIN
- Both shown once at creation and on reset — owner hands to staff
- Staff cannot self-manage credentials
- Max 1 cashier, max 1 manager per restaurant; unlimited owners
- Soft delete on staff — deleted_at column

### Branding
- Logo upload to Supabase Storage bucket: restaurant-assets
- Logo color extraction via ColorThief + Jimp — auto-populates 
  accent and secondary color on upload
- Dashboard theming (Option B): sidebar header = accent color,
  active nav item = accent color highlight, primary buttons = 
  accent color, sidebar body stays neutral
- Pro: font selection, secondary color, confirmation message,
  receipt header/receipt footer
- Branding applied to customer menu via CSS custom properties

### Settings
- Printer IPs: owner-configurable from Settings → Printers
- Inactivity timeout: 5/10/15/20/30 min, stored in 
  restaurants.metadata.inactivity_timeout_minutes
- Default timeout: 15 minutes, applies to all roles

### Tables & Sections
- Tables: number, name (optional), capacity (optional), 
  section assignment (optional)
- Sections: Pro only, collapsible groupings on cashier screen
- Soft delete on tables — blocked if open tab exists

### Onboarding Guide
- 5-step visual checklist in Settings → Onboarding
- Checkbox state persisted in localStorage per device

### Supabase Storage Buckets
- menu-images (public) — menu item photos
- restaurant-assets (public) — restaurant logos

### Dependencies Added
- lucide-react — icons
- bcryptjs — PIN hashing
- colorthief — logo color extraction
- jimp — image processing for color extraction

### Key Notes
- Never run npm audit fix --force — audit warnings are false 
  positives from internal Next.js sub-dependencies already 
  patched in Next.js 15/16
- Logout button in owner sidebar — calls supabase.au


### Phase 6 — Subscriptions (completed)
SUBSCRIPTION PLANS (update Basic price)
PlanPriceiPadFree€0/mo❌Basic€69/mo✅ Included (pre-configured)Pro€129/mo✅ Included (pre-configured)

DATABASE — new columns on restaurants
contract_start_date     TIMESTAMPTZ
stripe_customer_id      TEXT
stripe_subscription_id  TEXT
subscription_status     TEXT  -- 'active' | 'past_due' | 'cancelled'  DEFAULT 'active'
current_period_end      TIMESTAMPTZ
dunning_day             INTEGER  DEFAULT 0
Migration: 010_phase6_billing.sql applied via npx supabase db push

WHAT IS BUILT — Phase 6: Subscriptions & Billing
Backend

Plan gating utility lib/plans/gates.ts — planAtLeast(), effectivePlan(), requirePlan()
Lease calculation lib/billing/lease.ts — earlyExitFee(), contractEndDate(), LEASE_MONTHLY_WITH_VAT = €21.08
Dunning notifications lib/billing/dunning.ts — push + Resend email with Stripe portal link
Stripe billing event handler lib/billing/webhook-handler.ts — handles invoice.payment_succeeded, invoice.payment_failed, customer.subscription.deleted, customer.subscription.updated
Types lib/types/billing.ts — Plan, SubscriptionStatus, BillingInfo
POST /api/admin/activate-subscription — manual onboarding, auth via CRON_SECRET
GET /api/billing/info — returns full billing info + early exit fee calculation
GET /api/billing/portal — generates one-time Stripe Customer Portal URL
POST /api/cron/dunning — daily cron at 09:00 UTC, increments dunning_day, cancels on day 10
Stripe webhook extended with dual-secret routing (billing vs. connected-account events)
Plan gates added to: create-payment-intent (basic+), staff creation (pro), all analytics routes (pro), menu/menus POST (pro), menu schedules (pro), export (pro), weekly report (pro), Stripe login link (pro)
One-time setup script scripts/stripe-setup.ts — creates Stripe products + prices, writes IDs to .env.local

Frontend

app/[slug]/owner/billing/page.tsx — Billing tab route
components/owner/billing/BillingHub.tsx — plan card, contract card, early exit fee, actions card, free plan comparison view
components/owner/PlanGate.tsx — <PlanGate> and <PlanGateAuto> (reads context); shows lock + upgrade card for underprivileged plans
components/owner/PastDueBanner.tsx — sticky global banner when subscription_status = 'past_due', shows days remaining + portal button
Owner layout extended with billing fields fed through existing OwnerRestaurantProvider
PlanGateAuto applied to: MenusTab, UpsellsTab, HappyHourTab, AnalyticsHub (Overview/Payouts/Reports), Export button, Sections panel, Add Staff button


LOCKED DECISIONS — Phase 6 additions
#DecisionD51iPad included in Basic (price raised €59 → €69/mo)D52iPad pre-configured by hardware friend for all paid plansD53Upgrades/downgrades go through Kostas manually — no self-serve UID54Downgrade takes effect at end of billing periodD55iPad lease cost hardcoded at €17/mo ex-VAT (€21.08 incl. VAT)D56Dunning: 10-day window, Stripe retries day 3/6/9, lock day 10D57Dunning notifications: push + email (Resend) daily with countdownD58Feature lock on cancellation is immediateD59Contract tracking stored as columns on restaurants tableD60Cancellation goes through Kostas — no self-serve cancellation UI

NEW FILES — Phase 6
FilePurposelib/plans/gates.tsPlan gating utilitylib/billing/lease.tsLease cost + early exit fee calculationlib/billing/dunning.tsDunning push + email notificationslib/billing/webhook-handler.tsStripe billing event handlerlib/types/billing.tsBilling typesapp/api/admin/activate-subscription/route.tsManual onboarding APIapp/api/billing/info/route.tsBilling info APIapp/api/billing/portal/route.tsStripe Customer Portal linkapp/api/cron/dunning/route.tsDaily dunning cronscripts/stripe-setup.tsOne-time Stripe product/price setupapp/[slug]/owner/billing/page.tsxBilling page routecomponents/owner/billing/BillingHub.tsxBilling page UIcomponents/owner/PlanGate.tsxPlan gate + PlanGateAuto componentscomponents/owner/PastDueBanner.tsxGlobal past-due warning banner

ENVIRONMENT VARIABLES — additions
STRIPE_PRICE_BASIC=price_xxx
STRIPE_PRICE_PRO=price_xxx
STRIPE_BILLING_WEBHOOK_SECRET=whsec_xxx

VERCEL CRON — additions
json{ "path": "/api/cron/dunning", "schedule": "0 9 * * *" }

REMAINING MANUAL STEP (one-time)
Stripe Dashboard → Settings → Billing → Automatic collection → set retry schedule to Day 3, Day 6, Day 9.

BUGS FIXED POST-PHASE 6
- app/[slug]/owner/settings/page.tsx — setLayoutBranding called with 
  callback pattern but typed as direct value setter. Fixed all occurrences 
  to use layoutBranding directly instead of prev arrow functions.
And add a new section for the rebrand:
PLATFORM REBRAND (post-Phase 6)
- Tailwind color palette: brand scale (navy #072E5A → ice white #F0F6FC), 
  accent scale (Greek flag blue #1D6FBF)
- Fonts: Playfair Display (font-display, headings) + DM Sans (font-sans, body)
- Logo: public/logo.png — white Trapezi wordmark, transparent background
- Gradient background on app/page.tsx, app/[slug]/page.tsx, 
  app/[slug]/login: radial glow #3F9EF4 top-right + linear 
  #216AB7 → #0D4386 → #082A63 → #020B33
- Login card logo color: CSS filter targeting #0D4386




### Phase 7a Admin Shell, Auth & Restaurant List (Completed)
 WHAT IS BUILT — Phase 7a: Admin Shell, Auth & Restaurant List
Backend

Service role Supabase client lib/supabase/admin.ts — bypasses RLS, server-only
Admin TypeScript types lib/types/admin.ts
Admin auth guard lib/admin/auth.ts — requireAdmin() used in all admin API routes
One-time admin account creation script scripts/create-admin.ts
GET /api/admin/restaurants — all restaurants with computed counts (staff, menu items, tables, orders 30d, revenue 30d)
POST /api/admin/restaurants — creates restaurant + owner Supabase Auth account + activates Stripe subscription
GET /api/admin/restaurants/[restaurantId] — full restaurant detail (all related data in parallel)
Middleware extended: detects dashboard.trapeziapp.com subdomain, rewrites to /admin/* routes, guards all non-login routes with admin role check

Frontend

app/admin/login/page.tsx — admin login, gradient background, role check, Greek copy
app/admin/layout.tsx — neutral wrapper (login stays public)
app/admin/restaurants/layout.tsx — server auth guard + <AdminShell> wrapper
app/admin/restaurants/page.tsx — restaurant list server component
app/admin/restaurants/[restaurantId]/page.tsx — restaurant detail server component
app/admin/page.tsx — redirects /admin → /restaurants
components/admin/AdminShell.tsx — navy sidebar, logo, nav (Analytics + Settings disabled), logout
components/admin/RestaurantList.tsx — searchable/filterable table, plan/status badges, skeleton loading
components/admin/NewRestaurantForm.tsx — slide-over panel, repeatable printer IPs, success modal with one-time password + copy button
components/admin/RestaurantDetail.tsx — 6 tabs: Επισκόπηση, Προσωπικό, Μενού, Τραπέζια, Παραγγελίες, Branding. Read-only. Edit button disabled (Phase 7c).


ADMIN PANEL

URL: dashboard.trapeziapp.com
Login: dashboard.trapeziapp.com/login
Admin account: kabaniskostasIT@gmail.com
Access: Only role = 'admin' staff with restaurant_id = null
Internal routes: app/admin/* — rewritten by middleware from subdomain


KEY ARCHITECTURAL DECISIONS — Phase 7a
DecisionValueAuth guard locationapp/admin/restaurants/layout.tsx — NOT app/admin/layout.tsx (avoids login redirect loop)DB accesslib/supabase/admin.ts service role client — bypasses RLSSubdomain routingMiddleware rewrites dashboard.trapeziapp.com/* → /admin/* internallyAdmin desktop-onlyNo mobile responsiveness needed for admin panel

SCHEMA NOTES (discovered Phase 7a)

staff.display_name — column is display_name, NOT name
sections.display_order — column is display_order, NOT position


NEW FILES — Phase 7a
FilePurposelib/supabase/admin.tsService role Supabase clientlib/types/admin.tsAdmin TypeScript typeslib/admin/auth.tsrequireAdmin() guardscripts/create-admin.tsOne-time admin account creationapp/api/admin/restaurants/route.tsGET all + POST new restaurantapp/api/admin/restaurants/[restaurantId]/route.tsGET full restaurant detailapp/admin/login/page.tsxAdmin login pageapp/admin/layout.tsxNeutral admin layout wrapperapp/admin/restaurants/layout.tsxAuth guard + AdminShell wrapperapp/admin/restaurants/page.tsxRestaurant list pageapp/admin/restaurants/[restaurantId]/page.tsxRestaurant detail pageapp/admin/page.tsxRedirect /admin → /restaurantscomponents/admin/AdminShell.tsxAdmin sidebar + layoutcomponents/admin/RestaurantList.tsxRestaurant list tablecomponents/admin/NewRestaurantForm.tsxNew restaurant slide-over + success modalcomponents/admin/RestaurantDetail.tsxRestaurant detail 6-tab view

MODIFIED FILES — Phase 7a
FileChangemiddleware.tsAdded subdomain block for dashboard.trapeziapp.com at the top — existing slug routing untouched

DNS

dashboard.trapeziapp.com CNAME added in Papaki.com pointing to 06f5826c823a1dbf.vercel-dns-017.com
Domain added in Vercel → trapezi-app project → Domains


### Phase 7b - not yet started
### Phase 7c - not yet started
### Phase 7d - not yet started


How to work with me
When I ask you to build something:

Read this entire file first
Check which phase the feature belongs to
Use the correct Supabase client for the context
Use Tailwind tokens, never hardcode hex values
Apply the correct animation library (see above)
Never violate the business rules section
Never create kitchen or bar routes, accounts, or roles
When touching more than 3 files, list them first
and confirm before writing code

When I report an error:

Ask for the full error message
Ask which file it occurred in
Ask what I was trying to do when it happened

Never suggest a new package without explaining why the
existing stack cannot handle the requirement.
When a phase is completed, remind me to update the
"What has been built" section of this file.