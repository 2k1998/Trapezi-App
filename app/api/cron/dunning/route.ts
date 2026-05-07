import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe/server'
import { sendDunningNotifications } from '@/lib/billing/dunning'
import { Resend } from 'resend'

export const runtime = 'nodejs'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function logCronFailure(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  restaurantId: string,
  errorMessage: string
): Promise<void> {
  try {
    await supabase
      .from('cron_failures')
      .insert({ job_name: 'dunning', error_message: `[${restaurantId}] ${errorMessage}` })
  } catch (err) {
    console.error('[Dunning] Failed to log cron failure:', err)
  }
}

async function sendCancellationEmail(ownerEmail: string, restaurantName: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) return
  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: 'Trapezi <noreply@trapeziapp.com>',
    to: ownerEmail,
    subject: 'Η συνδρομή σας ακυρώθηκε',
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#1a1a1a;padding:24px 32px;">
          <h2 style="margin:0;color:#ffffff;font-size:20px;">Trapezi — Ακύρωση Συνδρομής</h2>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;color:#1a1a1a;">Η συνδρομή σας ακυρώθηκε</h1>
          <p style="color:#444;font-size:15px;line-height:1.6;">
            Η συνδρομή για το εστιατόριο <strong>${restaurantName}</strong> ακυρώθηκε λόγω μη πληρωμής.
            Ο λογαριασμός σας υποβαθμίστηκε στο δωρεάν πλάνο.
          </p>
          <p style="color:#444;font-size:15px;line-height:1.6;">
            Your subscription for <strong>${restaurantName}</strong> has been cancelled due to non-payment.
            Your account has been downgraded to the free plan.
          </p>
          <p style="color:#999;font-size:13px;text-align:center;margin-top:32px;">
            <a href="https://trapeziapp.com" style="color:#999;">trapeziapp.com</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  })
}

export async function POST(request: NextRequest) {
  if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = getServiceClient()

  const { data: restaurants, error } = await supabase
    .from('restaurants')
    .select('id, name, dunning_day, stripe_subscription_id, stripe_customer_id')
    .eq('subscription_status', 'past_due')

  if (error) {
    console.error('[Dunning] Failed to fetch past_due restaurants:', error.message)
    return NextResponse.json({ error: 'Failed to fetch restaurants' }, { status: 500 })
  }

  if (!restaurants || restaurants.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  const results = await Promise.allSettled(
    restaurants.map(async restaurant => {
      const newDunningDay = (restaurant.dunning_day ?? 0) + 1

      if (newDunningDay >= 10) {
        // Cancel subscription on Stripe
        if (restaurant.stripe_subscription_id) {
          try {
            await stripe.subscriptions.cancel(restaurant.stripe_subscription_id)
          } catch (err) {
            console.error('[Dunning] Failed to cancel Stripe subscription:', restaurant.id, err)
          }
        }

        await supabase
          .from('restaurants')
          .update({ subscription_status: 'cancelled', plan: 'free', dunning_day: 0 })
          .eq('id', restaurant.id)

        // Fetch owner email for cancellation email
        const { data: ownerRow } = await supabase
          .from('staff')
          .select('email')
          .eq('restaurant_id', restaurant.id)
          .eq('role', 'owner')
          .single()

        if (ownerRow?.email) {
          await sendCancellationEmail(ownerRow.email, restaurant.name).catch(err =>
            console.error('[Dunning] Cancellation email failed:', restaurant.id, err)
          )
        }
      } else {
        await supabase
          .from('restaurants')
          .update({ dunning_day: newDunningDay })
          .eq('id', restaurant.id)

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
          dunning_day: newDunningDay,
          owner_email: ownerRow?.email ?? '',
          stripe_customer_id: restaurant.stripe_customer_id ?? '',
          push_subscriptions: pushSubs ?? [],
        })
      }
    })
  )

  const failed = results.filter(r => r.status === 'rejected')
  for (let i = 0; i < failed.length; i++) {
    const rejection = failed[i] as PromiseRejectedResult
    const restaurantId = restaurants[i]?.id ?? 'unknown'
    const message = rejection.reason instanceof Error
      ? rejection.reason.message
      : String(rejection.reason)
    console.error('[Dunning] Failed for restaurant:', restaurantId, message)
    await logCronFailure(supabase, restaurantId, message)
  }

  return NextResponse.json({ processed: restaurants.length })
}
