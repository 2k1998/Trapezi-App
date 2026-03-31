'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { formatMoney } from '@/lib/formatMoney'

export function CloseTabModal({
  isOpen,
  tableNumber,
  sessionTotal,
  currency,
  onCancel,
  onConfirm,
  confirmPending,
}: {
  isOpen: boolean
  tableNumber: number
  sessionTotal: number
  currency: string
  onCancel: () => void
  onConfirm: () => Promise<void>
  confirmPending: boolean
}) {
  const reduceMotion = useReducedMotion()

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.95 }}
          animate={reduceMotion ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1 }}
          exit={
            reduceMotion ? { opacity: 0, scale: 1 } : { opacity: 0, scale: 0.95 }
          }
          transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
        >
          <div
            className="absolute inset-0 bg-brand-900/20"
            onClick={() => {
              if (!confirmPending) onCancel()
            }}
          />

          <div className="relative w-full max-w-sm rounded-2xl border border-brand-200 bg-white p-5 shadow-elevated">
            <h2 className="font-display text-xl text-brand-900">Close tab for Table {tableNumber}?</h2>

            <p className="mt-3 text-sm text-brand-600">
              Session total: <span className="font-semibold">{formatMoney(sessionTotal, currency)}</span>
            </p>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={confirmPending}
                className="w-1/2 rounded-xl border border-brand-200 bg-brand-50 py-3 text-sm font-medium text-brand-900 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onConfirm()
                }}
                disabled={confirmPending}
                className="w-1/2 rounded-xl bg-brand-800 py-3 text-sm font-medium text-white shadow-premium disabled:opacity-60"
              >
                {confirmPending ? 'Closing…' : 'Confirm — Close Tab'}
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

