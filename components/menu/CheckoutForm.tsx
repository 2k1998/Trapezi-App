'use client'

import Link from 'next/link'
import { useState } from 'react'
import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import type { CartItem } from '@/lib/hooks/useCart'
import { formatMoney } from '@/lib/formatMoney'

type Props = {
  slug: string
  tableNumber: number
  total: number
  currency: string
  items: CartItem[]
}

export function CheckoutForm({
  slug,
  tableNumber,
  total,
  currency,
  items,
}: Props) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalLabel = formatMoney(total, currency)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setLoading(true)
    setError(null)
    const { error: err } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${baseUrl.replace(/\/$/, '')}/${slug}/confirmation/pending?table=${tableNumber}`,
      },
    })
    if (err) {
      setError(
        err.message ?? 'Something went wrong with payment. Please try again.'
      )
      setLoading(false)
    }
  }

  const disabled = !stripe || !elements || loading

  return (
    <div className="space-y-6">
      <Link
        href={`/${slug}/checkout?table=${tableNumber}`}
        className="inline-flex items-center text-brand-600"
        aria-label="Back"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </Link>

      <h1 className="font-display text-2xl text-brand-800">Payment</h1>

      <div className="mb-6 rounded-xl bg-brand-50 p-4">
        <ul className="space-y-2">
          {items.map(item => (
            <li
              key={item.menu_item_id}
              className="flex justify-between gap-2 text-sm text-brand-800"
            >
              <span>
                {item.name} × {item.quantity}
              </span>
              <span className="tabular-nums">
                {formatMoney(item.price * item.quantity, currency)}
              </span>
            </li>
          ))}
        </ul>
        <div className="my-3 border-t border-brand-200" />
        <div className="flex justify-between text-lg font-medium text-brand-800">
          <span>Total</span>
          <span className="tabular-nums">{totalLabel}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <PaymentElement />
        <button
          type="submit"
          disabled={disabled}
          className="mt-4 w-full rounded-xl bg-brand-800 py-4 text-base font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Processing…' : `Pay ${totalLabel}`}
        </button>
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
      </form>
    </div>
  )
}
