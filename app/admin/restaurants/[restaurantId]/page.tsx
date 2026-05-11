import { RestaurantDetail } from '@/components/admin/RestaurantDetail'
import type { AdminRestaurantDetail } from '@/lib/types/admin'
import type { AdminRestaurantSummary } from '@/lib/types/admin'
import type { Plan } from '@/lib/types/billing'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function AdminRestaurantDetailPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>
}) {
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
    throw new Error('Αποτυχία φόρτωσης στοιχείων εστιατορίου')
  }

  const restaurantRow = restaurantRes.value.data
  const ordersLast30 = ordersLast30Res.status === 'fulfilled' ? (ordersLast30Res.value.data ?? []) : []
  const revenue30d = ordersLast30.reduce((sum, order) => sum + (order.total ?? 0), 0)
  const staffRows = staffRes.status === 'fulfilled' ? (staffRes.value.data ?? []) : []
  const tableRows = tablesRes.status === 'fulfilled' ? (tablesRes.value.data ?? []) : []

  const restaurant: AdminRestaurantSummary = {
    id: restaurantRow.id,
    name: restaurantRow.name,
    slug: restaurantRow.slug,
    plan: restaurantRow.plan as Plan,
    subscription_status: restaurantRow.subscription_status ?? 'active',
    dunning_day: restaurantRow.dunning_day ?? 0,
    contract_start_date: restaurantRow.contract_start_date ?? null,
    current_period_end: restaurantRow.current_period_end ?? null,
    stripe_customer_id: restaurantRow.stripe_customer_id ?? null,
    stripe_subscription_id: restaurantRow.stripe_subscription_id ?? null,
    created_at: restaurantRow.created_at,
    metadata: restaurantRow.metadata ?? {},
    staff_count: staffRows.filter((staff: any) => !staff.deleted_at).length,
    menu_items_count:
      menuItemsRes.status === 'fulfilled'
        ? (menuItemsRes.value.data ?? []).filter((menuItem: any) => !menuItem.deleted_at).length
        : 0,
    tables_count: tableRows.filter((table: any) => !table.deleted_at).length,
    orders_count_30d: ordersLast30.length,
    revenue_30d: revenue30d,
  }

  const rawOrders = recentOrdersRes.status === 'fulfilled' ? (recentOrdersRes.value.data ?? []) : []

  const data: AdminRestaurantDetail = {
    restaurant,
    staff: staffRows.map((staff: any) => ({
      id: staff.id,
      display_name: staff.display_name,
      email: staff.email,
      role: staff.role,
      created_at: staff.created_at,
      pin_hash: staff.pin_hash ?? null,
      deleted_at: staff.deleted_at ?? null,
    })),
    tables: tableRows.map((table: any) => ({
      id: table.id,
      number: table.table_number,
      name: table.name ?? null,
      capacity: table.capacity ?? null,
      section_id: table.section_id ?? null,
      deleted_at: table.deleted_at ?? null,
    })),
    sections:
      sectionsRes.status === 'fulfilled'
        ? (sectionsRes.value.data ?? []).map((section: any) => ({
            id: section.id,
            name: section.name,
            display_order: section.display_order,
          }))
        : [],
    categories:
      categoriesRes.status === 'fulfilled'
        ? (categoriesRes.value.data ?? []).map((category: any) => ({
            id: category.id,
            name_el: category.name_el,
            name_en: category.name_en ?? null,
            position: category.position ?? 0,
          }))
        : [],
    menu_items:
      menuItemsRes.status === 'fulfilled'
        ? (menuItemsRes.value.data ?? []).map((menuItem: any) => ({
            id: menuItem.id,
            name_el: menuItem.name_el,
            name_en: menuItem.name_en ?? null,
            price: menuItem.price,
            type: menuItem.type,
            available: menuItem.is_available ?? true,
            category_id: menuItem.category_id ?? null,
            image_url: menuItem.image_url ?? null,
            deleted_at: menuItem.deleted_at ?? null,
          }))
        : [],
    menus:
      menusRes.status === 'fulfilled'
        ? (menusRes.value.data ?? []).map((menu: any) => ({
            id: menu.id,
            name: menu.name,
            is_default: menu.is_default ?? false,
            created_at: menu.created_at,
          }))
        : [],
    recent_orders: rawOrders.map((order: any) => ({
      id: order.id,
      table_number: order.tables?.table_number ?? null,
      status: order.status,
      total: order.total,
      created_at: order.created_at,
      customer_name: order.customer_name ?? null,
      items: (order.order_items ?? []).map((item: any) => ({
        id: item.id,
        name_snapshot: item.name_snapshot,
        quantity: item.quantity,
        price: item.unit_price,
      })),
    })),
    push_subscriptions_count:
      pushCountRes.status === 'fulfilled' ? (pushCountRes.value.count ?? 0) : 0,
  }

  return <RestaurantDetail detail={data} />
}
