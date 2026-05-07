import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe/server'
import { sendPushToRestaurant } from '@/lib/push/index.server'
import { handleBillingEvent } from '@/lib/billing/webhook-handler'

// Must run in Node.js runtime — Edge runtime lacks crypto and Stripe needs it
export const runtime = 'nodejs'

const BILLING_EVENT_PREFIXES = ['invoice.', 'customer.subscription.']

function isBillingEvent(eventType: string): boolean {
  return BILLING_EVENT_PREFIXES.some(prefix => eventType.startsWith(prefix))
}

const methodMap: Record<string, 'card' | 'apple_pay' | 'google_pay'> = {
  card: 'card',
  apple_pay: 'apple_pay',
  google_pay: 'google_pay',
  link: 'card',
}

function mapPaymentMethod(pi: Stripe.PaymentIntent): 'card' | 'apple_pay' | 'google_pay' {
  return methodMap[pi.payment_method_types?.[0]] ?? 'card'
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')
  const stripeAccount = request.headers.get('stripe-account')

  console.log('[webhook] incoming:', { stripeAccount })

  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  // Peek at event type before full verification to pick the right secret.
  // We do a lightweight JSON parse just to read the type field.
  let eventTypePeek: string
  try {
    eventTypePeek = (JSON.parse(body) as { type: string }).type ?? ''
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  const webhookSecret = isBillingEvent(eventTypePeek)
    ? process.env.STRIPE_BILLING_WEBHOOK_SECRET!
    : process.env.STRIPE_WEBHOOK_SECRET!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return new Response('Invalid signature', { status: 400 })
  }

  console.log('[webhook] event:', { type: event.type, account: event.account ?? stripeAccount })

  // Route billing events to the billing handler
  if (isBillingEvent(event.type)) {
    try {
      const supabase = getServiceClient()
      await handleBillingEvent(event, supabase)
    } catch (err) {
      console.error('[webhook] Billing event handler failed:', { type: event.type, err })
    }
    return Response.json({ received: true })
  }

  // Return 200 for non-payment_intent events
  if (event.type !== 'payment_intent.succeeded') {
    return Response.json({ received: true })
  }

  const paymentIntent = event.data.object as Stripe.PaymentIntent

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

    const supabase = getServiceClient()

    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('stripe_payment_intent_id', paymentIntent.id)
      .maybeSingle()

    if (existingOrder) {
      console.log('[webhook] Order already confirmed for PI, skipping:', paymentIntent.id)
      return Response.json({ received: true })
    }

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

    await supabase
      .from('tables')
      .update({ status: 'occupied' })
      .eq('id', pendingOrder.table_id)

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
    console.error('Webhook order confirmation failed', {
      paymentIntentId: (event.data.object as Stripe.PaymentIntent).id,
      error: err,
    })
  }

  return Response.json({ received: true })
}
