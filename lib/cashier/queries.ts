import { createClient } from '@/lib/supabase/server'
import type { TableRow, OrderWithItems } from './types'

export async function getTablesForRestaurant(
  restaurantId: string
): Promise<TableRow[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tables')
    .select('id, table_number, label, status, sections(name)')
    .eq('restaurant_id', restaurantId)
    .order('table_number', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map(row => ({
    id: row.id,
    table_number: row.table_number,
    label: row.label,
    status: row.status,
    section_name: row.sections
      ? (Array.isArray(row.sections)
          ? (row.sections[0] as { name: string } | undefined)?.name
          : (row.sections as { name: string }).name) ?? null
      : null,
  })) as TableRow[]
}

export async function getOpenOrdersWithItems(
  restaurantId: string
): Promise<OrderWithItems[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('orders')
    .select(
      `id, order_number, table_id, session_id, status, total, created_at,
       order_items (id, name_snapshot, quantity, unit_price, line_total, notes, type)`
    )
    .eq('restaurant_id', restaurantId)
    .neq('status', 'closed')
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []) as OrderWithItems[]
}

