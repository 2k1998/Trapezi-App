'use client'

import { PushPermissionBanner } from '@/components/staff/PushPermissionBanner'

export function DashboardShell({ children }: { children?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-50">
      <PushPermissionBanner openRequestNonce={0} />
      {children}
    </div>
  )
}
