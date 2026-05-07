'use client'

import { Lock } from 'lucide-react'
import { effectivePlan, planAtLeast, type Plan } from '@/lib/plans/gates'
import type { SubscriptionStatus } from '@/lib/types/billing'
import { useOwnerRestaurant } from '@/components/owner/owner-context'

type RequiredPlan = 'basic' | 'pro'

interface PlanGateProps {
  requiredPlan: RequiredPlan
  currentPlan: Plan
  subscriptionStatus: SubscriptionStatus
  dunningDay: number
  featureName: string
  children: React.ReactNode
}

function planBadgeClass(plan: RequiredPlan): string {
  if (plan === 'basic') return 'bg-blue-100 text-blue-800'
  return 'bg-accent-400/30 text-accent-700'
}

function planLabel(plan: RequiredPlan): string {
  if (plan === 'basic') return 'Basic'
  return 'Pro'
}

function normalisePlan(plan: string): Plan {
  const p = plan.toLowerCase()
  if (p === 'pro' || p === 'enterprise') return 'pro'
  if (p === 'basic') return 'basic'
  return 'free'
}

export function PlanGate({
  requiredPlan,
  currentPlan,
  subscriptionStatus,
  dunningDay,
  featureName,
  children,
}: PlanGateProps) {
  const eff = effectivePlan(currentPlan, subscriptionStatus, dunningDay)

  if (planAtLeast(eff, requiredPlan)) {
    return <>{children}</>
  }

  return (
    <div className="rounded-xl border border-brand-200 bg-white p-8 text-center shadow-card">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-accent-600">
        <Lock className="h-6 w-6" aria-hidden />
      </div>
      <p className="font-display text-lg font-semibold text-brand-900">{featureName}</p>
      <div className="mt-3 flex items-center justify-center gap-2">
        <span className="text-xs uppercase tracking-wide text-brand-500">Απαιτεί πλάνο</span>
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${planBadgeClass(requiredPlan)}`}
        >
          {planLabel(requiredPlan)}
        </span>
      </div>
      <p className="mx-auto mt-4 max-w-md text-sm text-brand-600">
        Αυτή η λειτουργία είναι διαθέσιμη μόνο σε εστιατόρια με πλάνο{' '}
        {planLabel(requiredPlan)}. Επικοινωνήστε μαζί μας για αναβάθμιση.
      </p>
      <a
        href="mailto:billing@trapeziapp.com"
        className="mt-5 inline-flex items-center justify-center rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-900"
      >
        Επικοινωνήστε μαζί μας για αναβάθμιση
      </a>
    </div>
  )
}

interface PlanGateAutoProps {
  requiredPlan: RequiredPlan
  featureName: string
  children: React.ReactNode
}

export function PlanGateAuto({ requiredPlan, featureName, children }: PlanGateAutoProps) {
  const { plan, subscriptionStatus, dunningDay } = useOwnerRestaurant()
  return (
    <PlanGate
      requiredPlan={requiredPlan}
      currentPlan={normalisePlan(plan)}
      subscriptionStatus={subscriptionStatus}
      dunningDay={dunningDay}
      featureName={featureName}
    >
      {children}
    </PlanGate>
  )
}
