import webpush from 'web-push'
import { Resend } from 'resend'
import { stripe } from '@/lib/stripe/server'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export interface DunningPushSubscription {
  endpoint: string
  p256dh: string
  auth: string
}

export interface DunningRestaurant {
  id: string
  name: string
  dunning_day: number
  owner_email: string
  stripe_customer_id: string
  push_subscriptions: DunningPushSubscription[]
}

export async function sendDunningNotifications(restaurant: DunningRestaurant): Promise<void> {
  const daysLeft = 10 - restaurant.dunning_day

  // Push to all staff subscriptions
  if (restaurant.push_subscriptions.length > 0) {
    const pushPayload = JSON.stringify({
      title: '⚠️ Πρόβλημα πληρωμής / Payment Issue',
      body: `Απομένουν ${daysLeft} ημέρες πριν την αναστολή / ${daysLeft} days until suspension`,
    })

    await Promise.allSettled(
      restaurant.push_subscriptions.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          pushPayload
        )
      )
    )
  }

  // Email via Resend
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Dunning] RESEND_API_KEY not set — skipping email')
    return
  }

  let portalUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://trapeziapp.com'
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: restaurant.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://trapeziapp.com'}/owner`,
    })
    portalUrl = session.url
  } catch (err) {
    console.error('[Dunning] Failed to create portal session:', err)
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#c0392b;padding:24px 32px;">
            <h2 style="margin:0;color:#ffffff;font-size:20px;">⚠️ Trapezi — Πρόβλημα Πληρωμής</h2>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px;color:#1a1a1a;font-size:24px;">Αποτυχία πληρωμής συνδρομής</h1>
            <div style="text-align:center;margin:24px 0;padding:20px;background:#fff5f5;border-radius:8px;border:2px solid #e74c3c;">
              <p style="margin:0;font-size:14px;color:#666;">Απομένουν</p>
              <p style="margin:4px 0;font-size:48px;font-weight:700;color:#c0392b;">${daysLeft}</p>
              <p style="margin:0;font-size:16px;color:#c0392b;font-weight:600;">ημέρες / days until suspension</p>
            </div>
            <p style="color:#444;font-size:15px;line-height:1.6;">
              Η πληρωμή της συνδρομής σας για το εστιατόριο <strong>${restaurant.name}</strong> απέτυχε.
              Το Stripe θα επαναλάβει αυτόματα την χρέωση.
            </p>
            <p style="color:#444;font-size:15px;line-height:1.6;">
              Your subscription payment for <strong>${restaurant.name}</strong> has failed.
              Stripe will automatically retry the charge. Please update your payment method to avoid service suspension.
            </p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${portalUrl}" style="display:inline-block;background:#c0392b;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:16px;font-weight:600;">
                Ενημέρωση τρόπου πληρωμής
              </a>
            </div>
            <p style="color:#999;font-size:13px;text-align:center;margin-top:32px;">
              <a href="https://trapeziapp.com" style="color:#999;">trapeziapp.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  await resend.emails.send({
    from: 'Trapezi <noreply@trapeziapp.com>',
    to: restaurant.owner_email,
    subject: `⚠️ Αποτυχία πληρωμής — ${daysLeft} ημέρες απομένουν`,
    html,
  })
}
