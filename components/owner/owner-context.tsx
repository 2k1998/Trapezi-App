'use client'

import { createContext, useContext } from 'react'
import type { SubscriptionStatus } from '@/lib/types/billing'

export type OwnerRestaurantContextValue = {
  slug: string
  restaurantId: string
  restaurantName: string
  plan: string
  currency: string
  subscriptionStatus: SubscriptionStatus
  dunningDay: number
  contractStartDate: string | null
  currentPeriodEnd: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
}

const OwnerRestaurantContext = createContext<OwnerRestaurantContextValue | null>(null)

export function OwnerRestaurantProvider({
  value,
  children,
}: {
  value: OwnerRestaurantContextValue
  children: React.ReactNode
}) {
  return (
    <OwnerRestaurantContext.Provider value={value}>{children}</OwnerRestaurantContext.Provider>
  )
}

export function useOwnerRestaurant() {
  const ctx = useContext(OwnerRestaurantContext)
  if (!ctx) {
    throw new Error('useOwnerRestaurant must be used within OwnerRestaurantProvider')
  }
  return ctx
}
