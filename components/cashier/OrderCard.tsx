'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { OrderWithItems } from '@/lib/cashier/index.client'
import { formatMoney } from '@/lib/formatMoney'

function formatHHMM(isoString: string): string {
  const d = new Date(isoString)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function padOrderNumber(orderNumber: number): string {
  return String(orderNumber).padStart(4, '0')
}

export function OrderCard({
  order,
  currency,
  isNew,
  onMarkReady,
}: {
  order: OrderWithItems
  currency: string
  isNew: boolean
  onMarkReady: (orderId: string) => Promise<void>
}) {
  const reduceMotion = useReducedMotion()
  const [markPending, setMarkPending] = useState(false)

  const [highlightVisible, setHighlightVisible] = useState(false)
  useEffect(() => {
    if (reduceMotion) {
      setHighlightVisible(false)
      return
    }
    if (!isNew) {
      setHighlightVisible(false)
      return
    }
    setHighlightVisible(true)
    const t = window.setTimeout(() => setHighlightVisible(false), 1500)
    return () => clearTimeout(t)
  }, [isNew, reduceMotion])

  const orderStatus = order.status
  const statusBadge = useMemo(() => {
    switch (orderStatus) {
      case 'pending':
        return {
          label: 'Pending',
          className: 'bg-brand-100 text-brand-700 border border-brand-200',
        }
      case 'confirmed':
        return {
          label: 'Confirmed',
          className: 'bg-blue-100 text-blue-800 border border-blue-200',
        }
      case 'ready':
        return {
          label: 'Ready',
          className: 'bg-green-100 text-green-800 border border-green-200',
        }
      case 'closed':
        return {
          label: 'Closed',
          className: 'bg-brand-100 text-brand-600 border border-brand-200 opacity-60',
        }
      default:
        return {
          label: orderStatus,
          className: 'bg-brand-100 text-brand-700 border border-brand-200',
        }
    }
  }, [orderStatus])

  const shouldSlideIn = isNew && !reduceMotion

  return (
    <motion.div
      className="relative rounded-xl border border-brand-200 bg-white p-4 shadow-card"
      initial={shouldSlideIn ? { y: 20, opacity: 0 } : false}
      animate={{ y: 0, opacity: 1 }}
      transition={shouldSlideIn ? { duration: 0.25, ease: 'easeOut' } : { duration: 0 }}
    >
      {highlightVisible && !reduceMotion ? (
        <motion.div
          className="absolute inset-y-0 left-0 w-1 rounded-l bg-accent-400"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-brand-900">
            #{padOrderNumber(order.order_number)}
          </div>
          <div className="mt-1 text-xs text-brand-600">{formatHHMM(order.created_at)}</div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="text-sm font-semibold tabular-nums text-brand-900">
            {formatMoney(order.total, currency)}
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadge.className}`}>
            {statusBadge.label}
          </span>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <button
          type="button"
          disabled={order.status === 'ready' || markPending}
          onClick={async () => {
            if (order.status === 'ready' || markPending) return
            setMarkPending(true)
            try {
              await onMarkReady(order.id)
            } finally {
              setMarkPending(false)
            }
          }}
          className={`w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            order.status === 'ready'
              ? 'cursor-not-allowed bg-brand-100 text-brand-600'
              : 'bg-brand-800 text-white hover:bg-brand-700'
          } disabled:opacity-60`}
        >
          Mark as Ready
        </button>

        <div className="space-y-2 rounded-lg bg-brand-50/70 p-3">
          {order.order_items.map(item => (
            <div key={item.id} className="space-y-1">
              <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-brand-900">
                    {item.name_snapshot}
                  </div>
                  <div className="text-xs text-brand-600">
                    Qty {item.quantity}
                  </div>
                </div>
                <div className="text-right tabular-nums text-sm font-medium text-brand-800">
                  {formatMoney(item.line_total, currency)}
                </div>
              </div>
              {item.notes ? (
                <div className="text-xs text-brand-500">{item.notes}</div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

