'use client'

import { useEffect, useState } from 'react'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
} from 'framer-motion'
import type { SessionGroup } from '@/lib/cashier/index.client'
import { OrderCard } from './OrderCard'
import { CloseTabModal } from './CloseTabModal'
import { formatMoney } from '@/lib/formatMoney'

export function RightPanel({
  selectedSession,
  selectedSessionId,
  currency,
  newOrderIdMap,
  onMarkReady,
  onRequestCloseTab,
}: {
  selectedSession: SessionGroup | null
  selectedSessionId: string | null
  currency: string
  newOrderIdMap: Record<string, true>
  onMarkReady: (orderId: string) => Promise<void>
  onRequestCloseTab: (
    sessionId: string,
    tableId: string
  ) => Promise<{ success: boolean; error?: string }>
}) {
  const reduceMotion = useReducedMotion()

  const [orderListRef, enableOrderAnimations] = useAutoAnimate<HTMLDivElement>()
  useEffect(() => {
    enableOrderAnimations(!reduceMotion)
  }, [enableOrderAnimations, reduceMotion])

  const [closeOpen, setCloseOpen] = useState(false)
  const [closePending, setClosePending] = useState(false)

  useEffect(() => {
    setCloseOpen(false)
    setClosePending(false)
  }, [selectedSessionId])

  if (!selectedSession) {
    return (
      <section className="flex flex-1 flex-col overflow-hidden bg-brand-50">
        <div className="flex flex-1 items-center justify-center px-8">
          <p className="text-center text-brand-500">Select a table to view its tab</p>
        </div>
      </section>
    )
  }

  const sessionTotal = selectedSession.sessionTotal

  const closeSession = async () => {
    setClosePending(true)
    try {
      const res = await onRequestCloseTab(selectedSession.sessionId, selectedSession.tableId)
      if (res.success) setCloseOpen(false)
    } finally {
      setClosePending(false)
    }
  }

  return (
    <section className="flex flex-1 flex-col overflow-hidden bg-brand-50">
      <header className="flex-shrink-0 border-b border-brand-200 bg-brand-50 px-6 py-4">
        <div className="text-2xl font-display text-brand-900">Table {selectedSession.tableNumber}</div>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="text-sm font-medium text-brand-600">Session total</div>
          <AnimatedMoney target={sessionTotal} currency={currency} reducedMotion={reduceMotion ?? false} />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div ref={orderListRef} className="space-y-3">
          {selectedSession.orders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              currency={currency}
              isNew={!!newOrderIdMap[order.id]}
              onMarkReady={onMarkReady}
            />
          ))}
        </div>
      </div>

      <div className="sticky bottom-0 flex-shrink-0 border-t border-brand-200 bg-brand-50/95 backdrop-blur-sm px-6 py-4">
        <button
          type="button"
          onClick={() => setCloseOpen(true)}
          disabled={closePending}
          className="w-full rounded-xl bg-brand-800 px-6 py-3 text-base font-medium text-white shadow-premium disabled:opacity-50"
        >
          Close Tab
        </button>
      </div>

      <CloseTabModal
        isOpen={closeOpen}
        tableNumber={selectedSession.tableNumber}
        sessionTotal={selectedSession.sessionTotal}
        currency={currency}
        onCancel={() => setCloseOpen(false)}
        onConfirm={closeSession}
        confirmPending={closePending}
      />
    </section>
  )
}

function AnimatedMoney({
  target,
  currency,
  reducedMotion,
}: {
  target: number
  currency: string
  reducedMotion: boolean
}) {
  const [display, setDisplay] = useState(target)
  const count = useMotionValue(target)
  const spring = useSpring(count, { stiffness: 100, damping: 20 })

  useMotionValueEvent(spring, 'change', v => {
    setDisplay(v)
  })

  useEffect(() => {
    count.set(target)
  }, [count, target])

  if (reducedMotion) {
    return (
      <span className="tabular-nums text-3xl font-bold text-brand-900">
        {formatMoney(target, currency)}
      </span>
    )
  }

  return (
    <motion.span
      className="tabular-nums text-3xl font-bold text-brand-900"
      aria-label={`Session total: ${formatMoney(display, currency)}`}
    >
      {formatMoney(display, currency)}
    </motion.span>
  )
}

