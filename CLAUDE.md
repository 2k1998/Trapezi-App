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


### Phase 4 — not yet built
### Phase 5 — not yet built
### Phase 6 — not yet built
### Phase 7 — not yet built

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