import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Called by the customer-facing confirmation screen after Stripe redirect.
// Polls until the webhook has created the order in Supabase.
export async function GET(request: NextRequest) {
  const pi = request.nextUrl.searchParams.get('pi')
  const slug = request.nextUrl.searchParams.get('slug')

  console.log('[by-payment-intent] params:', { pi, slug })

  if (!pi || !slug) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }

  const supabase = await createClient()

  // Stripe payment intent IDs are globally unique — no need to filter by
  // restaurant_id. Removing the slug→restaurant join eliminates a second
  // failure point and avoids a 404 if the restaurant lookup ever fails.
  const { data: order, error } = await supabase
    .from('orders')
    .select('id, order_number, status, total, table_id, created_at')
    .eq('stripe_payment_intent_id', pi)
    .single()

  console.log('[by-payment-intent] query result:', { order, error })

  if (error || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  return NextResponse.json(order)
}
