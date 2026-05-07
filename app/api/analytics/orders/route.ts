import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/menu/auth'
import { getOrderHistory } from '@/lib/analytics/queries'
import { requirePlan, effectivePlan } from '@/lib/plans/gates'
import type { Plan } from '@/lib/plans/gates'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const restaurantId = params.get('restaurantId')
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 })
  }

  const auth = await requireStaff(restaurantId, false, true)
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })

  const supabase = createServiceClient()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('plan, subscription_status, dunning_day')
    .eq('id', restaurantId)
    .single()

  try {
    requirePlan(
      (restaurant?.plan ?? 'free') as Plan,
      (restaurant?.subscription_status ?? 'active') as string,
      (restaurant?.dunning_day ?? 0) as number,
      'basic'
    )
  } catch {
    return NextResponse.json({ error: 'plan_required', required: 'basic' }, { status: 403 })
  }

  const plan = effectivePlan(
    (restaurant?.plan ?? 'free') as Plan,
    (restaurant?.subscription_status ?? 'active') as string,
    (restaurant?.dunning_day ?? 0) as number
  )

  const rawFrom = params.get('from')
  const rawTo = params.get('to')
  const now = new Date()

  let from = rawFrom ? new Date(rawFrom) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  let to = rawTo ? new Date(rawTo) : now

  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
  }

  // Basic plan: cap history to last 7 days
  if (plan === 'basic') {
    const floor = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    if (from < floor) from = floor
  }

  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(params.get('pageSize') ?? '50', 10)))
  const search = params.get('search') ?? undefined
  const tableNumberRaw = params.get('tableNumber')
  const tableNumberParsed = tableNumberRaw !== null ? parseInt(tableNumberRaw, 10) : NaN
  const tableNumber = !isNaN(tableNumberParsed) ? tableNumberParsed : undefined
  const status = params.get('status') ?? undefined

  try {
    const { rows, total } = await getOrderHistory(
      supabase, restaurantId, { from, to }, page, pageSize, search, tableNumber, status
    )
    return NextResponse.json({ rows, total, page, pageSize })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
