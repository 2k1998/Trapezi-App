export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled'
export type Plan = 'free' | 'basic' | 'pro'

export interface BillingInfo {
  plan: Plan
  subscriptionStatus: SubscriptionStatus
  dunningDay: number
  contractStartDate: string | null
  currentPeriodEnd: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
}
