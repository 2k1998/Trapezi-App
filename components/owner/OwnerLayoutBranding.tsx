'use client'

import { useEffect, useState } from 'react'
import { OwnerShell } from '@/components/owner/OwnerShell'
import { OwnerBrandingProvider } from '@/components/owner/owner-branding-context'
import type { BrandingSettings } from '@/lib/types/staff'

type Props = {
  slug: string
  restaurantId: string
  restaurantName: string
  plan: string
  initialBranding: BrandingSettings | null
  children: React.ReactNode
}

const DEFAULT_ACCENT = '#1D6FBF'
const DEFAULT_SECONDARY = '#6B6860'

export function OwnerLayoutBranding({
  slug,
  restaurantId,
  restaurantName,
  plan,
  initialBranding,
  children,
}: Props) {
  const [branding, setBranding] = useState<BrandingSettings | null>(initialBranding)

  useEffect(() => {
    let cancelled = false

    const loadBranding = async () => {
      try {
        const res = await fetch(
          `/api/settings/branding?restaurantId=${encodeURIComponent(restaurantId)}`,
          { credentials: 'include' }
        )
        if (!res.ok) return
        const payload = (await res.json()) as BrandingSettings
        if (cancelled) return
        setBranding(payload)
      } catch {
        // Silent fallback to defaults.
      }
    }

    void loadBranding()
    return () => {
      cancelled = true
    }
  }, [restaurantId])

  return (
    <OwnerBrandingProvider value={{ branding, setBranding }}>
      <OwnerShell
        slug={slug}
        restaurantName={restaurantName}
        plan={plan}
        logoUrl={branding?.logo_url ?? null}
        accentColor={branding?.accent_color ?? DEFAULT_ACCENT}
        secondaryColor={branding?.secondary_color ?? DEFAULT_SECONDARY}
      >
        {children}
      </OwnerShell>
    </OwnerBrandingProvider>
  )
}
