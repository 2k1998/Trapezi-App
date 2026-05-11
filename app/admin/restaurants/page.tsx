import { RestaurantList } from '@/components/admin/RestaurantList'
import type { AdminRestaurantSummary } from '@/lib/types/admin'
import type { Plan } from '@/lib/types/billing'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function AdminRestaurantsPage() {
  const { data: restaurants, error } = await supabaseAdmin
    .from('restaurants')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error('Αποτυχία φόρτωσης εστιατορίων')
  }

  const data: AdminRestaurantSummary[] = await Promise.all(
    (restaurants ?? []).map(async (restaurant) => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const [staffRes, menuRes, tablesRes, ordersCountRes, revenueRes] = await Promise.allSettled([
        supabaseAdmin
          .from('staff')
          .select('*', { count: 'exact', head: true })
          .eq('restaurant_id', restaurant.id)
          .is('deleted_at', null),
        supabaseAdmin
          .from('menu_items')
          .select('*', { count: 'exact', head: true })
          .eq('restaurant_id', restaurant.id)
          .is('deleted_at', null),
        supabaseAdmin
          .from('tables')
          .select('*', { count: 'exact', head: true })
          .eq('restaurant_id', restaurant.id)
          .is('deleted_at', null),
        supabaseAdmin
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('restaurant_id', restaurant.id)
          .gte('created_at', thirtyDaysAgo),
        supabaseAdmin
          .from('orders')
          .select('total')
          .eq('restaurant_id', restaurant.id)
          .gte('created_at', thirtyDaysAgo),
      ])

      const staffCount = staffRes.status === 'fulfilled' ? (staffRes.value.count ?? 0) : 0
      const menuCount = menuRes.status === 'fulfilled' ? (menuRes.value.count ?? 0) : 0
      const tablesCount = tablesRes.status === 'fulfilled' ? (tablesRes.value.count ?? 0) : 0
      const ordersCount = ordersCountRes.status === 'fulfilled' ? (ordersCountRes.value.count ?? 0) : 0
      const revenue30d =
        revenueRes.status === 'fulfilled'
          ? (revenueRes.value.data ?? []).reduce((sum, order) => sum + (order.total ?? 0), 0)
          : 0

      return {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        plan: restaurant.plan as Plan,
        subscription_status: restaurant.subscription_status ?? 'active',
        dunning_day: restaurant.dunning_day ?? 0,
        contract_start_date: restaurant.contract_start_date ?? null,
        current_period_end: restaurant.current_period_end ?? null,
        stripe_customer_id: restaurant.stripe_customer_id ?? null,
        stripe_subscription_id: restaurant.stripe_subscription_id ?? null,
        created_at: restaurant.created_at,
        metadata: restaurant.metadata ?? {},
        staff_count: staffCount,
        menu_items_count: menuCount,
        tables_count: tablesCount,
        orders_count_30d: ordersCount,
        revenue_30d: revenue30d,
      }
    })
  )

  return <RestaurantList initialRestaurants={data} />
}
