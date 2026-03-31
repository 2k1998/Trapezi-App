'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  RealtimePostgresChangesPayload,
  REALTIME_SUBSCRIBE_STATES,
} from '@supabase/supabase-js'

type AnyRecord = Record<string, unknown>

interface UseRealtimeCashierOptions {
  restaurantId: string
  onOrderChange: (payload: RealtimePostgresChangesPayload<AnyRecord>) => void
  onOrderItemInsert: (payload: RealtimePostgresChangesPayload<AnyRecord>) => void
  onTableUpdate: (payload: RealtimePostgresChangesPayload<AnyRecord>) => void
}

export function useRealtimeCashier({
  restaurantId,
  onOrderChange,
  onOrderItemInsert,
  onTableUpdate,
}: UseRealtimeCashierOptions): void {
  useEffect(() => {
    const supabase = createClient()

    const ordersChannel = supabase
      .channel(`cashier-orders-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        onOrderChange
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        onOrderChange
      )
      .subscribe((status: REALTIME_SUBSCRIBE_STATES, err?: Error) => {
        if (status === 'CHANNEL_ERROR' || err) {
          console.error('[cashier] orders channel error:', err ?? status)
        }
        if (status === 'CLOSED') {
          console.warn('[cashier] orders channel closed unexpectedly')
        }
      })

    const orderItemsChannel = supabase
      .channel(`cashier-order-items-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_items',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        onOrderItemInsert
      )
      .subscribe((status: REALTIME_SUBSCRIBE_STATES, err?: Error) => {
        if (status === 'CHANNEL_ERROR' || err) {
          console.error('[cashier] order_items channel error:', err ?? status)
        }
        if (status === 'CLOSED') {
          console.warn('[cashier] order_items channel closed unexpectedly')
        }
      })

    const tablesChannel = supabase
      .channel(`cashier-tables-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tables',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        onTableUpdate
      )
      .subscribe((status: REALTIME_SUBSCRIBE_STATES, err?: Error) => {
        if (status === 'CHANNEL_ERROR' || err) {
          console.error('[cashier] tables channel error:', err ?? status)
        }
        if (status === 'CLOSED') {
          console.warn('[cashier] tables channel closed unexpectedly')
        }
      })

    return () => {
      supabase.removeChannel(ordersChannel)
      supabase.removeChannel(orderItemsChannel)
      supabase.removeChannel(tablesChannel)
    }
  }, [restaurantId, onOrderChange, onOrderItemInsert, onTableUpdate])
}
