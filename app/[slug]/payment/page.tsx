'use client'

import { Elements } from '@stripe/react-stripe-js'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { CheckoutForm } from '@/components/menu/CheckoutForm'
import { createClient } from '@/lib/supabase/client'
import { stripeAppearance } from '@/lib/stripe/appearance'
import { getStripePromise, getPlatformStripePromise } from '@/lib/stripe/client'
import { useCart } from '@/lib/hooks/useCart'

type CustomerInfo = { name: string; phone: string }

export default function PaymentPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params.slug as string
  const tableRaw = searchParams.get('table')

  const tableNumber = useMemo(() => {
    const t = parseInt(tableRaw ?? '', 10)
    return Number.isInteger(t) && t > 0 ? t : null
  }, [tableRaw])

  const cart = useCart(slug, tableNumber)
  const [mounted, setMounted] = useState(false)
  const [currency, setCurrency] = useState('EUR')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null)
  const [total, setTotal] = useState<number>(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingPi, setLoadingPi] = useState(true)

  // stripeAccountId is null when the dev-mode bypass is active.
  // In that case load Stripe against the platform account directly.
  const stripePromise = useMemo(
    () => (stripeAccountId ? getStripePromise(stripeAccountId) : getPlatformStripePromise()),
    [stripeAccountId]
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (tableNumber === null) return
    try {
      sessionStorage.setItem(`last_payment_table_${slug}`, String(tableNumber))
    } catch {
      /* empty */
    }
  }, [slug, tableNumber])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('restaurants')
      .select('currency')
      .eq('slug', slug)
      .single()
      .then((res: { data: { currency: string } | null }) => {
        if (res.data?.currency) setCurrency(res.data.currency)
      })
  }, [slug])

  const cartItemsJson = useMemo(() => JSON.stringify(cart.items), [cart.items])

  useEffect(() => {
    if (!mounted) return
    if (tableNumber === null) {
      router.replace(`/${slug}`)
      return
    }
    if (cart.itemCount === 0) {
      router.replace(`/${slug}?table=${tableNumber}`)
      return
    }

    let customer: CustomerInfo | null = null
    try {
      const raw = sessionStorage.getItem('customer_info')
      if (raw) customer = JSON.parse(raw) as CustomerInfo
    } catch {
      /* empty */
    }
    if (!customer?.name || !customer?.phone) {
      router.replace(`/${slug}/checkout?table=${tableNumber}`)
      return
    }

    const ac = new AbortController()

    async function createPi() {
      setLoadingPi(true)
      setLoadError(null)
      setStripeAccountId(null)
      setClientSecret(null)
      let sessionId: string | undefined
      try {
        const key = `session_id_${slug}_${tableNumber}`
        const existing = sessionStorage.getItem(key)
        if (existing) sessionId = existing
      } catch {
        /* empty */
      }

      const items = cart.items.map(i => ({
        menu_item_id: i.menu_item_id,
        quantity: i.quantity,
        notes: i.notes,
      }))

      try {
        const res = await fetch('/api/orders/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug,
            table_number: tableNumber,
            items,
            customer_name: customer!.name,
            customer_phone: customer!.phone,
            session_id: sessionId,
          }),
          signal: ac.signal,
        })
        const data = (await res.json()) as {
          clientSecret?: string
          stripeAccountId?: string
          total?: number
          session_id?: string
          error?: string
        }
        if (!res.ok || !data.clientSecret) {
          setLoadError(
            data.error ?? 'We could not start payment. Please try again.'
          )
          return
        }
        setClientSecret(data.clientSecret)
        setStripeAccountId(data.stripeAccountId ?? null)
        setTotal(Number(data.total ?? 0))
        try {
          if (data.session_id) {
            sessionStorage.setItem(
              `session_id_${slug}_${tableNumber}`,
              data.session_id
            )
          }
        } catch {
          /* empty */
        }
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return
        setLoadError('We could not reach the server. Check your connection.')
      } finally {
        setLoadingPi(false)
      }
    }

    void createPi()
    return () => ac.abort()
  }, [mounted, slug, tableNumber, router, cart.itemCount, cartItemsJson])

  if (tableNumber === null) {
    return (
      <div className="min-h-screen bg-brand-50 px-4 pt-16">
        <div className="mx-auto h-48 max-w-sm animate-shimmer rounded-xl bg-brand-100" />
      </div>
    )
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-brand-50 px-4 pt-16">
        <div className="mx-auto h-48 max-w-sm animate-shimmer rounded-xl bg-brand-100" />
      </div>
    )
  }

  // stripeAccountId can be null in dev mode — that is expected, not an error
  const showElements = !loadingPi && clientSecret && stripePromise

  return (
    <div className="min-h-screen bg-brand-50 px-4 pb-12 pt-16">
      {/* Dev-mode bypass banner — only visible when stripe_account_id is null */}
      {!loadingPi && !stripeAccountId && (
        <div className="fixed inset-x-0 top-0 z-50 bg-yellow-400 py-2 text-center text-xs font-semibold text-yellow-900">
          DEV MODE — charging platform account, no Stripe Connect
        </div>
      )}
      <div className="mx-auto max-w-sm">
        {loadingPi && !loadError ? (
          <div className="h-64 w-full animate-shimmer rounded-xl bg-brand-100" />
        ) : null}

        {loadError ? (
          <p className="text-sm text-red-500">{loadError}</p>
        ) : null}

        {showElements ? (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: stripeAppearance,
            }}
          >
            <CheckoutForm
              slug={slug}
              tableNumber={tableNumber}
              total={total}
              currency={currency}
              items={cart.items}
            />
          </Elements>
        ) : null}
      </div>
    </div>
  )
}
