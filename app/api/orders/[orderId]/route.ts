import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ orderId: string }>
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { orderId } = await params
  const slug = request.nextUrl.searchParams.get('slug')

  if (!slug) {
    return NextResponse.json({ error: 'Missing slug parameter' }, { status: 400 })
  }

  const supabase = await createClient()

  // Fetch order with joined table and restaurant for security verification
  const { data: order } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      table_id,
      total,
      status,
      payment_status,
      created_at,
      customer_name,
      session_id,
      tables ( table_number ),
      restaurants ( slug )
    `)
    .eq('id', orderId)
    .single()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Security: ensure this order belongs to the requested restaurant
  const restaurantData = order.restaurants as { slug: string } | { slug: string }[] | null
  const restaurantSlug = Array.isArray(restaurantData)
    ? restaurantData[0]?.slug
    : restaurantData?.slug

  if (restaurantSlug !== slug) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Fetch order items
  const { data: items } = await supabase
    .from('order_items')
    .select('id, name_snapshot, type, quantity, unit_price, line_total, notes')
    .eq('order_id', orderId)
    .order('created_at')

  const tableData = order.tables as { table_number: number } | { table_number: number }[] | null
  const tableNumber = Array.isArray(tableData)
    ? tableData[0]?.table_number
    : tableData?.table_number

  return NextResponse.json({
    order: {
      id: order.id,
      order_number: order.order_number,
      table_id: order.table_id,
      total: order.total,
      status: order.status,
      payment_status: order.payment_status,
      created_at: order.created_at,
      customer_name: order.customer_name,
      session_id: order.session_id,
    },
    items: items ?? [],
    tableNumber: tableNumber ?? null,
  })
}
