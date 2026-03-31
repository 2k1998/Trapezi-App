import type { Order, TableRow, OrderWithItems, SessionGroup } from './types'

export function getSessionTotal(orders: Order[]): number {
  return parseFloat(
    orders.reduce((sum, order) => sum + order.total, 0).toFixed(2)
  )
}

export function groupOrdersBySession(
  tables: TableRow[],
  orders: OrderWithItems[]
): SessionGroup[] {
  const tableMap = new Map<string, TableRow>(tables.map((t) => [t.id, t]))

  const groupMap = new Map<string, SessionGroup>()

  for (const order of orders) {
    const sessionId = order.session_id ?? order.id
    const table = tableMap.get(order.table_id)

    if (!table) continue

    const existing = groupMap.get(sessionId)
    if (existing) {
      existing.orders.push(order)
      existing.sessionTotal = parseFloat(
        (existing.sessionTotal + order.total).toFixed(2)
      )
      if (order.created_at < existing.firstOrderAt) {
        existing.firstOrderAt = order.created_at
      }
    } else {
      groupMap.set(sessionId, {
        sessionId,
        tableId: order.table_id,
        tableNumber: table.table_number,
        tableLabel: table.label,
        orders: [order],
        sessionTotal: order.total,
        firstOrderAt: order.created_at,
      })
    }
  }

  return Array.from(groupMap.values()).sort((a, b) =>
    a.firstOrderAt.localeCompare(b.firstOrderAt)
  )
}
