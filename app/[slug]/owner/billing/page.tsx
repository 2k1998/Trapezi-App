import type { Metadata } from 'next'
import { BillingHub } from '@/components/owner/billing/BillingHub'

export const metadata: Metadata = {
  title: 'Χρέωση | Trapezi',
}

export default function OwnerBillingPage() {
  return <BillingHub />
}
