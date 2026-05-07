import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/menu/auth'
import { earlyExitFee, contractEndDate, LEASE_MONTHLY_WITH_VAT } from '@/lib/billing/lease'
import type { BillingInfo } from '@/lib/types/billing'

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
    .select(
      'plan, subscription_status, dunning_day, contract_start_date, current_period_end, stripe_customer_id, stripe_subscription_id'
    )
    .eq('id', restaurantId)
    .single()

  if (error || !restaurant) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
  }

  const billingInfo: BillingInfo = {
    plan: (restaurant.plan ?? 'free') as BillingInfo['plan'],
    subscriptionStatus: (restaurant.subscription_status ?? 'active') as BillingInfo['subscriptionStatus'],
    dunningDay: restaurant.dunning_day ?? 0,
    contractStartDate: restaurant.contract_start_date ?? null,
    currentPeriodEnd: restaurant.current_period_end ?? null,
    stripeCustomerId: restaurant.stripe_customer_id ?? null,
    stripeSubscriptionId: restaurant.stripe_subscription_id ?? null,
  }

  const contractStart = restaurant.contract_start_date
    ? new Date(restaurant.contract_start_date)
    : null

  const exitFee = contractStart ? earlyExitFee(contractStart) : 0
  const contractEnd = contractStart ? contractEndDate(contractStart).toISOString() : null

  return NextResponse.json({
    ...billingInfo,
    earlyExitFee: exitFee,
    contractEndDate: contractEnd,
    leaseMonthlyWithVAT: LEASE_MONTHLY_WITH_VAT,
  })
}
