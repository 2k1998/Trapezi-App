import { toZonedTime } from 'date-fns-tz'
import { getDay, getHours, format, isSameDay } from 'date-fns'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  OrderHistoryRow,
  OrderHistoryItem,
  KPIMetrics,
  BestSellerItem,
  BestSellerCategory,
  HeatmapCell,
  RevenueDataPoint,
} from '@/types/analytics'

const ATHENS_TZ = 'Europe/Athens'

type DateRange = { from: Date; to: Date }

export async function getOrderHistory(
  supabase: SupabaseClient,
  restaurantId: string,
  range: DateRange,
  page = 1,
  pageSize = 50,
  search?: string,
  tableNumber?: number,
  status?: string
): Promise<{ rows: OrderHistoryRow[]; total: number }> {
  // If searching, find order IDs from items whose name matches first
  let itemOrderIds: string[] | null = null
  if (search) {
    const { data: matchingItems } = await supabase
      .from('order_items')
      .select('order_id')
      .eq('restaurant_id', restaurantId)
      .ilike('name_snapshot', `%${search}%`)
    itemOrderIds = (matchingItems ?? []).map((r: { order_id: string }) => r.order_id)
  }

  let query = supabase
    .from('orders')
    .select('id, customer_name, customer_phone, total, status, created_at, table_id, tables(table_number)', { count: 'exact' })
    .eq('restaurant_id', restaurantId)
    .gte('created_at', range.from.toISOString())
    .lte('created_at', range.to.toISOString())
    .order('created_at', { ascending: false })

  if (tableNumber !== undefined) {
    // Filter via the joined tables relation
    query = query.eq('tables.table_number', tableNumber)
  }
  if (status) {
    query = query.eq('status', status)
  }
  if (search) {
    const namePhoneFilter = `customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`
    if (itemOrderIds && itemOrderIds.length > 0) {
      query = query.or(`${namePhoneFilter},id.in.(${itemOrderIds.join(',')})`)
    } else {
      query = query.or(namePhoneFilter)
    }
  }

  const start = (page - 1) * pageSize
  query = query.range(start, start + pageSize - 1)

  const { data: orders, count, error } = await query
  if (error) throw new Error(error.message)
  if (!orders || orders.length === 0) return { rows: [], total: 0 }

  // Fetch items for returned orders
  const orderIds = orders.map((o: { id: string }) => o.id)
  const { data: items } = await supabase
    .from('order_items')
    .select('order_id, name_snapshot, quantity, unit_price, notes')
    .in('order_id', orderIds)

  const itemMap = new Map<string, OrderHistoryItem[]>()
  for (const item of items ?? []) {
    const r = item as { order_id: string; name_snapshot: string; quantity: number; unit_price: number; notes: string | null }
    if (!itemMap.has(r.order_id)) itemMap.set(r.order_id, [])
    itemMap.get(r.order_id)!.push({
      name_snapshot: r.name_snapshot,
      quantity: r.quantity,
      unit_price: Number(r.unit_price),
      notes: r.notes ?? null,
    })
  }

  const rows: OrderHistoryRow[] = (orders as Array<{
    id: string
    customer_name: string | null
    customer_phone: string | null
    total: number
    status: string
    created_at: string
    tables: Array<{ table_number: number }> | { table_number: number } | null
  }>).map(o => {
    const tableNum = Array.isArray(o.tables)
      ? (o.tables[0]?.table_number ?? 0)
      : (o.tables?.table_number ?? 0)
    return {
      id: o.id,
      table_number: tableNum,
      customer_name: o.customer_name ?? '',
      customer_phone: o.customer_phone ?? '',
      total: Number(o.total),
      status: o.status,
      created_at: o.created_at,
      items: itemMap.get(o.id) ?? [],
    }
  })

  return { rows, total: count ?? 0 }
}

export async function getKPIMetrics(
  supabase: SupabaseClient,
  restaurantId: string,
  range: DateRange
): Promise<KPIMetrics> {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('total')
    .eq('restaurant_id', restaurantId)
    .gte('created_at', range.from.toISOString())
    .lte('created_at', range.to.toISOString())

  if (error) throw new Error(error.message)

  const totalOrders = (orders ?? []).length
  const totalRevenue = (orders ?? []).reduce((sum, o: { total: number }) => sum + Number(o.total), 0)
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

  // Prior period: same duration immediately before range.from
  const durationMs = range.to.getTime() - range.from.getTime()
  const priorFrom = new Date(range.from.getTime() - durationMs)
  const priorTo = new Date(range.from.getTime() - 1)

  const { data: priorOrders } = await supabase
    .from('orders')
    .select('total')
    .eq('restaurant_id', restaurantId)
    .gte('created_at', priorFrom.toISOString())
    .lte('created_at', priorTo.toISOString())

  const priorRevenue = (priorOrders ?? []).reduce((sum, o: { total: number }) => sum + Number(o.total), 0)

  let wowChangePercent: number | null = null
  if (priorRevenue > 0) {
    wowChangePercent = Math.round(((totalRevenue - priorRevenue) / priorRevenue) * 1000) / 10
  }

  return { total_revenue: totalRevenue, total_orders: totalOrders, average_order_value: averageOrderValue, wow_change_percent: wowChangePercent }
}

