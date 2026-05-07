# PRD — Phase 6: Subscriptions & Billing
**Version:** 1.0 | **Status:** Locked  
**Project:** Trapezi | **Author:** Kostas (via Claude)

---

## 1. Goals

- Enforce plan-based feature gating across the entire application
- Integrate Stripe Billing for recurring monthly subscription charges
- Handle failed payments with a structured 10-day dunning flow
- Display subscription and lease information in the owner dashboard
- Calculate and present early exit fees when a restaurant requests cancellation
- Populate new contract tracking columns on the `restaurants` table at onboarding

---

## 2. Non-Goals

- Self-serve plan upgrades or downgrades (handled manually by Kostas)
- Enterprise plan (parked)
- Customer-facing billing UI
- Invoice PDF generation
- Automated cancellation processing (owner contacts Kostas)

---

## 3. Locked Decisions

| Decision | Value |
|---|---|
| Basic plan price | €69/mo — iPad included |
| Pro plan price | €129/mo — iPad included |
| iPad delivery | Pre-configured by hardware friend |
| Upgrade/downgrade | Manual via Kostas — no self-serve UI |
| Downgrade timing | End of current billing period |
| iPad lease cost | €17/mo ex-VAT (hardcoded) |
| Dunning grace period | 10 days — retry day 3, 6, 9 → lock day 10 |
| Dunning notifications | Push notification + email (Resend), daily |
| Feature gating | Enforced in Phase 6 for the first time |
| Contract tracking | New columns on `restaurants` table |

---

## 4. Plan Feature Matrix (Enforcement Reference)

| Feature | Free | Basic | Pro |
|---|---|---|---|
| Digital menu (read-only) | ✅ | ✅ | ✅ |
| QR ordering + Stripe payments | ❌ | ✅ | ✅ |
| Cash payments | ❌ | ✅ | ✅ |
| Cashier screen | ❌ | ✅ | ✅ |
| Push notifications (staff) | ❌ | ✅ | ✅ |
| Item availability toggle | ❌ | ✅ | ✅ |
| Allergen & dietary filters | ❌ | ✅ | ✅ |
| Staff accounts | ❌ | Owner only | ✅ Multiple |
| Order history | ❌ | 7 days | Unlimited |
| Logo + accent color branding | ❌ | ✅ | ✅ |
| Multiple menus + scheduling | ❌ | ❌ | ✅ |
| Upsell prompts | ❌ | ❌ | ✅ |
| Happy hour / scheduled pricing | ❌ | ❌ | ✅ |
| Analytics dashboard | ❌ | ❌ | ✅ |
| CSV / Excel export | ❌ | ❌ | ✅ |
| Automated weekly email reports | ❌ | ❌ | ✅ |
| Full white-label branding | ❌ | ❌ | ✅ |
| Table sections/grouping | ❌ | ❌ | ✅ |
| Stripe payouts dashboard | ❌ | ❌ | ✅ |

---

## 5. Database Migration

### 5.1 New Columns on `restaurants`

```sql
ALTER TABLE restaurants
  ADD COLUMN contract_start_date     TIMESTAMPTZ,
  ADD COLUMN stripe_subscription_id  TEXT,
  ADD COLUMN subscription_status     TEXT NOT NULL DEFAULT 'active'
                                     CHECK (subscription_status IN ('active', 'past_due', 'cancelled')),
  ADD COLUMN current_period_end      TIMESTAMPTZ,
  ADD COLUMN dunning_day             INTEGER DEFAULT 0;
  -- dunning_day: 0 = no issue, increments 1–10 during dunning window
```

### 5.2 No New Tables

Contract tracking lives entirely on `restaurants`. A separate `subscriptions` table is unnecessary — one active contract per restaurant at a time.

---

## 6. Feature Gating

### 6.1 Gating Utility

Create `lib/plans/gates.ts`:

```ts
export type Plan = 'free' | 'basic' | 'pro';

const PLAN_RANK: Record<Plan, number> = { free: 0, basic: 1, pro: 2 };

export function planAtLeast(restaurantPlan: Plan, required: Plan): boolean {
  return PLAN_RANK[restaurantPlan] >= PLAN_RANK[required];
}
```

### 6.2 Server-Side Enforcement

Every API route and server component that serves plan-gated content must:
1. Fetch `restaurants.plan` and `restaurants.subscription_status`
2. If `subscription_status === 'cancelled'` → treat as `free`
3. Call `planAtLeast(plan, requiredPlan)` — return 403 with `{ error: 'plan_required', required: 'pro' }` if false

### 6.3 API Routes to Gate

