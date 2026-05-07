# PRD — Phase 5b: Analytics & Reporting
### Trapezi · Version 1.1 · April 11, 2026

---

## 1. Goals

- Give Pro and Basic owners visibility into their restaurant's performance from the owner dashboard
- Provide searchable order history gated by plan (7 days Basic, unlimited Pro)
- Deliver a clean analytics dashboard with meaningful metrics and flexible date filtering
- Export order data as CSV in two formats simultaneously
- Link Pro owners to their Stripe Express Dashboard for payout management
- Surface weekly email report controls for Pro owners

---

## 2. Non-Goals

- No real-time analytics — data is fetched on page load and on filter change, not live-updating
- No predictive or AI-generated insights
- No custom report builder
- No per-staff performance tracking
- No inventory management
- No kitchen/bar routes or roles — ever

---

## 3. User Stories

**Basic + Pro:**
> As an owner, I want to search my order history by table, date, item name, or customer so I can find specific transactions quickly.

> As an owner, I want order history limited to the last 7 days on Basic so I understand my plan boundaries.

**Pro only:**
> As an owner, I want to see total revenue, total orders, and average order value for any time period I choose.

> As an owner, I want to see which items and categories sell best so I can make menu decisions.

> As an owner, I want to see a peak hours heatmap so I know when my restaurant is busiest.

> As an owner, I want to compare this week's performance to last week at a glance.

> As an owner, I want to export my order data as CSV so I can process it in a spreadsheet.

> As an owner, I want to access my Stripe payout history and bank details without leaving the dashboard.

> As an owner, I want to control whether I receive the weekly email report and which address it goes to.

**Owner + Manager:**
> As a manager, I want the same full dashboard access as the owner (menu management + analytics) so I can operate without needing the owner's login.

---

## 4. Feature Breakdown

### 4.1 Order History (Basic + Pro)

A searchable, paginated table of all orders placed at the restaurant.

Columns shown:
- Order ID (truncated, copyable)
- Table number
- Customer name
- Customer phone
- Items (comma-separated item names, truncated at 3 with "+N more")
- Total (€)
- Status (paid, ready, closed)
- Date & time

Search and filter controls:
- Free text search: matches customer name, customer phone, item name (via order_items.name_snapshot)
- Table number filter: dropdown of all tables
- Date range picker: presets (Today, Last 7 days, Last 30 days, Last 6 months, Last 9 months, Last year) plus custom from/to date inputs
- Status filter: All / Paid / Ready / Closed

Plan gating:
- Basic: date range locked to last 7 days — custom picker disabled, show tooltip "Upgrade to Pro for full history"
- Pro: no restriction

Pagination: 50 rows per page, load more button (not infinite scroll — owner may be on iPad)

Clicking a row expands it inline to show full item list with quantities, notes, and per-item price.

### 4.2 Analytics Dashboard (Pro only)

Shown as a separate tab in the Analytics section. Hidden entirely for Basic and Free.

#### Time range selector
Persistent at the top of the page. Options:
- Today
- Last 7 days (default on load)
- Last 30 days
- Last 6 months
- Last 9 months
- Last year
- Custom (date range picker, from/to)

All metrics and charts update when the range changes.

#### KPI Cards (top row)
Four cards:
- **Total Revenue** — sum of all order totals in range, formatted as €X,XXX.XX
- **Total Orders** — count of orders in range
- **Average Order Value** — total revenue ÷ total orders
- **Week-on-week change** — percentage change vs the equivalent prior period (e.g. if range is last 7 days, compare to the 7 days before that). Show green arrow if positive, red arrow if negative.

#### Best Sellers
Two sections side by side:
- **By item:** top 10 items ranked by total quantity sold in range. Shows item name, category, units sold, total revenue from that item.
- **By category:** total revenue and units per category, shown as a horizontal bar chart.

#### Peak Hours Heatmap
A 7×24 grid — rows = days of week (Mon–Sun), columns = hours (00–23).
Each cell is shaded by number of orders placed in that hour/day combination.
Darker = busier.
Computed from orders.created_at in the selected range.

