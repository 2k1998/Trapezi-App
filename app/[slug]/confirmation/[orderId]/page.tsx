import { redirect } from 'next/navigation'
import {
  ConfirmationClient,
  type OrderItemPayload,
  type OrderPayload,
} from '@/components/menu/ConfirmationClient'
import { createClient } from '@/lib/supabase/server'

type ApiResponse = {
  order: {
    id: string
    order_number: number
    total: number
    status: 'pending' | 'confirmed' | 'ready' | 'closed'
    payment_status: string
    session_id: string | null
  }
  items: Array<{
    name_snapshot: string
    quantity: number
    line_total: number
  }>
  tableNumber: number | null
}

async function fetchOrder(
  orderId: string,
  slug: string
): Promise<ApiResponse | null> {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'http://localhost:3000'
  const url = `${base}/api/orders/${orderId}?slug=${encodeURIComponent(slug)}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null
  return (await res.json()) as ApiResponse
}

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ slug: string; orderId: string }>
}) {
  const { slug, orderId } = await params
  const data = await fetchOrder(orderId, slug)
  if (!data) {
    redirect(`/${slug}`)
  }
  if (data.order.payment_status !== 'paid') {
    redirect(`/${slug}`)
  }

  const supabase = await createClient()
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, currency')
    .eq('slug', slug)
    .single()

  const currency = restaurant?.currency ?? 'EUR'
  const restaurantId = restaurant?.id ?? ''
  const restaurantName = (restaurant?.name as string | null) ?? ''

  const order: OrderPayload = {
    id: data.order.id,
    order_number: data.order.order_number,
    total: Number(data.order.total),
    status: data.order.status,
    payment_status: data.order.payment_status,
    session_id: data.order.session_id,
  }

  const items: OrderItemPayload[] = (data.items ?? []).map(i => ({
    name_snapshot: i.name_snapshot,
    quantity: i.quantity,
    line_total: Number(i.line_total),
  }))

  return (
    <ConfirmationClient
      slug={slug}
      tableNumber={data.tableNumber}
      currency={currency}
      order={order}
      items={items}
      restaurantId={restaurantId}
      restaurantName={restaurantName}
    />
  )
}
