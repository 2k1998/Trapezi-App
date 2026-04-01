import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError) {
    console.error('[Push/subscribe] Auth error:', authError)
    return NextResponse.json({ error: 'Auth error' }, { status: 401 })
  }

  if (!user) {
    console.error('[Push/subscribe] No authenticated user')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[Push/subscribe] Authenticated user id:', user.id)

  // Get the staff record to find restaurant_id
  const { data: staffRow, error: staffError } = await supabase
    .from('staff')
    .select('restaurant_id')
    .eq('id', user.id)
    .single()

  if (staffError) {
    console.error('[Push/subscribe] Staff lookup error:', staffError)
    return NextResponse.json({ error: 'Staff lookup failed' }, { status: 500 })
  }

  if (!staffRow) {
    console.error('[Push/subscribe] No staff row for user id:', user.id)
    return NextResponse.json({ error: 'Staff record not found' }, { status: 403 })
  }

  console.log('[Push/subscribe] Staff restaurant_id:', staffRow.restaurant_id)

  const body = await request.json() as {
    endpoint: string
    keys: { p256dh: string; auth: string }
  }

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription payload' }, { status: 400 })
  }

  // Insert directly with the session client so auth.uid() resolves correctly in RLS.
  // Upsert on endpoint so re-subscribing the same browser doesn't create duplicates.
  const { error: upsertError } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        staff_id: user.id,
        restaurant_id: staffRow.restaurant_id,
        subscriber_type: 'staff',
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      },
      { onConflict: 'endpoint' }
    )

  if (upsertError) {
    console.error('[Push/subscribe] Upsert error:', JSON.stringify(upsertError))
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
  }

  // Confirm the row is actually in the table
  const { data: saved, error: confirmError } = await supabase
    .from('push_subscriptions')
    .select('id, staff_id, restaurant_id, subscriber_type')
    .eq('endpoint', body.endpoint)
    .maybeSingle()

  if (confirmError) {
    console.error('[Push/subscribe] Confirm fetch error:', JSON.stringify(confirmError))
  } else {
    console.log('[Push/subscribe] Row confirmed in DB:', JSON.stringify(saved))
  }

  return NextResponse.json({ ok: true })
}