#### Revenue Over Time
A line chart showing daily revenue across the selected date range.
X axis = date, Y axis = revenue in €.
If range is Today: show hourly breakdown instead.

### 4.3 CSV Export (Pro only)

A single "Export CSV" button, available on the Order History tab.
Exports whatever the current date filter is (not a full history dump — respects the active filter).

On click: generates and downloads a single zip file containing two CSVs:
- `trapezi-orders-[date].csv` — one row per order: Order ID, Table, Customer Name, Customer Phone, Order Total, Status, Date/Time
- `trapezi-order-items-[date].csv` — one row per order item: Order ID, Table, Item Name, Qty, Unit Price, Item Total, Date/Time

Both files use UTF-8 encoding with BOM (important for Greek characters in Excel).
Zip filename: `trapezi-export-YYYY-MM-DD.zip`

### 4.4 Stripe Express Dashboard Link (Pro only)

A dedicated "Payouts" tab in the Analytics section (Pro only, hidden for Basic/Free).

The tab contains:
- A brief explainer: "Your payments are processed directly through your Stripe account. Access your full payout history, bank details, and transaction records below."
- A prominent button: "Open Stripe Dashboard →"
- Clicking the button calls a server-side API route that generates a Stripe Express Dashboard login link for the restaurant's connected account and redirects the owner to it
- The link expires after one use — generate fresh on every click
- If the restaurant has no `stripe_account_id` in the DB: show a message "Your Stripe account is not connected yet. Contact support."

### 4.5 Weekly Email Report Controls (Pro only)

A "Reports" tab in the Analytics section (Pro only).

Three controls:
- **Toggle:** Enable / Disable weekly email report (on by default for Pro). Stored in `restaurants.metadata.weekly_report_enabled` (boolean).
- **Recipient email:** Text input with current email pre-filled. Defaults to the owner's account email. Owner can change it. Stored in `restaurants.metadata.weekly_report_email`.
- **Last report preview:** Shows a read-only summary of the last sent weekly report inline (same data fields as the email — revenue, orders, AOV, top sellers). If no report has been sent yet: "No report has been sent yet. Your first report will arrive next Monday."

The Vercel cron job (already built in Phase 4) must be updated to check `weekly_report_enabled` before sending. If false, skip that restaurant.

---

## 5. Technical Specification

### 5.1 New API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/analytics/orders` | GET | Paginated, filtered order history |
| `/api/analytics/metrics` | GET | KPI cards data for date range |
| `/api/analytics/best-sellers` | GET | Top items and categories |
| `/api/analytics/heatmap` | GET | Peak hours grid data |
| `/api/analytics/revenue-chart` | GET | Daily/hourly revenue series |
| `/api/analytics/export` | GET | Zip download containing two CSVs |
| `/api/analytics/stripe-dashboard-link` | POST | Generates Stripe Express login link |
| `/api/analytics/report-settings` | GET, PATCH | Read/update weekly report preferences |

### 5.2 Database Changes

No new tables required. All analytics are computed from existing `orders` and `order_items` tables.

Two new fields on `restaurants.metadata` (JSONB — no migration needed, just update the object):
- `weekly_report_enabled: boolean` (default true for Pro)
- `weekly_report_email: string` (default owner email)

Add indexes if not already present:
- `orders.created_at`
- Composite: `(orders.restaurant_id, orders.created_at)`

### 5.3 Manager Role

The `manager` role is new. No new table needed — it is a new valid value in the existing `staff.role` column.

Manager access: full owner dashboard — menu management + all analytics. Same as owner.

All RLS policies and API route auth guards that currently check `role = 'owner'` must be updated to `role IN ('owner', 'manager')` for all read operations. Write operations on menu management (create/edit/delete items, categories, menus etc.) also available to manager.

The owner dashboard layout auth guard at `app/[slug]/owner/layout.tsx` must be updated to allow `role IN ('owner', 'manager')`.

### 5.4 Plan Gating Logic

All analytics routes verify plan server-side:
- Basic: `/api/analytics/orders` enforces a hard date floor of `now() - interval '7 days'` regardless of client-supplied range
- Pro: no floor
- All other analytics routes return 403 for Free and Basic plans

