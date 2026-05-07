import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: { restaurant_id?: string; plan?: 'basic' | 'pro'; owner_email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { restaurant_id, plan, owner_email } = body

  if (!restaurant_id || !plan || !owner_email) {
    return NextResponse.json(
      { error: 'restaurant_id, plan, and owner_email are required' },
      { status: 400 }
    )
  }

  if (plan !== 'basic' && plan !== 'pro') {
    return NextResponse.json({ error: 'plan must be basic or pro' }, { status: 400 })
  }

  const priceId = plan === 'basic'
    ? process.env.STRIPE_PRICE_BASIC
    : process.env.STRIPE_PRICE_PRO

  if (!priceId) {
    return NextResponse.json(
      { error: `STRIPE_PRICE_${plan.toUpperCase()} env var not set` },
      { status: 500 }
    )
  }

  const customer = await stripe.customers.create({
    email: owner_email,
    metadata: { restaurant_id },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: priceId }],
  }) as any

  const currentPeriodEnd = subscription.current_period_end
    ? new Date((subscription.current_period_end as number) * 1000).toISOString()
    : null

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('restaurants')
    .update({
      plan,
      stripe_customer_id: customer.id,
      stripe_subscription_id: subscription.id,
      contract_start_date: new Date().toISOString(),
      current_period_end: currentPeriodEnd,
      subscription_status: 'active',
      dunning_day: 0,
    })
    .eq('id', restaurant_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    stripe_subscription_id: subscription.id as string,
    current_period_end: currentPeriodEnd,
  })
}
