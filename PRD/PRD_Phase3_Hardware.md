PRD — Phase 3: Hardware (QZ Tray + Thermal Printers)
Version: 1.0 — March 2026
Tool: Claude Code entirely
Trigger: Print jobs fire automatically from the webhook handler after payment confirmed

Goals

Generate and send ESC/POS print jobs to 3 thermal printers the moment a payment is confirmed
No human interaction required — fully automatic
Kitchen gets food items only, bar gets drink items only, cashier gets everything

Non-Goals

No printer management UI in Phase 3
No reprint button (Phase 5 — owner dashboard)
No printer status monitoring
No QZ Tray installation logic (hardware friend handles this)


How it works
Customer pays
    → Stripe webhook fires
        → Order created in Supabase
            → printOrder() called with order + items
                → 3 print jobs generated simultaneously
                    → Kitchen slip (food items only)
                    → Bar slip (drink items only)
                    → Cashier slip (all items + total)
The iPad runs QZ Tray permanently in the background. QZ Tray exposes a WebSocket at localhost:8181. The cashier page connects to it and acts as the print server — it receives print commands via Supabase Realtime and sends them to QZ Tray.

Print slip format (all 3 printers)
================================
        TEST RESTAURANT
================================
Order #0042        Table 3
2026-03-26         13:32
--------------------------------
KITCHEN SLIP / BAR SLIP / CASHIER
--------------------------------
1x Margherita Pizza        €12.50
   no onions
1x Caesar Salad             €8.00
--------------------------------
TOTAL:                     €20.50   (cashier only)
================================
        Thank you!
================================
Rules:

Order number, table number, and time on every slip (for cross-referencing)
Kitchen slip: food items (type = 'food') only
Bar slip: drink items (type = 'drink') only
Cashier slip: all items + subtotal + total
Item notes printed on the line below the item name if present
name_snapshot used — never menu_items.name
58mm paper width (32 characters per line)


Architecture
Print jobs are NOT triggered directly from the webhook (server-side). The webhook has no access to QZ Tray which is a local device on the restaurant's WiFi.
The flow:

Webhook creates order in Supabase and sets orders.printed_at = null
Supabase Realtime fires onOrderChange INSERT on the cashier screen
Cashier screen receives the new order via the existing useRealtimeCashier hook
Cashier screen calls printOrder() with the order data
printOrder() connects to QZ Tray via WebSocket and sends 3 ESC/POS jobs
On success: calls /api/orders/mark-printed to set orders.printed_at = now()


Technical Spec
1. /lib/printing/escpos.ts — ESC/POS helpers

formatLine(left: string, right: string, width: number): string — formats a line with left and right text padded to width characters
generateKitchenSlip(order: OrderWithItems, restaurantName: string): string[] — returns array of ESC/POS commands for kitchen printer. Food items only.
generateBarSlip(order: OrderWithItems, restaurantName: string): string[] — returns array of ESC/POS commands for bar printer. Drink items only.
generateCashierSlip(order: OrderWithItems, restaurantName: string): string[] — returns array of ESC/POS commands for cashier printer. All items + total.
All slips: header with restaurant name, order number, table number, timestamp, divider, items, footer
Use standard ESC/POS commands: \x1B\x40 (init), \x1B\x61\x01 (center), \x1B\x45\x01 (bold on), \x1B\x45\x00 (bold off), \x1D\x56\x41 (cut paper)
Paper width: 32 characters

2. /lib/printing/qztray.ts — QZ Tray WebSocket client

connectQZTray(): Promise<WebSocket> — opens WebSocket to ws://localhost:8181, returns connected socket. Rejects with clear error if QZ Tray is not running.
sendPrintJob(socket: WebSocket, printerIp: string, commands: string[]): Promise<void> — sends ESC/POS commands to the specified printer IP via QZ Tray protocol
printOrder(order: OrderWithItems, printerConfig: PrinterConfig): Promise<PrintResult> — orchestrates all 3 print jobs simultaneously using Promise.allSettled. Never throws — returns result per printer so partial failures are handled gracefully.
PrinterConfig type: { kitchen: string, bar: string, cashier: string } — IP addresses
PrintResult type: { kitchen: 'ok' | 'error', bar: 'ok' | 'error', cashier: 'ok' | 'error' }

3. /lib/printing/usePrinting.ts — React hook for cashier screen

'use client' at top
Accepts restaurantId: string
Exposes printOrder(order: OrderWithItems): Promise<void>
Reads printer IPs from environment variables:

NEXT_PUBLIC_PRINTER_KITCHEN_IP
NEXT_PUBLIC_PRINTER_BAR_IP
NEXT_PUBLIC_PRINTER_CASHIER_IP


If any IP is not set: logs warning in development, skips that printer silently
On print failure: logs error, does not crash the cashier screen
On print success: calls /api/orders/mark-printed with the order id

4. /app/api/orders/mark-printed/route.ts — API route

Method: POST
Body: { orderId: string }
Sets orders.printed_at = now() for that order
Uses server Supabase client
Returns { success: boolean }

5. Update CashierScreen.tsx — wire up printing

Import usePrinting from @/lib/printing/usePrinting
In the onOrderChange callback, when event is INSERT: call printOrder(newOrder) automatically
No UI changes needed — printing is invisible to the cashier

6. Add to .env.local
NEXT_PUBLIC_PRINTER_KITCHEN_IP=192.168.1.101
NEXT_PUBLIC_PRINTER_BAR_IP=192.168.1.102
NEXT_PUBLIC_PRINTER_CASHIER_IP=192.168.1.103
These are placeholder IPs. Hardware friend sets the real static IPs during onboarding.

Decisions Locked (Phase 3)
#DecisionD40Print triggered from cashier screen via Realtime, not directly from webhookD41QZ Tray WebSocket at localhost:8181D4258mm paper, 32 chars per lineD43Promise.allSettled — partial print failure never crashes cashierD44Printer IPs stored as env vars, set per restaurant by hardware friendD45printed_at column set after successful print job

Acceptance Criteria

 generateKitchenSlip only includes food items
 generateBarSlip only includes drink items
 generateCashierSlip includes all items and total
 Item notes appear on the line below the item name
 printOrder uses Promise.allSettled — one printer failing doesn't affect others
 printed_at is set on the order after printing
 If printer IPs are not configured, cashier screen does not crash
 TypeScript compiles with no errors