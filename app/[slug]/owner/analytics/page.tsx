import type { Metadata } from 'next'
import { AnalyticsHub } from '@/components/owner/analytics/AnalyticsHub'

export const metadata: Metadata = {
  title: 'Analytics | Trapezi',
}

export default function OwnerAnalyticsPage() {
  return <AnalyticsHub />
}
