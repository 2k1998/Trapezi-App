'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { SessionGroup } from '@/lib/cashier/index.client'

function formatHHMM(isoString: string): string {
  const d = new Date(isoString)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export function TableCard({
  sessionGroup,
  isSelected,
  onSelect,
}: {
  sessionGroup: SessionGroup
  isSelected: boolean
  onSelect: () => void
}) {
  const reduceMotion = useReducedMotion()

  const orderCount = sessionGroup.orders.length
  const sessionTotalLabel = `€${sessionGroup.sessionTotal.toFixed(2)}`

  return (
    <motion.button
      type="button"
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      onClick={onSelect}
      className={`relative flex w-full flex-col gap-2 rounded-xl border px-4 py-3 text-left shadow-card transition-colors ${
        isSelected
          ? 'bg-brand-100 border-accent-400'
          : 'bg-white border-brand-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-accent-400"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-brand-900">
              Table {sessionGroup.tableNumber}
            </div>
            <div className="text-xs text-brand-600">
              {orderCount} {orderCount === 1 ? 'order' : 'orders'}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium tabular-nums text-brand-900">
            {sessionTotalLabel}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-brand-600">
        <span>{formatHHMM(sessionGroup.firstOrderAt)}</span>
        <span className="tabular-nums">First</span>
      </div>
    </motion.button>
  )
}

