'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useOwnerRestaurant } from '@/components/owner/owner-context'
import { apiGetJson } from '@/lib/menu/client-api'

export function PastDueBanner() {
  const { subscriptionStatus, dunningDay, restaurantId, slug } = useOwnerRestaurant()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (subscriptionStatus !== 'past_due') return null

  const daysRemaining = Math.max(0, 10 - dunningDay)

  const onUpdatePayment = async () => {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const data = await apiGetJson<{ url: string }>(
        `/api/billing/portal?restaurantId=${encodeURIComponent(restaurantId)}&slug=${encodeURIComponent(slug)}`
      )
      window.location.href = data.url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Αποτυχία ανοίγματος πύλης πληρωμής')
      setLoading(false)
    }
  }

  return (
    <div
      role="alert"
      className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 lg:px-6"
    >
      <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-700" aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="font-medium">
          Αποτυχία πληρωμής — απομένουν {daysRemaining}{' '}
          {daysRemaining === 1 ? 'ημέρα' : 'ημέρες'} πριν την αναστολή της υπηρεσίας.
        </p>
        {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => void onUpdatePayment()}
        disabled={loading}
        className="flex-shrink-0 rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-medium text-red-800 transition-colors hover:bg-red-100 disabled:opacity-60"
      >
        {loading ? 'Φόρτωση...' : 'Ενημέρωση τρόπου πληρωμής'}
      </button>
    </div>
  )
}