export async function getBestSellers(
  supabase: SupabaseClient,
  restaurantId: string,
  range: DateRange
): Promise<{ items: BestSellerItem[]; categories: BestSellerCategory[] }> {
  // Get order IDs in range
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .gte('created_at', range.from.toISOString())
    .lte('created_at', range.to.toISOString())

  if (ordersError) throw new Error(ordersError.message)
  if (!orders || orders.length === 0) return { items: [], categories: [] }

  const orderIds = orders.map((o: { id: string }) => o.id)

  const { data: orderItems, error: itemsError } = await supabase
    .from('order_items')
    .select('menu_item_id, name_snapshot, quantity, unit_price, line_total')
    .in('order_id', orderIds)

  if (itemsError) throw new Error(itemsError.message)
  if (!orderItems || orderItems.length === 0) return { items: [], categories: [] }

  // Aggregate by name_snapshot
  const itemAgg = new Map<string, { menu_item_id: string; units_sold: number; total_revenue: number }>()
  for (const oi of orderItems as Array<{ menu_item_id: string; name_snapshot: string; quantity: number; unit_price: number; line_total: number }>) {
    const existing = itemAgg.get(oi.name_snapshot)
    if (existing) {
      existing.units_sold += oi.quantity
      existing.total_revenue += Number(oi.line_total)
    } else {
      itemAgg.set(oi.name_snapshot, {
        menu_item_id: oi.menu_item_id,
        units_sold: oi.quantity,
        total_revenue: Number(oi.line_total),
      })
    }
  }

  // Look up categories from menu_items by matching name_en or name_el
  const nameSnapshots = Array.from(itemAgg.keys())
  const { data: menuItems } = await supabase
    .from('menu_items')
    .select('id, name_en, name_el, category')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)

  // Build lookup: name → category
  const categoryByName = new Map<string, string | null>()
  for (const mi of menuItems ?? [] as Array<{ id: string; name_en: string | null; name_el: string | null; category: string | null }>) {
    const typed = mi as { id: string; name_en: string | null; name_el: string | null; category: string | null }
    if (typed.name_en) categoryByName.set(typed.name_en, typed.category)
    if (typed.name_el) categoryByName.set(typed.name_el, typed.category)
  }

  // Build BestSellerItem list, sorted by units_sold desc, top 10
  const items: BestSellerItem[] = Array.from(itemAgg.entries())
    .map(([name, agg]) => ({
      item_id: agg.menu_item_id,
      name,
      category: categoryByName.get(name) ?? null,
      units_sold: agg.units_sold,
      total_revenue: agg.total_revenue,
    }))
    .sort((a, b) => b.units_sold - a.units_sold)
    .slice(0, 10)

  // Aggregate by category
  const catAgg = new Map<string, { units_sold: number; total_revenue: number }>()
  for (const [name, agg] of itemAgg.entries()) {
    const cat = categoryByName.get(name) ?? 'Uncategorized'
    const existing = catAgg.get(cat)
    if (existing) {
      existing.units_sold += agg.units_sold
      existing.total_revenue += agg.total_revenue
    } else {
      catAgg.set(cat, { units_sold: agg.units_sold, total_revenue: agg.total_revenue })
    }
  }

  const categories: BestSellerCategory[] = Array.from(catAgg.entries())
    .map(([category, agg]) => ({ category, ...agg }))
    .sort((a, b) => b.units_sold - a.units_sold)

  // Suppress unused-variable warning for nameSnapshots (used implicitly via itemAgg keys)
  void nameSnapshots

  return { items, categories }
}

export async function getHeatmap(
  supabase: SupabaseClient,
  restaurantId: string,
  range: DateRange
): Promise<HeatmapCell[]> {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('created_at')
    .eq('restaurant_id', restaurantId)
    .gte('created_at', range.from.toISOString())
    .lte('created_at', range.to.toISOString())

  if (error) throw new Error(error.message)

  // day (0=Sun…6=Sat) × hour (0–23) → count
  const cellMap = new Map<string, number>()
  for (const order of orders ?? [] as Array<{ created_at: string }>) {
    const typed = order as { created_at: string }
    const athens = toZonedTime(new Date(typed.created_at), ATHENS_TZ)
    const day = getDay(athens)
    const hour = getHours(athens)
    const key = `${day}:${hour}`
    cellMap.set(key, (cellMap.get(key) ?? 0) + 1)
  }

  return Array.from(cellMap.entries()).map(([key, count]) => {
    const [day, hour] = key.split(':').map(Number)
    return { day, hour, count }
  })
}

