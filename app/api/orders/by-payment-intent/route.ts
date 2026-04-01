import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Called by the customer-facing confirmation screen after Stripe redirect.
// Polls until the webhook has created the order in Supabase.
// Uses the service role client to bypass RLS — this endpoint is
// intentionally unauthenticated (customer lands here after payment).
export async function GET(request: NextRequest) {
  const pi = request.nextUrl.searchParams.get('pi')
  const slug = request.nextUrl.searchParams.get('slug')

  console.log('[by-payment-intent] params:', { pi, slug })

  if (!pi || !slug) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Resolve slug → restaurant for logging purposes
  const { data: restaurant, error: restaurantError } = await supabase
    .from('restaurants')
    .select('id, name')
    .eq('slug', slug)
    .single()

  console.log('[by-payment-intent] restaurant lookup:', { slug, restaurant, error: restaurantError })

  // Stripe payment intent IDs are globally unique — no need to filter by
  // restaurant_id. The slug lookup above is for logging only.
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, order_number, status, total, table_id, created_at')
    .eq('stripe_payment_intent_id', pi)
    .single()

  console.log('[by-payment-intent] order lookup:', { pi, order, error: orderError })

  if (orderError || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  return NextResponse.json(order)
}
