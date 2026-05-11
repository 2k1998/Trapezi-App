import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { AdminRestaurantDetail, AdminRestaurantSummary } from '@/lib/types/admin'
import type { Plan } from '@/lib/types/billing'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const auth = await requireAdmin(request)
  if (auth instanceof Response) return auth

  const { restaurantId } = await params
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    restaurantRes,
    staffRes,
    tablesRes,
    sectionsRes,
    categoriesRes,
    menuItemsRes,
    menusRes,
    recentOrdersRes,
    pushCountRes,
    ordersLast30Res,
  ] = await Promise.allSettled([
    supabaseAdmin.from('restaurants').select('*').eq('id', restaurantId).single(),
    supabaseAdmin.from('staff').select('*').eq('restaurant_id', restaurantId),
    supabaseAdmin.from('tables').select('*').eq('restaurant_id', restaurantId),
    supabaseAdmin.from('sections').select('*').eq('restaurant_id', restaurantId),
    supabaseAdmin.from('categories').select('*').eq('restaurant_id', restaurantId),
    supabaseAdmin.from('menu_items').select('*').eq('restaurant_id', restaurantId),
    supabaseAdmin.from('menus').select('*').eq('restaurant_id', restaurantId),
    supabaseAdmin
      .from('orders')
      .select('*, order_items(*), tables(table_number)')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabaseAdmin
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId),
    supabaseAdmin
      .from('orders')
      .select('total')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', thirtyDaysAgo),
  ])

  if (restaurantRes.status === 'rejected' || restaurantRes.value.error || !restaurantRes.value.data) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
  }

  const r = restaurantRes.value.data
  const ordersLast30 = ordersLast30Res.status === 'fulfilled' ? (ordersLast30Res.value.data ?? []) : []
  const revenue30d = ordersLast30.reduce((sum, o) => sum + (o.total ?? 0), 0)

  const staffRows = staffRes.status === 'fulfilled' ? (staffRes.value.data ?? []) : []
  const tableRows = tablesRes.status === 'fulfilled' ? (tablesRes.value.data ?? []) : []

  const restaurant: AdminRestaurantSummary = {
    id: r.id,
    name: r.name,
    slug: r.slug,
    plan: r.plan as Plan,
    subscription_status: r.subscription_status ?? 'active',
    dunning_day: r.dunning_day ?? 0,
    contract_start_date: r.contract_start_date ?? null,
    current_period_end: r.current_period_end ?? null,
    stripe_customer_id: r.stripe_customer_id ?? null,
    stripe_subscription_id: r.stripe_subscription_id ?? null,
    created_at: r.created_at,
    metadata: r.metadata ?? {},
    staff_count: staffRows.filter((s: any) => !s.deleted_at).length,
    menu_items_count:
      menuItemsRes.status === 'fulfilled'
        ? (menuItemsRes.value.data ?? []).filter((m: any) => !m.deleted_at).length
        : 0,
    tables_count: tableRows.filter((t: any) => !t.deleted_at).length,
    orders_count_30d: ordersLast30.length,
    revenue_30d: revenue30d,
  }

  const rawOrders = recentOrdersRes.status === 'fulfilled' ? (recentOrdersRes.value.data ?? []) : []

  const detail: AdminRestaurantDetail = {
    restaurant,
    staff: staffRows.map((s: any) => ({
      id: s.id,
      display_name: s.display_name,
      email: s.email,
      role: s.role,
      created_at: s.created_at,
      pin_hash: s.pin_hash ?? null,
      deleted_at: s.deleted_at ?? null,
    })),
    tables: tableRows.map((t: any) => ({
      id: t.id,
      number: t.table_number,
      name: t.name ?? null,
      capacity: t.capacity ?? null,
      section_id: t.section_id ?? null,
      deleted_at: t.deleted_at ?? null,
    })),
    sections:
      sectionsRes.status === 'fulfilled'
        ? (sectionsRes.value.data ?? []).map((s: any) => ({
            id: s.id,
            name: s.name,
            display_order: s.display_order,
          }))
        : [],
    categories:
      categoriesRes.status === 'fulfilled'
        ? (categoriesRes.value.data ?? []).map((c: any) => ({
            id: c.id,
            name_el: c.name_el,
            name_en: c.name_en ?? null,
            position: c.position ?? 0,
          }))
        : [],
    menu_items:
      menuItemsRes.status === 'fulfilled'
        ? (menuItemsRes.value.data ?? []).map((m: any) => ({
            id: m.id,
            name_el: m.name_el,
            name_en: m.name_en ?? null,
            price: m.price,
            type: m.type,
            available: m.is_available ?? true,
            category_id: m.category_id ?? null,
            image_url: m.image_url ?? null,
            deleted_at: m.deleted_at ?? null,
          }))
        : [],
    menus:
      menusRes.status === 'fulfilled'
        ? (menusRes.value.data ?? []).map((m: any) => ({
            id: m.id,
            name: m.name,
            is_default: m.is_default ?? false,
            created_at: m.created_at,
          }))
        : [],
    recent_orders: rawOrders.map((o: any) => ({
      id: o.id,
      table_number: o.tables?.table_number ?? null,
      status: o.status,
      total: o.total,
      created_at: o.created_at,
      customer_name: o.customer_name ?? null,
      items: (o.order_items ?? []).map((i: any) => ({
        id: i.id,
        name_snapshot: i.name_snapshot,
        quantity: i.quantity,
        price: i.unit_price,
      })),
    })),
    push_subscriptions_count:
      pushCountRes.status === 'fulfilled' ? (pushCountRes.value.count ?? 0) : 0,
  }

  return NextResponse.json(detail)
}
