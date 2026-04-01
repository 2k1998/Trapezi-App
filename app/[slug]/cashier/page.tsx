import type { Metadata } from 'next'
import { getOpenOrdersWithItems, getTablesForRestaurant } from '@/lib/cashier/index.server'
import { createClient } from '@/lib/supabase/server'
import { CashierScreen } from '@/components/cashier/CashierScreen'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('name')
    .eq('slug', slug)
    .single()

  if (!restaurant) {
    return { title: 'Cashier | Trapezi' }
  }

  const name =
    typeof restaurant.name === 'string'
      ? restaurant.name
      : 'Restaurant'

  return {
    title: `${name} — Cashier | Trapezi`,
  }
}

export default async function CashierPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const supabase = await createClient()
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, currency, metadata')
    .eq('slug', slug)
    .single()

  if (!restaurant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-50 px-4">
        <p className="text-sm font-medium text-brand-700">Restaurant not found</p>
      </div>
    )
  }

  const [tables, orders] = await Promise.all([
    getTablesForRestaurant(restaurant.id),
    getOpenOrdersWithItems(restaurant.id),
  ])

  const printers = (restaurant.metadata as Record<string, unknown> | null)?.printers
  const printerConfig =
    printers !== null &&
    typeof printers === 'object' &&
    typeof (printers as Record<string, unknown>).kitchen === 'string' &&
    typeof (printers as Record<string, unknown>).bar === 'string' &&
    typeof (printers as Record<string, unknown>).cashier === 'string'
      ? (printers as { kitchen: string; bar: string; cashier: string })
      : null

  return (
    <CashierScreen
      restaurantId={restaurant.id}
      restaurantName={restaurant.name}
      currency={restaurant.currency ?? 'EUR'}
      printerConfig={printerConfig}
      initialTables={tables}
      initialOrders={orders}
    />
  )
}
