import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe/server'
import { sendPaymentConfirmedSMS } from '@/lib/sms'
import { sendPushToRestaurant } from '@/lib/push/index.server'

// Must run in Node.js runtime — Edge runtime lacks crypto and Stripe needs it
export const runtime = 'nodejs'

const methodMap: Record<string, 'card' | 'apple_pay' | 'google_pay'> = {
  card: 'card',
  apple_pay: 'apple_pay',
  google_pay: 'google_pay',
  link: 'card', // Stripe Link falls back to card in our enum
}

function mapPaymentMethod(pi: Stripe.PaymentIntent): 'card' | 'apple_pay' | 'google_pay' {
  return methodMap[pi.payment_method_types?.[0]] ?? 'card'
}

export async function POST(request: NextRequest) {
  // Read raw body — required for Stripe signature verification
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return new Response('Invalid signature', { status: 400 })
  }

  // Only handle payment_intent.succeeded — return 200 for everything else
  if (event.type !== 'payment_intent.succeeded') {
    return Response.json({ received: true })
  }

  const paymentIntent = event.data.object as Stripe.PaymentIntent

  // Ignore events that aren't from our platform (no pending_order_id in metadata)
  if (!paymentIntent.metadata?.pending_order_id) {
    return Response.json({ received: true })
  }

  try {
    const {
      pending_order_id,
      restaurant_id,
      table_number,
      customer_phone,
    } = paymentIntent.metadata as {
      pending_order_id: string
      restaurant_id: string
      table_number: string
      customer_phone: string
    }

    // Service role client — bypasses RLS to confirm the pending order
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Find the pending order. Idempotency: if already paid, Stripe is retrying — do nothing.
    const { data: pendingOrder } = await supabase
      .from('orders')
      .select('id, payment_status, table_id, total')
      .eq('id', pending_order_id)
      .maybeSingle()

    if (!pendingOrder) {
      throw new Error(`Pending order ${pending_order_id} not found`)
    }

    if (pendingOrder.payment_status === 'paid') {
      return Response.json({ received: true })
    }

    // Confirm the order — items already exist from create-payment-intent
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'confirmed',
        payment_method: mapPaymentMethod(paymentIntent),
        payment_status: 'paid',
        stripe_payment_intent_id: paymentIntent.id,
      })
      .eq('id', pending_order_id)

    if (updateError) {
      throw new Error(`Order confirmation failed: ${updateError.message}`)
    }

    // Mark table as occupied
    await supabase
      .from('tables')
      .update({ status: 'occupied' })
      .eq('id', pendingOrder.table_id)

    // Get restaurant name for SMS
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('name')
      .eq('id', restaurant_id)
      .single()

    const restaurantName = (restaurant?.name as string | null) ?? ''

    // --- SMS: payment confirmed ---
    // Fire-and-forget. Never blocks the webhook response.
    if (customer_phone) {
      try {
        await sendPaymentConfirmedSMS({
          customer_phone,
          customer_locale: null,
          restaurant_name: restaurantName,
        })
        await supabase
          .from('orders')
          .update({ sms_payment_sent_at: new Date().toISOString() })
          .eq('id', pending_order_id)
      } catch (smsErr) {
        console.error('[Webhook] SMS send failed for order', pending_order_id, smsErr)
      }
    }

    // --- Push: new order notification to cashier ---
    // Fire-and-forget. Never blocks the webhook response.
    try {
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('quantity')
        .eq('order_id', pending_order_id)

      const itemCount = (orderItems ?? []).reduce((sum, i) => sum + (i.quantity as number), 0)
      const total = pendingOrder.total as number

      await sendPushToRestaurant(restaurant_id, {
        title: `New order at Table ${table_number}`,
        body: `€${total.toFixed(2)} — ${itemCount} item${itemCount !== 1 ? 's' : ''}`,
      })
    } catch (pushErr) {
      console.error('[Webhook] Push send failed for order', pending_order_id, pushErr)
    }

  } catch (err) {
    // Log with PaymentIntent ID for manual recovery — but still return 200.
    // Non-200 would cause Stripe to retry and potentially re-confirm the order.
    // The idempotency check above provides a safety net for retries.
    console.error('Webhook order confirmation failed', {
      paymentIntentId: paymentIntent.id,
      error: err,
    })
  }

  return Response.json({ received: true })
}
