'use client'

import Link from 'next/link'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useCart } from '@/lib/hooks/useCart'

const PHONE_RE = /^\+?[\d\s-()]{8,}$/

export default function CheckoutPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params.slug as string
  const tableRaw = searchParams.get('table')

  const tableNumber = useMemo(() => {
    const t = parseInt(tableRaw ?? '', 10)
    return Number.isInteger(t) && t > 0 ? t : null
  }, [tableRaw])

  const { itemCount } = useCart(slug, tableNumber)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [phoneTouched, setPhoneTouched] = useState(false)

  useEffect(() => {
    if (tableNumber === null) {
      router.replace(`/${slug}`)
    }
  }, [tableNumber, router, slug])

  useEffect(() => {
    if (tableNumber === null) return
    if (itemCount === 0) {
      router.replace(`/${slug}?table=${tableNumber}`)
    }
  }, [itemCount, router, slug, tableNumber])

  const nameErr =
    nameTouched && (name.trim().length < 2 ? 'Enter at least 2 characters' : '')
  const phoneErr =
    phoneTouched && (!phone.trim() || !PHONE_RE.test(phone.trim()))
      ? 'Enter a valid phone number'
      : ''

  const valid =
    name.trim().length >= 2 && phone.trim().length > 0 && PHONE_RE.test(phone.trim())

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || tableNumber === null) return
    try {
      sessionStorage.setItem(
        'customer_info',
        JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
        })
      )
    } catch {
      /* empty */
    }
    router.push(`/${slug}/payment?table=${tableNumber}`)
  }

  if (tableNumber === null) {
    return (
      <div className="min-h-screen bg-brand-50 px-4 pt-16">
        <div className="mx-auto h-32 max-w-sm animate-shimmer rounded-xl bg-brand-100" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-50 px-4 pb-12 pt-16">
      <Link
        href={`/${slug}?table=${tableNumber}`}
        className="mb-6 inline-flex items-center text-brand-600"
        aria-label="Back to menu"
      >
        <BackArrow />
      </Link>

      <div className="mx-auto max-w-sm animate-fade-up">
        <h1 className="font-display text-3xl text-brand-900">Almost there</h1>
        <p className="mt-2 text-sm text-brand-500">
          So we can let you know when your order is ready
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-6">
          <div>
            <label htmlFor="cust-name" className="mb-1 block text-sm font-medium text-brand-800">
              Your name
            </label>
            <input
              id="cust-name"
              name="name"
              autoComplete="name"
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={() => setNameTouched(true)}
              placeholder="Name"
              className="w-full rounded-lg border border-brand-200 bg-white px-3 py-3 text-base text-brand-900 placeholder:text-brand-400"
            />
            {nameErr ? (
              <p className="mt-1 text-sm text-red-500">{nameErr}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="cust-phone" className="mb-1 block text-sm font-medium text-brand-800">
              Phone number
            </label>
            <input
              id="cust-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              onBlur={() => setPhoneTouched(true)}
              placeholder="+30 690 000 0000"
              className="w-full rounded-lg border border-brand-200 bg-white px-3 py-3 text-base text-brand-900 placeholder:text-brand-400"
            />
            {phoneErr ? (
              <p className="mt-1 text-sm text-red-500">{phoneErr}</p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={!valid}
            className="w-full rounded-xl bg-brand-800 py-4 text-base font-medium text-white disabled:opacity-50"
          >
            Continue to payment
          </button>
        </form>
      </div>
    </div>
  )
}

function BackArrow() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}
