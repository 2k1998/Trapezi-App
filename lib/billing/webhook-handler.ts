import Stripe from 'stripe'
import { sendDunningNotifications } from '@/lib/billing/dunning'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function handleBillingEvent(
  event: Stripe.Event,
  supabase: SupabaseClient
): Promise<void> {
  switch (event.type) {
    case 'invoice.payment_succeeded': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invoice = event.data.object as any
      const subscriptionId = typeof invoice.subscription === 'string'
        ? invoice.subscription
        : (invoice.subscription?.id ?? null)

      if (!subscriptionId) break

      const periodEnd = invoice.lines?.data?.[0]?.period?.end as number | undefined
      const currentPeriodEnd = periodEnd ? new Date(periodEnd * 1000).toISOString() : null

      await supabase
        .from('restaurants')
        .update({
          subscription_status: 'active',
          dunning_day: 0,
          ...(currentPeriodEnd ? { current_period_end: currentPeriodEnd } : {}),
        })
        .eq('stripe_subscription_id', subscriptionId)

      break
    }

    case 'invoice.payment_failed': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invoice = event.data.object as any
      const subscriptionId = typeof invoice.subscription === 'string'
        ? invoice.subscription
        : (invoice.subscription?.id ?? null)

      if (!subscriptionId) break

      await supabase
        .from('restaurants')
        .update({ subscription_status: 'past_due', dunning_day: 1 })
        .eq('stripe_subscription_id', subscriptionId)

      // Fetch restaurant for dunning notifications
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('id, name, stripe_customer_id')
        .eq('stripe_subscription_id', subscriptionId)
        .single()

      if (!restaurant) break

      const { data: ownerRow } = await supabase
        .from('staff')
        .select('email')
        .eq('restaurant_id', restaurant.id)
        .eq('role', 'owner')
        .single()

      const { data: pushSubs } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('restaurant_id', restaurant.id)
        .eq('subscriber_type', 'staff')

      await sendDunningNotifications({
        id: restaurant.id,
        name: restaurant.name,
        dunning_day: 1,
        owner_email: ownerRow?.email ?? '',
        stripe_customer_id: restaurant.stripe_customer_id ?? '',
        push_subscriptions: pushSubs ?? [],
      })

      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      await supabase
        .from('restaurants')
        .update({ subscription_status: 'cancelled', plan: 'free', dunning_day: 0 })
        .eq('stripe_subscription_id', subscription.id)
      break
    }

    case 'customer.subscription.updated': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subscription = event.data.object as any
      const priceId = subscription.items?.data?.[0]?.price?.id as string | undefined
      const currentPeriodEnd = subscription.current_period_end
        ? new Date((subscription.current_period_end as number) * 1000).toISOString()
        : null

      const planUpdate: Record<string, string | null> = { current_period_end: currentPeriodEnd }
      if (priceId === process.env.STRIPE_PRICE_BASIC) {
        planUpdate.plan = 'basic'
      } else if (priceId === process.env.STRIPE_PRICE_PRO) {
        planUpdate.plan = 'pro'
      }

      await supabase
        .from('restaurants')
        .update(planUpdate)
        .eq('stripe_subscription_id', subscription.id)

      break
    }
  }
}
