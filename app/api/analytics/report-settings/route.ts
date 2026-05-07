import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/menu/auth'
import type { ReportSettings } from '@/types/analytics'
import { requirePlan } from '@/lib/plans/gates'
import type { Plan } from '@/lib/plans/gates'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const restaurantId = request.nextUrl.searchParams.get('restaurantId')
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 })
  }

  const auth = await requireStaff(restaurantId, false, true)
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })

  const supabase = createServiceClient()

  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .select('metadata, owner_email, plan, subscription_status, dunning_day')
    .eq('id', restaurantId)
    .single()

  if (error || !restaurant) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
  }

  try {
    requirePlan(
      (restaurant.plan ?? 'free') as Plan,
      (restaurant.subscription_status ?? 'active') as string,
      (restaurant.dunning_day ?? 0) as number,
      'pro'
    )
  } catch {
    return NextResponse.json({ error: 'plan_required', required: 'pro' }, { status: 403 })
  }

  const meta = (restaurant.metadata as Record<string, unknown>) ?? {}
  const settings: ReportSettings = {
    weekly_report_enabled: meta.weekly_report_enabled !== false,
    weekly_report_email: typeof meta.weekly_report_email === 'string'
      ? meta.weekly_report_email
      : (restaurant.owner_email ?? ''),
  }

  return NextResponse.json(settings)
}

export async function PATCH(request: NextRequest) {
  const restaurantId = request.nextUrl.searchParams.get('restaurantId')
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 })
  }

  const auth = await requireStaff(restaurantId, false, true)
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })

  let patch: Partial<ReportSettings>
  try {
    patch = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Read current metadata to merge without overwriting other keys
  const { data: restaurant, error: fetchError } = await supabase
    .from('restaurants')
    .select('metadata, owner_email, plan, subscription_status, dunning_day')
    .eq('id', restaurantId)
    .single()

  if (fetchError || !restaurant) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
  }

  try {
    requirePlan(
      (restaurant.plan ?? 'free') as Plan,
      (restaurant.subscription_status ?? 'active') as string,
      (restaurant.dunning_day ?? 0) as number,
      'pro'
    )
  } catch {
    return NextResponse.json({ error: 'plan_required', required: 'pro' }, { status: 403 })
  }

  const currentMeta = (restaurant.metadata as Record<string, unknown>) ?? {}
  const updatedMeta: Record<string, unknown> = { ...currentMeta }

  if (patch.weekly_report_enabled !== undefined) {
    updatedMeta.weekly_report_enabled = patch.weekly_report_enabled
  }
  if (patch.weekly_report_email !== undefined) {
    updatedMeta.weekly_report_email = patch.weekly_report_email
  }

  const { error: updateError } = await supabase
    .from('restaurants')
    .update({ metadata: updatedMeta })
    .eq('id', restaurantId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const settings: ReportSettings = {
    weekly_report_enabled: updatedMeta.weekly_report_enabled !== false,
    weekly_report_email: typeof updatedMeta.weekly_report_email === 'string'
      ? updatedMeta.weekly_report_email
      : (restaurant.owner_email ?? ''),
  }

  return NextResponse.json(settings)
}
