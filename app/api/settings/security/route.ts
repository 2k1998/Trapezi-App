import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/menu/auth'
import { createServiceClient } from '@/lib/supabase/server'
import type { SecuritySettings } from '@/lib/types/staff'

export const runtime = 'nodejs'

const VALID_TIMEOUTS = [5, 10, 15, 20, 30]

export async function GET(request: NextRequest) {
  const restaurantId = request.nextUrl.searchParams.get('restaurantId')
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 })
  }

  const auth = await requireStaff(restaurantId, false, true)
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('restaurants')
    .select('metadata')
    .eq('id', restaurantId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })

  const meta = (data.metadata as Record<string, unknown>) ?? {}
  const timeout = (meta.inactivity_timeout_minutes as number) ?? 15
  const settings: SecuritySettings = { inactivity_timeout_minutes: timeout }

  return NextResponse.json(settings)
}

export async function PATCH(request: NextRequest) {
  let body: { restaurantId?: string; inactivity_timeout_minutes?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { restaurantId, inactivity_timeout_minutes } = body
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 })
  }
  if (
    inactivity_timeout_minutes === undefined ||
    !VALID_TIMEOUTS.includes(inactivity_timeout_minutes)
  ) {
    return NextResponse.json(
      { error: `inactivity_timeout_minutes must be one of: ${VALID_TIMEOUTS.join(', ')}` },
      { status: 400 }
    )
  }

  const auth = await requireStaff(restaurantId, false, true)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const supabase = createServiceClient()
  const { data: restaurant, error: fetchError } = await supabase
    .from('restaurants')
    .select('metadata')
    .eq('id', restaurantId)
    .single()

  if (fetchError || !restaurant) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
  }

  const existingMeta = (restaurant.metadata as Record<string, unknown>) ?? {}

  const { error: updateError } = await supabase
    .from('restaurants')
    .update({ metadata: { ...existingMeta, inactivity_timeout_minutes } })
    .eq('id', restaurantId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  const settings: SecuritySettings = { inactivity_timeout_minutes }
  return NextResponse.json(settings)
}
