'use server'

import { createClient } from '@/lib/supabase/server'
import { saveSubscription } from '@/lib/push/index.server'

export type PushSubscriptionPayload = {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export async function savePushSubscriptionAction(
  body: PushSubscriptionPayload
): Promise<{ ok: true } | { ok: false; error: string }> {
  console.log('[Push][action] savePushSubscriptionAction called. Endpoint (first 40):', body.endpoint?.slice(0, 40))

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    console.error('[Push][action] Invalid payload — missing endpoint or keys')
    return { ok: false, error: 'Invalid subscription payload' }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  console.log('[Push][action] Auth user:', user?.id ?? null, 'Auth error:', authError?.message ?? null)

  if (!user) {
    return { ok: false, error: 'Unauthorized' }
  }

  const { data: staffRow, error: staffError } = await supabase
    .from('staff')
    .select('restaurant_id')
    .eq('id', user.id)
    .single()

  console.log('[Push][action] Staff row:', staffRow, 'Staff error:', staffError?.message ?? null)

  if (!staffRow) {
    return { ok: false, error: 'Staff record not found' }
  }

  try {
    await saveSubscription(user.id, staffRow.restaurant_id, body)
    console.log('[Push][action] Subscription saved for staff:', user.id, 'restaurant:', staffRow.restaurant_id)
    return { ok: true }
  } catch (e) {
    console.error('[Push][action] saveSubscription threw:', e)
    return { ok: false, error: 'Failed to save subscription' }
  }
}