export async function getRevenueChart(
  supabase: SupabaseClient,
  restaurantId: string,
  range: DateRange
): Promise<RevenueDataPoint[]> {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('created_at, total')
    .eq('restaurant_id', restaurantId)
    .gte('created_at', range.from.toISOString())
    .lte('created_at', range.to.toISOString())

  if (error) throw new Error(error.message)

  const fromAthens = toZonedTime(range.from, ATHENS_TZ)
  const toAthens = toZonedTime(range.to, ATHENS_TZ)
  const singleDay = isSameDay(fromAthens, toAthens)

  const buckets = new Map<string, number>()

  if (singleDay) {
    // Pre-fill 24 hourly buckets
    for (let h = 0; h < 24; h++) {
      buckets.set(`${String(h).padStart(2, '0')}:00`, 0)
    }
  }

  for (const order of orders ?? [] as Array<{ created_at: string; total: number }>) {
    const typed = order as { created_at: string; total: number }
    const athens = toZonedTime(new Date(typed.created_at), ATHENS_TZ)

    let label: string
    if (singleDay) {
      label = `${String(getHours(athens)).padStart(2, '0')}:00`
    } else {
      label = format(athens, 'yyyy-MM-dd')
    }

    buckets.set(label, (buckets.get(label) ?? 0) + Number(typed.total))
  }

  if (singleDay) {
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, revenue]) => ({ label, revenue }))
  }

  // Multi-day: sort by date ascending
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, revenue]) => ({ label, revenue }))
}

type ExportOrderRow = {
  id: string
  table_number: number
  customer_name: string
  customer_phone: string
  total: number
  status: string
  created_at: string
}

type ExportOrderItemRow = {
  order_id: string
  table_number: number
  name_snapshot: string
  quantity: number
  unit_price: number
  subtotal: number
  created_at: string
}

export async function getOrdersForExport(
  supabase: SupabaseClient,
  restaurantId: string,
  range: DateRange
): Promise<{ orders: ExportOrderRow[]; orderItems: ExportOrderItemRow[] }> {
  const { data: rawOrders, error } = await supabase
    .from('orders')
    .select('id, customer_name, customer_phone, total, status, created_at, tables(table_number)')
    .eq('restaurant_id', restaurantId)
    .gte('created_at', range.from.toISOString())
    .lte('created_at', range.to.toISOString())
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  if (!rawOrders || rawOrders.length === 0) return { orders: [], orderItems: [] }

  const orders: ExportOrderRow[] = (rawOrders as Array<{
    id: string
    customer_name: string | null
    customer_phone: string | null
    total: number
    status: string
    created_at: string
    tables: Array<{ table_number: number }> | { table_number: number } | null
  }>).map(o => {
    const tableNum = Array.isArray(o.tables)
      ? (o.tables[0]?.table_number ?? 0)
      : (o.tables?.table_number ?? 0)
    return {
      id: o.id,
      table_number: tableNum,
      customer_name: o.customer_name ?? '',
      customer_phone: o.customer_phone ?? '',
      total: Number(o.total),
      status: o.status,
      created_at: o.created_at,
    }
  })

  const orderIds = orders.map(o => o.id)
  const tableByOrderId = new Map<string, number>(
    orders.map(o => [o.id, o.table_number])
  )

  const { data: rawItems, error: itemsError } = await supabase
    .from('order_items')
    .select('order_id, name_snapshot, quantity, unit_price, line_total, created_at')
    .in('order_id', orderIds)
    .order('created_at', { ascending: true })

  if (itemsError) throw new Error(itemsError.message)

  const orderItems: ExportOrderItemRow[] = (rawItems ?? [] as Array<{
    order_id: string
    name_snapshot: string
    quantity: number
    unit_price: number
    line_total: number
    created_at: string
  }>).map((oi) => {
    const typed = oi as { order_id: string; name_snapshot: string; quantity: number; unit_price: number; line_total: number; created_at: string }
    return {
      order_id: typed.order_id,
      table_number: tableByOrderId.get(typed.order_id) ?? 0,
      name_snapshot: typed.name_snapshot,
      quantity: typed.quantity,
      unit_price: Number(typed.unit_price),
      subtotal: Number(typed.line_total),
      created_at: typed.created_at,
    }
  })

  return { orders, orderItems }
}
