'use client'

import { useState } from 'react'
import { ErrorBanner } from '@/components/owner/menu/Banners'
import { apiSendJson } from '@/lib/menu/client-api'

type Props = {
  restaurantId: string
}

type StripeLinkResponse = {
  url: string
}

export function PayoutsTab({ restaurantId }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notConnected, setNotConnected] = useState(false)

  const onOpen = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiSendJson<StripeLinkResponse>(
        '/api/analytics/stripe-dashboard-link',
        'POST',
        { restaurantId }
      )
      if (!data?.url) throw new Error('Missing Stripe dashboard URL')
      window.open(data.url, '_blank')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to open Stripe dashboard'
      if (message.includes('NO_STRIPE_ACCOUNT')) {
        setNotConnected(true)
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl rounded-xl border border-brand-200 bg-white p-8 text-center shadow-card">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-2xl text-accent-600">
        $
      </div>
      <h3 className="text-2xl font-display text-brand-900">Your Stripe Payouts</h3>
      <p className="mx-auto mt-3 max-w-2xl text-sm text-brand-600">
        Your payments are processed directly through your Stripe account. Access your
        full payout history, bank details, and transaction records below.
      </p>

      {notConnected ? (
        <p className="mt-6 text-sm font-medium text-brand-700">
          Your Stripe account is not connected yet. Please contact support.
        </p>
      ) : (
        <button
          type="button"
          disabled={loading}
          onClick={onOpen}
          className="mt-6 rounded-xl bg-brand-800 px-6 py-3 text-base font-medium text-white hover:bg-brand-900 disabled:opacity-60"
        >
          {loading ? 'Opening…' : 'Open Stripe Dashboard ->'}
        </button>
      )}
    </div>
  )
}
