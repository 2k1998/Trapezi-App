export type OrderItem = {
  id: string
  name_snapshot: string
  quantity: number
  unit_price: number
  line_total: number
  notes: string | null
  type: 'food' | 'drink'
}

export type Order = {
  id: string
  order_number: number
  table_id: string
  session_id: string | null
  status: 'pending' | 'confirmed' | 'ready' | 'closed'
  total: number
  created_at: string
}

export type OrderWithItems = Order & {
  order_items: OrderItem[]
}

export type TableRow = {
  id: string
  table_number: number
  label: string | null
  status: 'available' | 'occupied'
}

export type SessionGroup = {
  sessionId: string
  tableId: string
  tableNumber: number
  tableLabel: string | null
  orders: OrderWithItems[]
  sessionTotal: number
  firstOrderAt: string
}
