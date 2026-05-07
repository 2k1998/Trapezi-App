import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/menu/auth'
import { getBestSellers } from '@/lib/analytics/queries'
import { requirePlan } from '@/lib/plans/gates'
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
      'pro'
    )
  } catch {
    return NextResponse.json({ error: 'plan_required', required: 'pro' }, { status: 403 })
  }

  const rawFrom = params.get('from')
  const rawTo = params.get('to')
  if (!rawFrom || !rawTo) {
    return NextResponse.json({ error: 'from and to are required' }, { status: 400 })
  }

  const from = new Date(rawFrom)
  const to = new Date(rawTo)
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
  }

  try {
    const result = await getBestSellers(supabase, restaurantId, { from, to })
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
