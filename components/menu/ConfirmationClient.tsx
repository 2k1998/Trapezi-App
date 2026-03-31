'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
  type MotionValue,
} from 'framer-motion'
import { formatMoney } from '@/lib/formatMoney'
import { useCart } from '@/lib/hooks/useCart'

export type OrderPayload = {
  id: string
  order_number: number
  total: number
  payment_status: string
  session_id: string | null
}

export type OrderItemPayload = {
  name_snapshot: string
  quantity: number
  line_total: number
}

type Props = {
  slug: string
  tableNumber: number | null
  currency: string
  order: OrderPayload
  items: OrderItemPayload[]
}

const CIRCLE_LEN = 2 * Math.PI * 36
const CHECK_LEN = 28

export function ConfirmationClient({
  slug,
  tableNumber,
  currency,
  order,
  items,
}: Props) {
  const router = useRouter()
  const { clearCart } = useCart(slug, tableNumber)
  const reduceMotion = useReducedMotion()
  const [showHeading, setShowHeading] = useState(false)
  const count = useMotionValue(0)
  const spring = useSpring(count, { stiffness: 100, damping: 20 })

  useEffect(() => {
    if (reduceMotion) {
      count.set(order.order_number)
      setShowHeading(true)
      return
    }
    const t = window.setTimeout(() => {
      count.set(order.order_number)
      setShowHeading(true)
    }, 600)
    return () => clearTimeout(t)
  }, [count, order.order_number, reduceMotion])

  useEffect(() => {
    if (tableNumber === null) return
    const delayMs = reduceMotion ? 0 : 900
    const id = window.setTimeout(() => {
      clearCart()
    }, delayMs)
    return () => clearTimeout(id)
  }, [clearCart, tableNumber, reduceMotion])

  const onOrderMore = () => {
    if (tableNumber === null) {
      router.push(`/${slug}`)
      return
    }
    try {
      if (order.session_id) {
        sessionStorage.setItem(
          `session_id_${slug}_${tableNumber}`,
          order.session_id
        )
      }
    } catch {
      /* empty */
    }
    router.push(`/${slug}?table=${tableNumber}`)
  }

  return (
    <motion.div
      className="flex min-h-screen flex-col items-center bg-brand-50 px-4 py-12"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.3 }}
    >
      <div className="flex w-full max-w-sm flex-col items-center">
        {reduceMotion ? (
          <StaticCheck />
        ) : (
          <AnimatedCheckmark />
        )}

        <motion.h1
          className="mt-6 font-display text-3xl text-brand-900"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={
            showHeading || reduceMotion
              ? { opacity: 1, y: 0 }
              : { opacity: 0, y: 8 }
          }
          transition={{ duration: 0.35 }}
        >
          Order placed!
        </motion.h1>

        <div className="mt-2 text-5xl font-medium tabular-nums text-brand-900">
          <span className="text-brand-900">#</span>
          <Counter spring={spring} target={order.order_number} reduceMotion={reduceMotion} />
        </div>

        {tableNumber !== null ? (
          <p className="mt-1 text-brand-500">Table {tableNumber}</p>
        ) : null}

        <div className="my-6 w-full border-t border-brand-200" />

        <ul className="w-full space-y-2">
          {items.map((it, i) => (
            <motion.li
              key={`${it.name_snapshot}-${i}`}
              className="flex justify-between gap-2 text-sm text-brand-800"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { delay: 0.05 * i, duration: 0.3 }
              }
            >
              <span>
                {it.name_snapshot} × {it.quantity}
              </span>
              <span className="tabular-nums">
                {formatMoney(it.line_total, currency)}
              </span>
            </motion.li>
          ))}
        </ul>

        <div className="mt-4 flex w-full justify-between text-base font-medium text-brand-900">
          <span>Total paid</span>
          <span className="tabular-nums">
            {formatMoney(order.total, currency)}
          </span>
        </div>

        <button
          type="button"
          onClick={onOrderMore}
          className="mt-8 w-full rounded-xl bg-brand-800 py-4 text-base font-medium text-white"
        >
          Order more
        </button>
      </div>
    </motion.div>
  )
}

function Counter({
  spring,
  target,
  reduceMotion,
}: {
  spring: MotionValue<number>
  target: number
  reduceMotion: boolean | null
}) {
  const [display, setDisplay] = useState(0)

  useMotionValueEvent(spring, 'change', v => {
    setDisplay(Math.round(v))
  })

  if (reduceMotion) {
    return <span>{target}</span>
  }

  return <span>{display}</span>
}

function StaticCheck() {
  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-accent-400 bg-brand-50">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-brand-800">
        <path
          d="M12 20l6 6 10-12"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

function AnimatedCheckmark() {
  const [draw, setDraw] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setDraw(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <svg width="80" height="80" viewBox="0 0 80 80" className="overflow-visible text-accent-400">
      <circle
        cx="40"
        cy="40"
        r="36"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray={CIRCLE_LEN}
        strokeDashoffset={draw ? 0 : CIRCLE_LEN}
        transform="rotate(-90 40 40)"
        style={{
          transition: 'stroke-dashoffset 400ms ease-out',
        }}
      />
      <path
        d="M24 40l10 10 22-26"
        fill="none"
        className="text-brand-800"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={CHECK_LEN}
        strokeDashoffset={draw ? 0 : CHECK_LEN}
        style={{
          transition: 'stroke-dashoffset 300ms ease-out 200ms',
        }}
      />
    </svg>
  )
}
