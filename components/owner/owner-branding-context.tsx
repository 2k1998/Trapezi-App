'use client'

import { createContext, useContext } from 'react'
import type { BrandingSettings } from '@/lib/types/staff'

type OwnerBrandingContextValue = {
  branding: BrandingSettings | null
  setBranding: (next: BrandingSettings | null) => void
}

const OwnerBrandingContext = createContext<OwnerBrandingContextValue | null>(null)

export function OwnerBrandingProvider({
  value,
  children,
}: {
  value: OwnerBrandingContextValue
  children: React.ReactNode
}) {
  return <OwnerBrandingContext.Provider value={value}>{children}</OwnerBrandingContext.Provider>
}

export function useOwnerBranding() {
  const ctx = useContext(OwnerBrandingContext)
  if (!ctx) {
    throw new Error('useOwnerBranding must be used within OwnerBrandingProvider')
  }
  return ctx
}
