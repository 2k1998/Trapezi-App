import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/menu/auth'
import { stripe } from '@/lib/stripe/server'
import { requirePlan } from '@/lib/plans/gates'
import type { Plan } from '@/lib/plans/gates'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  let body: { restaurantId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { restaurantId } = body
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 })
  }

  const auth = await requireStaff(restaurantId, false, true)
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })

  const supabase = createServiceClient()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('stripe_account_id, plan, subscription_status, dunning_day')
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

  if (!restaurant?.stripe_account_id) {
    return NextResponse.json({ error: 'NO_STRIPE_ACCOUNT' }, { status: 400 })
  }

  try {
    const loginLink = await stripe.accounts.createLoginLink(restaurant.stripe_account_id)
    return NextResponse.json(
      { url: loginLink.url },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create login link'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
