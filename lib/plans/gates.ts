export type Plan = 'free' | 'basic' | 'pro'

const PLAN_RANK: Record<Plan, number> = { free: 0, basic: 1, pro: 2 }

export function planAtLeast(restaurantPlan: Plan, required: Plan): boolean {
  return PLAN_RANK[restaurantPlan] >= PLAN_RANK[required]
}

export function effectivePlan(
  plan: Plan,
  subscriptionStatus: string,
  dunningDay: number
): Plan {
  if (subscriptionStatus === 'cancelled') return 'free'
  if (subscriptionStatus === 'past_due' && dunningDay >= 10) return 'free'
  return plan
}

export function requirePlan(
  plan: Plan,
  subscriptionStatus: string,
  dunningDay: number,
  required: Plan
): void {
  const effective = effectivePlan(plan, subscriptionStatus, dunningDay)
  if (!planAtLeast(effective, required)) {
    throw new Error(`plan_required:${required}`)
  }
}
