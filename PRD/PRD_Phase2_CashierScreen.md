PRD — Phase 2: Cashier Screen
Version: 1.0 — March 2026
Tool split: Claude Code first (logic + realtime), Cursor second (UI)
Route: /[slug]/cashier
Device: iPad, landscape, permanently mounted

Goals

Give the cashier a live view of all open tabs in the restaurant
Allow closing a tab (marks orders closed, frees the table)
Allow marking an order as ready
Require zero manual refresh — all updates via Supabase Realtime

Non-Goals

No kitchen or bar screens, routes, or roles (architectural decision)
No cash payment processing in Phase 2
No order editing or item-level changes by cashier
No analytics or reporting
No printer integration (Phase 3)


User Stories

As a cashier, I see all occupied tables on the left panel at a glance so I know what's active
As a cashier, I tap a table to see the full tab detail on the right — all orders, all items, running total
As a cashier, I see new orders appear instantly without refreshing
As a cashier, I can mark an individual order as "ready" so I know it's been prepared
As a cashier, I can close a tab when the customer is done — which frees the table


Layout (iPad, landscape, split view)
┌─────────────────┬──────────────────────────────────┐
│  LEFT PANEL     │  RIGHT PANEL                     │
│  (tables list)  │  (selected tab detail)           │
│                 │                                  │
│  ● Table 1  €34 │  Table 3 — Session #abc          │
│  ● Table 3  €21 │  ─────────────────────────────── │
│  ○ Table 4      │  Order #0042  14:32  €12.50  ✓   │
│  ○ Table 5      │    1x Margherita Pizza            │
│                 │    1x Espresso (no sugar)         │
│                 │  ─────────────────────────────── │
│                 │  Order #0043  14:51  €8.50        │
│                 │    1x Caesar Salad                │
│                 │    1x Sparkling Water             │
│                 │                                  │
│                 │  TOTAL: €21.00                   │
│                 │                                  │
│                 │  [ Mark Ready ]  [ Close Tab ]   │
└─────────────────┴──────────────────────────────────┘

Technical Spec
Data fetching

On mount: fetch all tables for the restaurant from tables table
On mount: fetch all open orders (status != 'closed') with their order_items, grouped by session_id
Join order_items to get item names, quantities, notes, line totals

Supabase Realtime subscriptions (3 channels)

orders — INSERT and UPDATE for this restaurant_id

New order → add to correct session group in left panel, update tab total
Order status update → reflect in right panel instantly


order_items — INSERT for this restaurant_id

New items → append to the correct order in right panel


tables — UPDATE for this restaurant_id

Table status change → update left panel dot colour instantly



Session grouping logic

Group all open orders by session_id
Left panel shows one row per occupied table (tables where at least one order is open)
Tab total = sum of order.total for all orders sharing the same session_id
Right panel shows all orders in the selected session, sorted by created_at ascending

Mark as ready

Tapping "Mark Ready" on an individual order → sets orders.status = 'ready'
Visual indicator on that order card (checkmark, muted style)
Does NOT close the tab or affect the table status
Realtime update reflects on screen immediately

Close tab

Tapping "Close Tab" on the right panel:

Sets ALL orders with that session_id to status = 'closed'
Sets tables.status = 'available' for that table
Right panel clears, left panel removes the table from occupied list


Confirmation prompt before executing ("Close tab for Table X — €XX.XX total?")
Never deletes any data (business rule #8)

Auth

Route protected by middleware — cashier and owner roles only
Session silently refreshes every 10 minutes (already in spec) to prevent idle logout

Realtime cleanup

Unsubscribe from all Realtime channels on component unmount
Handle reconnection gracefully — refetch state on reconnect


Left Panel — Table card spec
Each occupied table row shows:

Table number
Number of open orders in session (e.g. "2 orders")
Session running total (€XX.XX)
Time of first order in session
Coloured dot: green = available, amber = occupied

Unoccupied tables shown below occupied ones, greyed out, not tappable.

Right Panel — Tab detail spec
When a table is selected:

Session identifier (internal — not shown to customer, just for cashier reference)
Each order shown as a card with: order number, time placed, subtotal, status badge
Each order card expands to show all order_items: name snapshot, quantity, notes (if any), line total
Running total across all orders in session, prominent at bottom
"Mark Ready" button per order card (disabled if already ready)
"Close Tab" button once, at the bottom — applies to whole session


Decisions Locked (Phase 2)
#DecisionD34Split view layout — tables left, tab detail rightD35Each order card shows: table, items, total, timeD36Cashier can manually mark individual orders as readyD37Close tab closes all orders in session + frees tableD38Confirmation prompt before closing tabD39No cash handling UI in Phase 2

Acceptance Criteria

 Left panel shows all tables, occupied ones highlighted with running total
 Tapping a table loads full tab detail on the right instantly
 New order placed by customer appears on cashier screen without refresh
 "Mark Ready" sets order status to ready and updates visually
 "Close Tab" closes all orders in session and sets table to available
 Closed table disappears from occupied list immediately
 Cashier session does not time out (silent refresh working)
 All Realtime channels unsubscribe cleanly on unmount


Build Order
Step 1 — Claude Code builds:

Supabase query functions: fetch tables, fetch open orders with items grouped by session
Realtime subscription hooks (3 channels)
markOrderReady() server action
closeTab() server action (batch update orders + table)
Silent session refresh interval logic

Step 2 — Cursor builds:

Split view layout (iPad landscape)
Left panel: table cards with AutoAnimate for list changes
Right panel: tab detail, order cards, item list
"Mark Ready" and "Close Tab" buttons with confirmation modal
Realtime-driven UI updates
Animation moment #6 from spec: new order card slides in with highlight fade
Animation moment #7: tab total rolls up with spring when new order added