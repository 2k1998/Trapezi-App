'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useOwnerRestaurant } from '@/components/owner/owner-context'
import { EmptyState } from '@/components/owner/menu/EmptyState'
import { PlanGateAuto } from '@/components/owner/PlanGate'
import { OrderHistoryTab } from './OrderHistoryTab'
import { OverviewTab } from './OverviewTab'
import { PayoutsTab } from './PayoutsTab'
import { ReportsTab } from './ReportsTab'
import type { AnalyticsTabId } from './types'

function planLevel(plan: string): 'free' | 'basic' | 'pro' {
  const p = plan.toLowerCase()
  if (p === 'pro' || p === 'enterprise') return 'pro'
  if (p === 'basic') return 'basic'
  return 'free'
}

export function AnalyticsHub() {
  const { plan, restaurantId, currency } = useOwnerRestaurant()
  const level = planLevel(plan)
  const isPro = level === 'pro'
  const isBasic = level === 'basic'
  const isFree = level === 'free'

  const tabs = useMemo(() => {
    if (isPro) {
      return [
        { id: 'overview' as const, label: 'Overview' },
        { id: 'orderHistory' as const, label: 'Order History' },
        { id: 'payouts' as const, label: 'Payouts' },
        { id: 'reports' as const, label: 'Reports' },
      ]
    }
    if (isBasic) return [{ id: 'orderHistory' as const, label: 'Order History' }]
    return []
  }, [isPro, isBasic])

  const [tab, setTab] = useState<AnalyticsTabId>(isBasic ? 'orderHistory' : 'overview')

  if (isFree) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <div className="w-full max-w-3xl">
          <EmptyState
            title="Upgrade to access Analytics"
            hint="Analytics and reporting are available on Basic and Pro plans."
          />
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-4 flex flex-wrap gap-2 border-b border-brand-200 pb-4">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-brand-800 text-white'
                : 'bg-brand-100 text-brand-700 hover:bg-brand-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
        >
          {tab === 'overview' && isPro && (
            <PlanGateAuto requiredPlan="pro" featureName="Αναλυτικά στοιχεία">
              <OverviewTab restaurantId={restaurantId} currency={currency} />
            </PlanGateAuto>
          )}
          {tab === 'orderHistory' && (
            <OrderHistoryTab restaurantId={restaurantId} currency={currency} planLevel={level} />
          )}
          {tab === 'payouts' && isPro && (
            <PlanGateAuto requiredPlan="pro" featureName="Πληρωμές Stripe">
              <PayoutsTab restaurantId={restaurantId} />
            </PlanGateAuto>
          )}
          {tab === 'reports' && isPro && (
            <PlanGateAuto requiredPlan="pro" featureName="Εβδομαδιαία αναφορά">
              <ReportsTab restaurantId={restaurantId} currency={currency} />
            </PlanGateAuto>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
