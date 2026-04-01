import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

// Initialise VAPID keys once at module load
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

// Service-role client — push operations run in webhook/action contexts
// where there may be no authenticated user session
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function saveSubscription(
  staffId: string,
  restaurantId: string,
  subscription: {
    endpoint: string
    keys: { p256dh: string; auth: string }
  }
): Promise<void> {
  const supabase = getServiceClient()

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        staff_id: staffId,
        restaurant_id: restaurantId,
        subscriber_type: 'staff',
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      { onConflict: 'endpoint' }
    )

  if (error) {
    console.error('[Push] Failed to save subscription:', error.message)
    throw error
  }
}


export async function deleteSubscription(endpoint: string): Promise<void> {
  const supabase = getServiceClient()

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)

  if (error) {
    console.error('[Push] Failed to delete subscription:', error.message)
    throw error
  }
}

// Sends to staff subscriptions only (not customer subscriptions)
export async function sendPushToRestaurant(
  restaurantId: string,
  payload: { title: string; body: string }
): Promise<void> {
  const supabase = getServiceClient()

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('restaurant_id', restaurantId)
    .eq('subscriber_type', 'staff')

  if (error) {
    console.error('[Push] Failed to fetch subscriptions:', error.message)
    return
  }

  console.log('[Push] sendPushToRestaurant — restaurant:', restaurantId, '— staff subs found:', subs?.length ?? 0, '— payload title:', payload.title)
  if (!subs || subs.length === 0) return

  const results = await Promise.allSettled(
    subs.map((sub, i) => {
      console.log(`[Push] Sending to endpoint ${i + 1}/${subs.length}:`, sub.endpoint.slice(0, 40) + '…')
      return webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload)
      )
    })
  )

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      console.log(`[Push] Sent OK to endpoint ${i + 1}:`, subs[i].endpoint.slice(0, 40) + '…', '— status:', result.value.statusCode)
    } else {
      console.error(`[Push] Failed to send to endpoint ${i + 1}:`, subs[i].endpoint.slice(0, 40) + '…', result.reason)
    }
  })
}

