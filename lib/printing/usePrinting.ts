'use client'

import { useCallback } from 'react'
import type { OrderWithItems } from '@/lib/cashier/types'
import { printOrder as qzPrintOrder } from './qztray'
import type { PrinterConfig } from './qztray'

export function usePrinting(restaurantName: string, printerConfig: PrinterConfig | null) {
  const printOrder = useCallback(
    async (order: OrderWithItems, tableNumber?: number): Promise<void> => {
      if (!printerConfig) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[printing] No printer config available — skipping print')
        }
        return
      }

      try {
        const result = await qzPrintOrder(order, printerConfig, restaurantName, tableNumber)

        const errors = Object.entries(result)
          .filter(([, v]) => v === 'error')
          .map(([k]) => k)

        if (errors.length > 0) {
          console.error('[printing] Some printers failed:', errors.join(', '))
        }

        await fetch('/api/orders/mark-printed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: order.id }),
        }).catch(err => {
          console.error('[printing] Failed to mark order as printed:', err)
        })
      } catch (err) {
        console.error('[printing] Unexpected error during printOrder:', err)
      }
    },
    [restaurantName, printerConfig],
  )

  return { printOrder }
}
