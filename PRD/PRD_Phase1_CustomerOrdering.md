# PRD — Phase 1: Customer Ordering Experience

**Project:** QR/NFC Table Ordering SaaS Platform
**Phase:** 1 of 7
**Owner:** Coding
**Status:** Ready to build
**Last updated:** March 2026 (v1)
**Tools:** Cursor (UI) · Claude Code (logic) · Supabase · Stripe · Next.js · Tailwind CSS · Vercel
**Depends on:** Phase 0 complete ✅

---

## Decisions Log

All decisions below were locked before this PRD was written.

| # | Decision | Detail |
|---|---|---|
| D1 | Payment timing | Customer pays via Stripe at order time. Order is only sent to kitchen/bar/cashier after payment is confirmed. |
| D2 | Customer info | Customer provides name and phone number before checkout. No account creation. |
| D3 | Multiple orders | Customer can order again from the same table. Each new order adds to the same running tab. |
| D4 | Post-order screen | Simple confirmation screen showing the order number. No live status tracking in Phase 1. |
| D5 | Menu images | Show image if available. Fall back to a styled text-only card if no image is set. |

---

## 1. Purpose

Phase 1 builds the entire customer-facing ordering experience —
everything a restaurant guest sees and interacts with from the
moment they scan a QR code or tap an NFC sticker to the moment
they see their order confirmation.

This is the most visible and premium part of the product. It is
what restaurant owners demo to decide whether to pay for it. It
is what their customers use every single day. It must feel
extraordinary.

---

## 2. Goals

- Build the animated multi-language menu page
- Build the cart system with premium Framer Motion interactions
- Build the customer info collection screen (name + phone)
- Build the Stripe checkout flow (card, Apple Pay, Google Pay)
- Build the order placement API with three simultaneous signals
- Build the order confirmation screen
- Ensure the entire flow works end to end on mobile

---

## 3. Non-Goals (explicitly out of scope for Phase 1)

- No cashier screen (Phase 2)
- No thermal printer integration (Phase 3)
- No Web Push notifications (Phase 4)
- No SMS confirmation via Twilio (Phase 4)
- No restaurant dashboard or menu management (Phase 5)
- No subscription billing (Phase 6)
- No delivery or takeaway flow
- No coupon or discount codes
- No order modification after placement
- No tip functionality

---

## 4. User Flow (end to end)

```
Customer scans QR or taps NFC on table stand
              ↓
Menu page loads with correct restaurant and table number
(slug from URL path, table number from ?table= query param)
              ↓
Customer browses menu — filtered by category,
language auto-detected, manual switcher always visible
              ↓
Customer adds items to cart
(cart persists in localStorage keyed by restaurant + table)
              ↓
Customer taps "View Order" to open cart drawer
              ↓
Customer reviews cart, adjusts quantities, removes items
              ↓
Customer taps "Place Order"
              ↓
Customer info screen — enters name and phone number
              ↓
Stripe checkout — card, Apple Pay, or Google Pay
              ↓
Payment confirmed by Stripe webhook
              ↓
Order and order_items rows created in Supabase
              ↓
Three simultaneous signals fire:
  → Supabase Realtime event (for cashier screen in Phase 2)
  → Print trigger queued (for Phase 3)
  → Confirmation screen shown to customer
              ↓
Customer sees confirmation screen with order number
              ↓
"Order more" button returns to menu — new items add to same tab
```

---

## 5. Pages and Components

### 5.1 Menu Page — `/app/[slug]/page.tsx`

This is the most important page in the product. It is the first
thing a customer sees. It must load fast, look premium, and feel
effortless to use on a phone.

**Data fetching (server component):**
- Read `slug` from URL params
- Read `table` from URL search params
- Fetch restaurant row from Supabase (name, languages,
  default_language, accent_color, logo_url, plan)
- Fetch all menu_items where restaurant_id matches and
  is_available = true, ordered by category then sort_order
- If slug not found or is_active = false, return notFound()
- If table param is missing or invalid, show a gentle error
  state — do not crash

**Language detection:**
- On client mount, read navigator.language
- Match against restaurant.languages array
- If match found, use it. If not, fall back to default_language
- Store the selected language in localStorage so it persists
  if the customer navigates back

**Layout:**
- Restaurant logo at top (if set). If no logo, show
  restaurant name in font-display
- Language switcher in top right — only show if the restaurant
  has more than one language enabled
- Sticky category navigation bar below the header — horizontal
  scroll on mobile, one pill per category, active pill uses
  accent-400 color
- Menu items in a single-column list on mobile,
  two-column grid on tablet+
