# TRAPEZI
## Phase 4 — Notifications & Alerts
### Product Requirements Document
**Version 1.1 | March 2026**

---

## 1. Goals

- Notify customers automatically at key moments in their order journey
- Keep restaurant staff (owner + cashier) informed in real time without checking the screen
- Deliver a weekly performance digest to the owner every Monday morning
- All notifications are automatic — zero manual effort from staff

---

## 2. Non-Goals

- No opt-out mechanism for SMS in this phase
- No real-time revenue data in push notifications (Pro analytics only)
- No customer push notifications — SMS is the customer channel
- No daily reports — weekly only
- No notification history or log screen in this phase
- No custom notification templates in this phase

---

## 3. User Stories

### Customer
- As a customer, I want to receive an SMS when my payment is confirmed so I know my order went through
- As a customer, I want to receive an SMS when my order is marked ready so I know to expect it

### Cashier
- As a cashier, I want a push notification on the iPad when a new order comes in so I never miss it
- As a cashier, I want a push notification when a tab is closed so I stay updated

### Owner
- As an owner, I want push notifications on my personal phone for all key events so I can monitor the restaurant remotely
- As an owner, I want to receive push notifications on any device I am logged in from
- As an owner, I want a weekly email every Monday morning summarising last week's performance so I can make informed decisions without logging in

---

## 4. Plan Gating

| Feature | Free | Basic | Pro |
|---|---|---|---|
| SMS to customer | ❌ | ✅ | ✅ |
| Push to staff (cashier + owner) | ❌ | ✅ | ✅ |
| Weekly email report | ❌ | ❌ | ✅ |

---

## 5. Technical Spec

### 5.1 SMS — Twilio

**Trigger 1: Payment Confirmed**
- Fires immediately after `payment_intent.succeeded` webhook
- Recipient: customer phone number stored on the order
- Message (EN): "Your order at [Restaurant Name] has been confirmed. Thank you!"
- Message (EL): "H παραγγελία σας στο [Restaurant Name] επιβεβαιώθηκε. Ευχαριστούμε!"
- Language selection: determined by the browser locale detected at order time, stored on the order record as `customer_locale`. Defaults to English if undetermined.

**Trigger 2: Order Marked Ready**
- Fires when cashier marks order status as `ready` on cashier screen
- Recipient: same customer phone number from the order
- Message (EN): "Your order at [Restaurant Name] is ready. Enjoy!"
- Message (EL): "H παραγγελία σας στο [Restaurant Name] είναι έτοιμη. Καλή απόλαυση!"

**SMS Implementation Rules**
- All Twilio calls server-side only — never expose credentials to client
- Fire-and-forget — SMS failure never blocks order flow
- Log Twilio response status on the order record for debugging (`sms_payment_sent_at`, `sms_ready_sent_at`)
- Use `Promise.allSettled` — multiple SMS failures never crash the system
- Phone number already validated at order time (D31) — no re-validation needed

---

### 5.2 Push Notifications — Web Push API

**Recipients**
- iPad (cashier screen) — PWA with push enabled
- Owner's personal phone — must allow push permissions on first login
- Owner may be logged in on multiple devices simultaneously — all subscribed devices receive the notification

**Notification Events**

| Event | Recipient | Message |
|---|---|---|
| New order placed | Cashier + Owner | "New order at Table [X] — €[amount]" |
| Order marked ready | Cashier + Owner | "Order at Table [X] marked as ready" |
| Tab closed | Cashier + Owner | "Tab closed — Table [X] — €[total]" |

**Push Implementation Rules**
- Use Web Push API with VAPID keys stored in environment variables
- Push subscriptions stored in Supabase — new table `push_subscriptions` (see Section 6)
- On login, prompt staff to enable push if not already subscribed on that device
- Each device login creates its own subscription row — all are notified simultaneously
- Push failure never blocks any order operation
- Basic plan: event alerts only, no revenue figures in notification body
- Pro plan: same for now — revenue in notification body is a Phase 5 enhancement

---

### 5.3 Weekly Email Report — Resend or Postmark

**Schedule & Scope**
- Sends every Monday at 10:00 AM local time (Europe/Athens timezone)
- Covers the previous full week: Monday 00:00 → Sunday 23:59
- Recipient: owner email only (role = owner on the restaurant's staff record)
- Pro plan only — cron checks plan before sending, skips Basic and Free restaurants
- If a restaurant had zero orders that week, skip the email entirely — never send an empty report

**Report Contents**

| Section | Data |
|---|---|
| Total revenue | Sum of all completed orders for the week |
| Total orders | Count of completed orders |
| Average order value | Total revenue ÷ total orders |
| Best sellers by category | Top 3 food items + top 3 drink items by quantity sold |
| Peak hours heatmap | Orders grouped by hour of day across the week |
| Week-on-week comparison | Revenue and order count delta vs the previous week |

**Email Implementation Rules**
- Scheduled via Vercel Cron Job — cron expression: `0 8 * * 1` (08:00 UTC = 10:00 Athens, accounting for UTC+2; adjust for DST)
- If the cron job fails, it logs the failure to Supabase and retries automatically once after 30 minutes
- If the retry also fails, the failure is logged and the owner does not receive a report for that week — no silent failures
- Query pulls only `closed` orders within the date range for that restaurant
- Email template respects restaurant branding for Pro plan (logo + accent color)

---

## 6. Database Changes

### New Table: `push_subscriptions`
```sql
id               uuid primary key
staff_id         uuid references staff(id)
restaurant_id    uuid references restaurants(id)
endpoint         text not null
p256dh           text not null
auth             text not null
created_at       timestamptz default now()
```

### New Columns on `orders`
```sql
sms_payment_sent_at    timestamptz
sms_ready_sent_at      timestamptz
customer_locale        text
```

---

## 7. Acceptance Criteria

- [ ] Customer receives SMS within 5 seconds of payment confirmation
- [ ] Customer receives SMS within 5 seconds of cashier marking order ready
- [ ] SMS language matches customer locale — Greek or English, defaults to English
- [ ] Cashier iPad receives push on new order, ready, and tab closed events
- [ ] Owner phone receives push on same events
- [ ] Owner logged in on multiple devices — all devices receive the push
- [ ] Push permission prompt appears on first staff login on each device
- [ ] Failed SMS never blocks order flow
- [ ] Failed push never blocks cashier actions
- [ ] Weekly email sends every Monday at 10:00 AM Athens time
- [ ] Weekly email skips restaurants with zero orders that week
- [ ] Weekly email skips Basic and Free plan restaurants
- [ ] Email contains all 6 report sections
- [ ] Pro restaurant email uses restaurant logo and accent color
- [ ] Cron failure is logged and retried once after 30 minutes
- [ ] Zero Twilio credentials exposed to client

---

## 8. Open Questions

| # | Question | Status |
|---|---|---|
| 1 | Email provider: Resend or Postmark? | Open — must decide before Phase 4 build |
| 2 | SMS opt-out compliance under Greek/EU telecom law (GDPR + ePrivacy Directive) | Flag for legal review before launch |
| 3 | Push notification body to include order value for Pro — Phase 4 or Phase 5? | Deferred to Phase 5 |
| 4 | DST handling for cron — Athens is UTC+2 in winter, UTC+3 in summer | Confirm cron expression before go-live |

---

*Trapezi — Internal Document — Not for distribution*
