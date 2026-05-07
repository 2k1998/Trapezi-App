export type OrderHistoryItem = {
  name_snapshot: string
  quantity: number
  unit_price: number
  notes: string | null
}

export type OrderHistoryRow = {
  id: string
  table_number: number
  customer_name: string
  customer_phone: string
  total: number
  status: string
  created_at: string
  items: OrderHistoryItem[]
}

export type KPIMetrics = {
  total_revenue: number
  total_orders: number
  average_order_value: number
  wow_change_percent: number | null
}

export type BestSellerItem = {
  item_id: string
  name: string
  category: string | null
  units_sold: number
  total_revenue: number
}

export type BestSellerCategory = {
  category: string
  units_sold: number
  total_revenue: number
}

export type HeatmapCell = {
  day: number
  hour: number
  count: number
}

export type RevenueDataPoint = {
  label: string
  revenue: number
}

export type ReportSettings = {
  weekly_report_enabled: boolean
  weekly_report_email: string
}