- Floating cart button fixed to the bottom of the screen
  showing item count and subtotal

**Menu item card:**
- If image_url is set: show image (16:9 ratio, object-cover,
  lazy loaded) with item name, description, price below
- If no image_url: show a styled text-only card with item name,
  description, and price. Use brand color tokens for background.
  Never show a broken image icon.
- Price is always shown VAT-inclusive with € symbol
- "Add" button on every card — tapping it adds one unit to cart
- If item is already in cart, show a quantity stepper
  (− quantity +) instead of the Add button
- Featured items (is_featured = true) get a subtle accent-400
  border and a small "Chef's pick" label

**Animation — menu page load (premium moment #1):**
- Category pills slide in from left with stagger
- Item cards fade up from below with 40ms stagger between
  each card using Framer Motion variants and staggerChildren
- The floating cart button scales in last after all cards

**Plan-based theming:**
- Free plan: default platform colors and fonts
- Basic plan: apply restaurant accent_color to category pills,
  active states, and the "Add" button
- Pro/Enterprise: apply full restaurant branding —
  accent color, logo, and eventually custom fonts (Phase 5)
- The menu page reads from the restaurant row and applies
  theming at render time. The component architecture must
  support theming from day one even if Free restaurants
  just see the default theme.

---

### 5.2 Cart State — `/lib/hooks/useCart.ts`

The cart lives in localStorage. It is keyed by
`cart_[slug]_[table_number]` so a customer at Table 4 of
bella-vista has a completely separate cart from Table 5.

**Cart item shape:**
```typescript
interface CartItem {
  menu_item_id: string
  name: string        // in the customer's current language
  name_en: string     // always English — for name_snapshot
  type: 'food' | 'drink'
  price: number
  quantity: number
  notes?: string
}
```

**Cart operations:**
- addItem(item) — add one unit, or increment if already present
- removeItem(menu_item_id) — remove entirely
- updateQuantity(menu_item_id, quantity) — set exact quantity,
  remove if quantity reaches 0
- clearCart() — empty the cart after successful order placement
- subtotal — computed from items
- itemCount — total units across all items

**Cart persistence:**
- On every change, write to localStorage
- On mount, read from localStorage and hydrate
- Cart is cleared automatically after a successful order

---

### 5.3 Cart Drawer — `/components/menu/CartDrawer.tsx`

Slides in from the right when the customer taps the floating
cart button. Overlays the menu page with a backdrop.

**Contents:**
- Header: "Your order" with a close button
- List of cart items — each row shows name, price, and a
  quantity stepper (− quantity +)
- Per-item notes field — small text input below each item
  for special requests (e.g. "no onions")
- Subtotal at the bottom
- "Place Order" CTA button — full width, accent-400 background

**Animation — cart drawer (premium moment #3):**
- Drawer slides in from right with Framer Motion spring
  physics: stiffness 300, damping 30
- Backdrop fades in simultaneously
- Item rows animate in with stagger using AnimatePresence
- When an item is removed, the row shrinks height to 0
  with opacity 0 over 250ms before DOM removal (moment #4)
- Quantity changes trigger a brief scale pulse on the
  price display

**Empty state:**
- If cart is empty and drawer is open, show a gentle message
  "Nothing here yet — tap + on any item to add it"

---

### 5.4 Customer Info Screen — `/app/[slug]/checkout/page.tsx`

Shown after "Place Order" is tapped in the cart drawer.
This is not a modal — it is a full page route.

**Fields:**
- Name (text input, required, placeholder "Your name")
- Phone number (tel input, required, placeholder "+30 69...")
- A brief line of copy: "So we can let you know when
  your order is ready"

**Validation:**
- Name: required, minimum 2 characters
- Phone: required, must be a valid phone number format
- Inline validation errors below each field on blur
- Do not submit if either field is invalid

**On submit:**
- Store name and phone in sessionStorage
  (not localStorage — cleared when browser closes)
- Navigate to /[slug]/payment

**Design:**
- Clean, minimal, centered card
- font-display for the heading "Almost there"
- Subtle animate-fade-up on mount
- "Continue to payment" button full width

---

### 5.5 Payment Page — `/app/[slug]/payment/page.tsx`

Hosts the Stripe Elements checkout experience.

**On page load:**
- Read cart from localStorage
- Read customer info from sessionStorage
- If either is missing, redirect back to /[slug]
- Call /api/orders/create-payment-intent to create a
  Stripe PaymentIntent with the correct amount
- Render Stripe Elements (card, Apple Pay, Google Pay)

**Stripe Elements setup:**
- Use @stripe/react-stripe-js and @stripe/stripe-js
- Payment methods: card, applePay, googlePay
- Appearance API: match the platform design system
  (brand colors, border radius, font)
- Show order summary above the payment form:
  list of items with quantities and prices, subtotal,
  total in bold

**On payment success:**
- Stripe calls the webhook at /api/webhooks/stripe
- Webhook creates the order and order_items in Supabase
- Fires the Supabase Realtime event
- Redirects customer to /[slug]/confirmation/[orderId]

**On payment failure:**
- Show Stripe's error message inline below the form
- Do not navigate away — let the customer try again

---

### 5.6 Order Confirmation Screen
`/app/[slug]/confirmation/[orderId]/page.tsx`

**Data fetching:**
- Fetch the order row by orderId
- Verify it belongs to the correct restaurant (slug match)
- If not found or not paid, redirect to /[slug]

**Contents:**
- Animated checkmark (SVG stroke animation — premium moment #5)
- "Order placed!" heading in font-display
- Order number in large type: "#42"
- Table number: "Table 4"
- List of items ordered with quantities
- Total paid
- "Order more" button — returns to /[slug] with the same
  table number. New orders add to the same tab.

**Animation — order confirmation (premium moment #5):**
- Full screen entrance with scale-in
- SVG checkmark path draws itself using strokeDashoffset
  animation over 600ms
- "Order placed!" fades up after the checkmark completes
- Order number counts up from 0 to the actual number
  using a spring-based counter
- Item list staggers in below

**Session continuity for "Order more":**
- When the customer taps "Order more", they return to the
  menu page
- The existing session_id is stored in sessionStorage
- When they place another order, the same session_id is
  reused so the cashier sees both orders on the same tab

---

## 6. API Routes

### 6.1 POST `/api/orders/create-payment-intent`

Called by the payment page before rendering Stripe Elements.

**Request body:**
```typescript
{
  slug: string
  table_number: number
  items: Array<{
    menu_item_id: string
    quantity: number
    notes?: string
  }>
  customer_name: string
  customer_phone: string
}
```

**Server-side validation:**
- Verify slug exists and is_active = true
- Verify table_number exists for that restaurant
- Verify each menu_item_id belongs to that restaurant
  and is_available = true
- Verify all prices server-side — never trust client prices
- Recalculate subtotal and total from database prices
- If any validation fails, return 400 with a clear message

**On success:**
- Create a Stripe PaymentIntent with the calculated total
- Store order metadata in PaymentIntent metadata:
  slug, restaurant_id, table_id, table_number,
  customer_name, customer_phone, session_id,
  items as JSON string
- Return: { clientSecret, total, orderId (pending) }

**Why validate server-side:**
Never trust the price sent from the client. A customer could
modify the cart in their browser and send a €0 total. Always
recalculate from the database.

---

### 6.2 POST `/api/webhooks/stripe`

Called by Stripe after payment is confirmed. This is where
the order is actually created in Supabase.

**Stripe event to handle:** `payment_intent.succeeded`

**Steps in order:**
1. Verify Stripe webhook signature using
   STRIPE_WEBHOOK_SECRET — reject if invalid
2. Extract metadata from the PaymentIntent
3. Parse items from metadata JSON
4. Generate order_number (max order_number for this
   restaurant today + 1, using restaurant timezone)
5. Generate session_id if not present in metadata,
   or reuse existing one if customer is ordering again
6. Insert order row into Supabase using service role key
7. Insert order_items rows — copy type and restaurant_id
   from menu_items at insert time (denormalization rule)
   and set name_snapshot from the English name
8. Update tables.status to 'occupied'
9. Update order.printed_at will be set by Phase 3 —
   leave null for now
10. Return 200 immediately — do not do slow operations
    synchronously in the webhook handler

**Error handling:**
- If any database insert fails, log the error with the
  PaymentIntent ID so it can be manually recovered
- Never return a non-200 to Stripe unless the signature
  check fails — Stripe will retry on non-200 responses
  which can cause duplicate orders

---

### 6.3 GET `/api/orders/[orderId]`

Called by the confirmation screen to fetch order details.

**Returns:**
- order row (id, order_number, table_id, total, status,
  created_at)
- order_items rows (name_snapshot, quantity, unit_price,
  line_total, type)
- table row (table_number)

**Security:**
- Verify the order's restaurant_id matches the slug
  in the request — prevents customers from accessing
  other restaurants' order data

---

## 7. Supabase Schema Additions

No new tables needed for Phase 1. Two columns need to be
added to existing tables:

**Add to `orders` table:**
```sql
ALTER TABLE orders
ADD COLUMN customer_name text,
ADD COLUMN customer_phone text;
```

**Add migration file:**
`/supabase/migrations/002_phase1_additions.sql`

This migration also updates the staff.role CHECK constraint
to remove kitchen and bar if not already done:
```sql
ALTER TABLE staff
DROP CONSTRAINT IF EXISTS staff_role_check;

ALTER TABLE staff
ADD CONSTRAINT staff_role_check
CHECK (role IN ('owner', 'cashier', 'admin'));
```

---

## 8. Environment Variables (additions for Phase 1)

Add these to .env.local and .env.example:

```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

---

## 9. Mobile-First Design Requirements

The entire Phase 1 experience is designed for mobile first.
Restaurant customers use their phones. Not laptops.

- All tap targets minimum 44px height
- Font sizes minimum 16px on inputs (prevents iOS zoom)
- Cart drawer is full height on mobile
- Stripe Elements must be tested on iOS Safari specifically
  (Apple Pay only works on Safari on iOS/macOS)
- No hover-only interactions — everything must work with
  touch
- Page transitions use Framer Motion with reduced motion
  support: wrap all animations in
  `useReducedMotion()` check and skip if true

---

## 10. Error States

Every page must handle these gracefully:

| Error | Handling |
|---|---|
| Invalid or missing slug | notFound() — returns 404 page |
| Missing table param | Gentle error card on menu page asking to re-scan |
| Invalid table number | Same as above |
| Menu is empty | "Menu coming soon" state — not a crash |
| Stripe payment fails | Inline error, stay on payment page |
| Webhook fails to create order | Log error, customer already paid — manual recovery needed |
| Order not found on confirmation | Redirect to menu |
| Cart is empty on checkout | Redirect to menu |

---

## 11. Tooling Split

| Task | Tool |
|---|---|
| Menu page UI and animations | Cursor |
| Cart drawer UI and animations | Cursor |
| Customer info screen UI | Cursor |
| Payment page UI and Stripe Elements | Cursor |
| Order confirmation UI and animations | Cursor |
| useCart hook logic | Cursor |
| create-payment-intent API route | Claude Code |
| Stripe webhook handler | Claude Code |
| Order fetch API route | Claude Code |
| Supabase schema migration (002) | Claude Code |
| Server-side price validation logic | Claude Code |
| session_id generation and reuse logic | Claude Code |

---

## 12. Acceptance Criteria

Phase 1 is complete when every item below passes:

- [ ] Visiting /test-restaurant?table=1 loads the menu page
- [ ] Menu shows all 8 test items grouped by category
- [ ] Category pill navigation scrolls and filters correctly
- [ ] Language switcher toggles between English and Greek
- [ ] Food items show correctly, drink items show correctly
- [ ] Adding an item shows the quantity stepper on the card
- [ ] Cart item count and subtotal update in the floating button
- [ ] Cart drawer opens with spring animation
- [ ] Removing an item from cart animates the row out
- [ ] Empty cart shows the correct empty state
- [ ] "Place Order" navigates to the customer info screen
- [ ] Customer info validates name and phone correctly
- [ ] Invalid fields show inline errors on blur
- [ ] Valid info navigates to the payment page
- [ ] Payment page shows Stripe Elements correctly
- [ ] Apple Pay button appears on Safari iOS/macOS
- [ ] Completing a test payment (Stripe test mode) creates
      an order row in Supabase
- [ ] order_items rows are created with correct type,
      name_snapshot, unit_price, and line_total
- [ ] tables.status is set to 'occupied' after first order
- [ ] Confirmation screen shows the correct order number
- [ ] Checkmark SVG animation plays on confirmation screen
- [ ] "Order more" returns to menu and allows a second order
- [ ] Second order reuses the same session_id
- [ ] Second order adds to the same tab (same session_id)
- [ ] Server-side price validation rejects tampered prices
- [ ] Stripe webhook signature validation rejects invalid calls
- [ ] Entire flow tested on iPhone Safari (primary target)
- [ ] Entire flow tested on Android Chrome
- [ ] CLAUDE.md "What has been built" section updated

---

## 13. Open Questions

| # | Question | Owner | Impact |
|---|---|---|---|
| 1 | Should Apple Pay require the domain to be verified in Stripe dashboard? | Coding | Must be done before Apple Pay works in production |
| 2 | What phone number format should be accepted? Greek only (+30) or international? | Product | Affects phone validation logic |
| 3 | Should the per-item notes field be optional or required? | Product | Affects cart item schema |
| 4 | Should the "Order more" button be shown permanently or only for a few minutes? | Product | Affects session continuity logic |

---

*End of PRD — Phase 1: Customer Ordering Experience (v1)*