### 5.5 Stripe Express Dashboard Link

```
POST /api/analytics/stripe-dashboard-link
1. Load restaurant's stripe_account_id from DB
2. Call Stripe API: stripe.accounts.createLoginLink(stripe_account_id)
3. Return { url }
4. Client redirects to url (window.open or router.push)
5. Never cache — generate fresh every time
```

Requires `STRIPE_SECRET_KEY` — already in env.

### 5.6 CSV / Zip Generation

- Generated entirely server-side — no client-side CSV libraries
- Package: `archiver` (install: `npm install archiver`)
- Use Node.js streams to avoid loading all rows into memory
- UTF-8 BOM prefix: `\uFEFF` prepended to each CSV for Excel compatibility
- Response headers: `Content-Type: application/zip`, `Content-Disposition: attachment; filename="trapezi-export-YYYY-MM-DD.zip"`

### 5.7 Heatmap Data Structure

API returns a flat array:
```typescript
type HeatmapCell = {
  day: number    // 0=Sun...6=Sat
  hour: number   // 0–23
  count: number  // orders in this cell
}
```
Frontend renders as a 7×24 grid using Tailwind opacity utility classes for shading — no external chart library needed.

### 5.8 Chart Library

Use **Recharts** for the revenue line chart and best sellers bar chart — already in the project. No new dependencies needed for charts.

### 5.9 RLS

All analytics routes use the Supabase server client and verify:
- User is authenticated
- User's `restaurant_id` matches the requested restaurant
- User's role is `owner` or `manager`

---

## 6. Plan Gating Summary

| Feature | Free | Basic | Pro |
|---|---|---|---|
| Order history | ❌ | ✅ 7 days | ✅ Unlimited |
| Order history search | ❌ | ✅ | ✅ |
| CSV export | ❌ | ❌ | ✅ |
| Analytics dashboard | ❌ | ❌ | ✅ |
| Peak hours heatmap | ❌ | ❌ | ✅ |
| Best sellers | ❌ | ❌ | ✅ |
| Revenue chart | ❌ | ❌ | ✅ |
| Stripe payouts tab | ❌ | ❌ | ✅ |
| Weekly report controls | ❌ | ❌ | ✅ |

---

## 7. Acceptance Criteria

- [ ] Basic owner sees order history, date range locked to last 7 days, upgrade tooltip shown
- [ ] Pro owner sees full unlimited order history
- [ ] Order history searchable by customer name, phone, item name, table number
- [ ] Clicking an order row expands full item detail inline
- [ ] KPI cards show correct totals for selected date range
- [ ] Week-on-week comparison shows correct delta with colour indicator
- [ ] Best sellers list and bar chart render correctly
- [ ] Peak hours heatmap renders as 7×24 grid with correct shading
- [ ] Revenue line chart shows daily breakdown (hourly for Today)
- [ ] All analytics update when date range changes
- [ ] CSV export downloads a zip with two correctly structured files
- [ ] CSV files use UTF-8 BOM — Greek characters render correctly in Excel
- [ ] CSV export respects active date filter
- [ ] Stripe Express Dashboard link generates fresh on every click
- [ ] If no stripe_account_id: correct message shown, no crash
- [ ] Weekly report toggle saves and cron respects it
- [ ] Weekly report email address can be updated and saved
- [ ] Last report preview renders inline correctly
- [ ] Manager role can access full owner dashboard (menu + analytics)
- [ ] All analytics routes return 403 for Free and Basic plans

---

## 8. Resolved Decisions

| # | Question | Resolution |
|---|---|---|
| OQ1 | Manager dashboard access scope | ✅ Full owner dashboard — menu management + analytics |
| OQ2 | Order history access for cashier | ✅ Owner and manager only — cashier cannot access order history |

---

## 9. Prompt Order

1. **Claude Code first:** API routes, DB indexes, CSV/zip generation, Stripe login link, cron update for `weekly_report_enabled`, manager role added to `staff.role`, RLS policies updated for manager
2. **Cursor second:** Analytics dashboard UI, order history table with search/filter, KPI cards, heatmap grid, Recharts components, Stripe payouts tab, weekly report controls tab