| Route | Min Plan |
|---|---|
| `POST /api/orders/create-payment-intent` | basic |
| `GET /api/orders/*` (order history) | basic — Basic enforces 7-day window server-side |
| `GET /api/analytics/*` | pro |
| `GET /api/export/*` | pro |
| `GET/POST /api/menu/menus` (multiple menus) | pro |
| `GET/POST /api/menu/schedules` | pro |
| `GET/POST /api/upsell/*` | pro |
| `GET/POST /api/happy-hour/*` | pro |
| `POST /api/staff` (cashier/manager creation) | pro |
| `GET /api/stripe/login-link` | pro |
| `POST /api/reports/weekly` | pro |

### 6.4 UI Gating (Cursor phase)

- Gated sections in the owner dashboard show a **plan upgrade prompt** instead of the feature content
- Upgrade prompt: brief description of the feature + "Contact us to upgrade" button (mailto or phone link)
- Do not hide nav items entirely — show them greyed out with a lock icon so owners understand what they're missing
- `subscription_status === 'past_due'` shows a persistent banner in the owner dashboard

---

## 7. Stripe Billing Integration

### 7.1 Stripe Products & Prices

Kostas must create the following in the Stripe Dashboard (test + live):

| Product | Price ID env var | Amount | Interval |
|---|---|---|---|
| Trapezi Basic | `STRIPE_PRICE_BASIC` | €69.00 | Monthly |
| Trapezi Pro | `STRIPE_PRICE_PRO` | €129.00 | Monthly |

These Price IDs are stored as environment variables — never hardcoded.

### 7.2 New Environment Variables

```
STRIPE_PRICE_BASIC=price_xxx
STRIPE_PRICE_PRO=price_xxx
STRIPE_BILLING_WEBHOOK_SECRET=whsec_xxx
```

### 7.3 Subscription Lifecycle

**At restaurant onboarding (manual, done by Kostas via admin or Stripe Dashboard):**
1. Create a Stripe Customer for the restaurant
2. Create a Stripe Subscription with the correct Price ID
3. Store `stripe_subscription_id`, `contract_start_date = now()`, `current_period_end`, `subscription_status = 'active'` on `restaurants`
4. Update `plan` column to `basic` or `pro`

For Phase 6, a simple internal API route `POST /api/admin/activate-subscription` (protected by `CRON_SECRET` or admin role) handles this so Kostas can trigger it without touching the DB directly.

### 7.4 Stripe Billing Webhook

Use the existing **"Your account"** webhook endpoint. Add a new handler file `lib/billing/webhook-handler.ts` and route calls from `app/api/webhooks/stripe/route.ts` based on event type.

**Events to handle:**

| Event | Action |
|---|---|
| `invoice.payment_succeeded` | Set `subscription_status = 'active'`, `dunning_day = 0`, update `current_period_end` |
| `invoice.payment_failed` | Begin dunning: set `subscription_status = 'past_due'`, `dunning_day = 1` |
| `customer.subscription.deleted` | Set `subscription_status = 'cancelled'`, `plan = 'free'` |
| `customer.subscription.updated` | Update `plan`, `current_period_end` accordingly |

---

## 8. Dunning Flow

### 8.1 Overview

When a payment fails, the restaurant enters a 10-day dunning window. Stripe retries on days 3, 6, and 9 (configured in Stripe Dashboard → Settings → Billing → Smart Retries — set to manual schedule: day 3, 6, 9). On day 10 if still unpaid, the subscription is cancelled.

### 8.2 Daily Notification Job

**Vercel Cron:** `POST /api/cron/dunning` — runs daily at 09:00 UTC  
**Auth:** `CRON_SECRET` header

Logic:
1. Fetch all restaurants where `subscription_status = 'past_due'`
2. For each: increment `dunning_day` by 1
3. If `dunning_day >= 10`: cancel subscription in Stripe → `subscription_status = 'cancelled'`, `plan = 'free'`
4. Otherwise: send push notification + email with days remaining

### 8.3 Notification Content

**Push notification:**
> ⚠️ Payment failed — {10 - dunning_day} days remaining before service suspension

**Email (Resend):**
- Subject: `⚠️ Action required — Trapezi subscription payment failed`
- Body: explains failed payment, retry schedule, days remaining, CTA button to update payment method (Stripe Customer Portal link)
- Countdown is prominent: "**X days remaining**"
- Sent to: restaurant owner's email (`staff` table where `role = 'owner'`)

### 8.4 Stripe Customer Portal

Generate a Stripe Customer Portal link on demand:  
`GET /api/billing/portal` → returns a one-time portal URL  
Owners can update their payment method without contacting Kostas.  
Portal is accessible from the billing page in the owner dashboard.

### 8.5 Dunning State in UI

