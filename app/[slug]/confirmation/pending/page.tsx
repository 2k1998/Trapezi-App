'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

function clearCartStorage(slug: string, tableNumber: number) {
  try {
    localStorage.removeItem(`cart_${slug}_${tableNumber}`)
  } catch {
    /* empty */
  }
}

function resolveTable(slug: string, urlTable: number | null): number | null {
  if (urlTable !== null) return urlTable
  if (typeof window === 'undefined') return null
  try {
    const s = sessionStorage.getItem(`last_payment_table_${slug}`)
    if (s) {
      const t = parseInt(s, 10)
      if (Number.isInteger(t) && t > 0) return t
    }
  } catch {
    /* empty */
  }
  return null
}

export default function ConfirmationPendingPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params.slug as string
  const paymentIntent = searchParams.get('payment_intent')
  const redirectStatus = searchParams.get('redirect_status')
  const tableRaw = searchParams.get('table')

  const tableFromUrl = useMemo(() => {
    const t = parseInt(tableRaw ?? '', 10)
    return Number.isInteger(t) && t > 0 ? t : null
  }, [tableRaw])

  const [error, setError] = useState<string | null>(null)
  const [pollExhausted, setPollExhausted] = useState(false)
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState<number | null>(null)

  useEffect(() => {
    if (!paymentIntent) {
      setError('We could not confirm your payment. Please return to the menu and try again.')
      return
    }
    const pi = paymentIntent
    if (redirectStatus && redirectStatus !== 'succeeded') {
      setError('Payment was not completed. You can try again from the menu.')
      return
    }

    let cancelled = false
    const maxAttempts = 20

    async function poll() {
      let n = 0
      while (!cancelled && n < maxAttempts) {
        n += 1
        try {
          const res = await fetch(
            `/api/orders/by-payment-intent?pi=${encodeURIComponent(pi)}&slug=${encodeURIComponent(slug)}`
          )
          if (res.ok) {
            const data = (await res.json()) as {
              id?: string
              order_number?: number
            }

            const orderId = typeof data.id === 'string' ? data.id : null
            const orderNumber =
              typeof data.order_number === 'number' ? data.order_number : null

            if (orderNumber !== null) {
              const tn = resolveTable(slug, tableFromUrl)
              if (tn !== null) {
                clearCartStorage(slug, tn)
              }
              setConfirmedOrderNumber(orderNumber)
              if (orderId) {
                router.replace(`/${slug}/confirmation/${orderId}`)
              }
              return
            }
          }
        } catch {
          /* retry */
        }
        const delay = Math.min(500 * n, 4000)
        await new Promise(r => setTimeout(r, delay))
      }
      if (!cancelled) {
        setPollExhausted(true)
      }
    }

    void poll()
    return () => {
      cancelled = true
    }
  }, [paymentIntent, redirectStatus, slug, router, tableFromUrl])

  const tableForBack = resolveTable(slug, tableFromUrl)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-50 px-4">
      {!error && !pollExhausted && confirmedOrderNumber === null ? (
        <>
          <div className="h-12 w-12 animate-shimmer rounded-full bg-brand-200" />
          <p className="mt-6 text-sm text-brand-600">Confirming your order…</p>
        </>
      ) : confirmedOrderNumber !== null ? (
        <div className="max-w-sm text-center">
          <p className="text-sm text-brand-600">Order confirmed</p>
          <p className="mt-2 text-4xl font-semibold tabular-nums text-brand-900">
            #{confirmedOrderNumber}
          </p>
        </div>
      ) : pollExhausted ? (
        <div className="mx-auto max-w-md text-center">
          <div
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-accent-400/15 shadow-card"
            aria-hidden
          >
            <svg
              className="h-8 w-8 text-accent-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
          </div>
          <p className="text-lg font-medium leading-relaxed text-brand-800">
            Your payment was received. Please ask staff for your order status.
          </p>
          <button
            type="button"
            className="mt-8 rounded-xl bg-brand-800 px-6 py-3 text-sm font-medium text-white shadow-card transition-colors hover:bg-brand-900"
            onClick={() =>
              router.push(
                tableForBack
                  ? `/${slug}?table=${tableForBack}`
                  : `/${slug}`
              )
            }
          >
            Back to menu
          </button>
        </div>
      ) : (
        <div className="max-w-sm text-center">
          <p className="text-sm text-brand-700">{error}</p>
          <button
            type="button"
            className="mt-6 rounded-xl bg-brand-800 px-6 py-3 text-sm font-medium text-white"
            onClick={() =>
              router.push(
                tableForBack
                  ? `/${slug}?table=${tableForBack}`
                  : `/${slug}`
              )
            }
          >
            Back to menu
          </button>
        </div>
      )}
    </div>
  )
}