- Owner dashboard shows a persistent red banner when `subscription_status = 'past_due'`
- Banner: "Payment failed — X days until suspension. [Update payment method]"
- All features remain accessible during the 10-day window

---

## 9. Cancellation Flow

### 9.1 No Self-Serve Cancellation

Owners cannot cancel from the dashboard. They contact Kostas directly (phone or email).

### 9.2 Early Exit Fee Display

The billing page in the owner dashboard shows:

- Plan name, price, next billing date
- Contract start date and contract end date (start + 12 months)
- If within the 12-month minimum: "Early exit fee: €X.XX (Y months remaining × €21.08 incl. VAT)"
- If past 12 months: "No early exit fee — contract auto-renewed monthly"

**Calculation:**
```ts
const LEASE_MONTHLY_EX_VAT = 17;
const VAT_RATE = 0.24;
const LEASE_MONTHLY_WITH_VAT = LEASE_MONTHLY_EX_VAT * (1 + VAT_RATE); // €21.08

const monthsElapsed = differenceInMonths(now, contract_start_date);
const monthsRemaining = Math.max(0, 12 - monthsElapsed);
const earlyExitFee = monthsRemaining * LEASE_MONTHLY_WITH_VAT;
```

### 9.3 Contact CTA

Billing page shows: "To cancel your subscription, please contact us at [email/phone]."

---

## 10. Billing Page — Owner Dashboard

Route: `/[slug]/owner` (new "Billing" tab in sidebar)

Displays:
- Current plan badge (Free / Basic / Pro)
- Subscription status (Active / Past Due / Cancelled)
- Monthly price
- Next billing date (`current_period_end`)
- Contract start date + contract end date
- Early exit fee (if applicable)
- "Update payment method" button → Stripe Customer Portal
- "Contact us to cancel" CTA
- Persistent past_due banner (if applicable)

**Free plan:** Shows plan comparison + "Contact us to upgrade" CTA. No billing details.

---

## 11. API Routes Summary

| Method | Route | Description |
|---|---|---|
| POST | `/api/admin/activate-subscription` | Manual onboarding — creates Stripe subscription, updates DB |
| GET | `/api/billing/portal` | Returns Stripe Customer Portal URL |
| POST | `/api/cron/dunning` | Daily dunning job |
| POST | `/api/webhooks/stripe` | Extended to handle billing events (existing route) |

---

## 12. Vercel Cron Update

Add to `vercel.json`:
```json
{
  "path": "/api/cron/dunning",
  "schedule": "0 9 * * *"
}
```

---

## 13. Acceptance Criteria

- [ ] Feature-gated API routes return 403 for underprivileged plans
- [ ] Free plan restaurants cannot place orders or access cashier screen
- [ ] Basic plan restaurants cannot access analytics, upsell, happy hour, or multiple menus
- [ ] 7-day order history window enforced server-side for Basic
- [ ] `invoice.payment_failed` webhook sets `subscription_status = 'past_due'`
- [ ] `invoice.payment_succeeded` webhook resets dunning state
- [ ] Dunning cron increments `dunning_day` daily and sends push + email
- [ ] On day 10, subscription is cancelled in Stripe and plan reverts to `free`
- [ ] Billing page shows correct plan, dates, and early exit fee
- [ ] Stripe Customer Portal link works and is one-time generated
- [ ] `POST /api/admin/activate-subscription` correctly sets all contract columns
- [ ] Early exit fee calculation is correct for mid-contract and post-contract scenarios

---

## 14. Open Questions

None — all decisions locked.

---

## 15. Files to Create / Modify

### New Files
| File | Purpose |
|---|---|
| `lib/plans/gates.ts` | Plan gating utility |
| `lib/billing/webhook-handler.ts` | Stripe billing event handler |
| `lib/billing/dunning.ts` | Dunning logic + notification dispatch |
| `lib/billing/lease.ts` | Lease cost + early exit fee calculation |
| `app/api/admin/activate-subscription/route.ts` | Manual onboarding API |
| `app/api/billing/portal/route.ts` | Stripe Customer Portal link |
| `app/api/cron/dunning/route.ts` | Daily dunning cron |
| `supabase/migrations/010_phase6_billing.sql` | DB migration |

### Modified Files
| File | Change |
|---|---|
| `app/api/webhooks/stripe/route.ts` | Route billing events to new handler |
| `app/api/orders/create-payment-intent/route.ts` | Add plan gate (basic+) |
| `app/api/analytics/*/route.ts` | Add plan gate (pro) |
| `app/api/menu/menus/route.ts` | Add plan gate (pro for multiple menus) |
| `app/api/staff/route.ts` | Add plan gate (pro for cashier/manager) |
| `vercel.json` | Add dunning cron schedule |
