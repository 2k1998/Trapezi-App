'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRealtimeCashier, useSessionRefresh, groupOrdersBySession } from '@/lib/cashier/index.client'
import type { Order, OrderWithItems, SessionGroup, TableRow } from '@/lib/cashier/index.client'
import { closeTab, markOrderReady } from '@/lib/cashier/actions'
import { usePrinting } from '@/lib/printing/usePrinting'
import type { PrinterConfig } from '@/lib/printing/qztray'
import { PushPermissionBanner } from '@/components/staff/PushPermissionBanner'
import { LeftPanel } from './LeftPanel'
import { RightPanel } from './RightPanel'

type Props = {
  restaurantId: string
  restaurantName: string
  currency: string
  printerConfig: PrinterConfig | null
  initialTables: TableRow[]
  initialOrders: OrderWithItems[]
}

function orderSessionId(order: Order): string {
  return order.session_id ?? order.id
}

function isOrderStatus(v: unknown): v is Order['status'] {
  return v === 'pending' || v === 'confirmed' || v === 'ready' || v === 'closed'
}

function isTableStatus(v: unknown): v is TableRow['status'] {
  return v === 'available' || v === 'occupied'
}

export function CashierScreen({
  restaurantId,
  restaurantName,
  currency,
  printerConfig,
  initialTables,
  initialOrders,
}: Props) {
  const [tables, setTables] = useState<TableRow[]>(initialTables)
  const [orders, setOrders] = useState<OrderWithItems[]>(initialOrders)

  const initialSessionGroups = useMemo(
    () => groupOrdersBySession(initialTables, initialOrders),
    // This memo is for initialization only; do not depend on changing state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(() => {
    return initialSessionGroups[0]?.sessionId ?? null
  })

  const sessionGroups = useMemo(() => {
    return groupOrdersBySession(tables, orders)
  }, [tables, orders])

  const selectedSession = useMemo(() => {
    if (!selectedSessionId) return null
    return sessionGroups.find(sg => sg.sessionId === selectedSessionId) ?? null
  }, [sessionGroups, selectedSessionId])

  const selectedSessionTableIdRef = useRef<string | null>(null)
  useEffect(() => {
    selectedSessionTableIdRef.current = selectedSession?.tableId ?? null
  }, [selectedSession?.tableId, selectedSessionId])

  const tablesRef = useRef<TableRow[]>(initialTables)
  useEffect(() => {
    tablesRef.current = tables
  }, [tables])

  const [newOrderIdMap, setNewOrderIdMap] = useState<Record<string, true>>({})
  const newOrderTimeoutsRef = useRef<Record<string, number>>({})

  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission | null>(null)
  const [pushPromptNonce, setPushPromptNonce] = useState(0)

  const handleNotificationPermissionChange = useCallback((p: NotificationPermission) => {
    setNotificationPermission(p)
  }, [])

  const handleRequestPushPrompt = useCallback(() => {
    setPushPromptNonce(n => n + 1)
  }, [])

  const markNewOrder = useCallback((orderId: string) => {
    setNewOrderIdMap(prev => ({ ...prev, [orderId]: true }))

    const existing = newOrderTimeoutsRef.current[orderId]
    if (existing) {
      window.clearTimeout(existing)
    }

    newOrderTimeoutsRef.current[orderId] = window.setTimeout(() => {
      setNewOrderIdMap(prev => {
        const next = { ...prev }
        delete next[orderId]
        return next
      })
      delete newOrderTimeoutsRef.current[orderId]
    }, 1500)
  }, [])

  useEffect(() => {
    return () => {
      for (const t of Object.values(newOrderTimeoutsRef.current)) {
        window.clearTimeout(t)
      }
    }
  }, [])

  useSessionRefresh()

  const { printOrder } = usePrinting(restaurantName, printerConfig)

  const onOrderChange = useCallback(
    async (payload: unknown) => {
      const eventPayload = payload as {
        eventType?: string
        new?: Partial<Order> & { order_items?: unknown }
      }

      const row = eventPayload.new as unknown
      if (!row || typeof row !== 'object') return

      const r = row as Partial<Order> & { id?: unknown; status?: unknown; table_id?: unknown }

      const id = typeof r.id === 'string' ? r.id : null
      const statusCandidate = r.status
      const tableId = typeof r.table_id === 'string' ? r.table_id : null
      const totalCandidate = r.total
      const orderNumberCandidate = r.order_number
      const createdAtCandidate = r.created_at
      const sessionIdCandidate = r.session_id

      if (!id || !tableId) return
      if (!isOrderStatus(statusCandidate)) return
      if (typeof createdAtCandidate !== 'string') return

      const total = typeof totalCandidate === 'number' ? totalCandidate : Number(totalCandidate)
      const orderNumber =
        typeof orderNumberCandidate === 'number' ? orderNumberCandidate : Number(orderNumberCandidate)
      if (!Number.isFinite(total) || !Number.isFinite(orderNumber)) return

      const sessionId =
        typeof sessionIdCandidate === 'string' ? sessionIdCandidate : null

      // Supabase eventType is 'INSERT' or 'UPDATE'. We trust the hook's subscription type,
      // but still guard to avoid unexpected payloads.
      const eventType = eventPayload.eventType
      const isInsert = eventType === 'INSERT' || eventPayload.eventType === undefined

      if (isInsert) {
        const newOrder: OrderWithItems = {
          id,
          order_number: orderNumber,
          table_id: tableId,
          session_id: sessionId,
          status: statusCandidate,
          total,
          created_at: createdAtCandidate,
          order_items: [],
        }

        setOrders(prev => {
          if (prev.some(o => o.id === id)) return prev
          return [...prev, newOrder]
        })

        const newSessionId = sessionId ?? id
        setSelectedSessionId(prev => (prev ? prev : newSessionId))
        markNewOrder(id)

        const foundTable = tablesRef.current.find(t => t.id === tableId)
        void printOrder(newOrder, foundTable?.table_number)
        return
      }

      setOrders(prev => {
        const idx = prev.findIndex(o => o.id === id)
        if (idx === -1) return prev

        if (statusCandidate === 'closed') {
          return prev.filter(o => o.id !== id)
        }

        const next = [...prev]
        next[idx] = { ...next[idx], status: statusCandidate }
        return next
      })
    },
    [markNewOrder, printOrder]
  )

  const onOrderItemInsert = useCallback(
    (payload: unknown) => {
      const eventPayload = payload as {
        new?: Record<string, unknown>
      }
      const row = eventPayload.new
      if (!row || typeof row !== 'object') return

      const orderId = row.order_id
      if (typeof orderId !== 'string') return

      const itemId = row.id
      const nameSnapshot = row.name_snapshot
      const quantityCandidate = row.quantity
      const unitPriceCandidate = row.unit_price
      const lineTotalCandidate = row.line_total
      const notesCandidate = row.notes
      const typeCandidate = row.type

      if (typeof itemId !== 'string') return
      if (typeof nameSnapshot !== 'string') return
      if (!Number.isFinite(Number(quantityCandidate))) return
      if (!Number.isFinite(Number(unitPriceCandidate))) return
      if (!Number.isFinite(Number(lineTotalCandidate))) return
      if (notesCandidate !== null && typeof notesCandidate !== 'string') return
      if (typeCandidate !== 'food' && typeCandidate !== 'drink') return

      const item = {
        id: itemId,
        name_snapshot: nameSnapshot,
        quantity: Number(quantityCandidate),
        unit_price: Number(unitPriceCandidate),
        line_total: Number(lineTotalCandidate),
        notes: notesCandidate as string | null,
        type: typeCandidate,
      } satisfies OrderWithItems['order_items'][number]

      setOrders(prev => {
        return prev.map(o => {
          if (o.id !== orderId) return o
          if (o.order_items.some(oi => oi.id === item.id)) return o
          return { ...o, order_items: [...o.order_items, item] }
        })
      })
    },
    []
  )

  const onTableUpdate = useCallback((payload: unknown) => {
    const eventPayload = payload as { new?: Record<string, unknown> }
    const row = eventPayload.new
    if (!row || typeof row !== 'object') return

    const tableId = row.id
    if (typeof tableId !== 'string') return

    const statusCandidate = row.status
    if (!isTableStatus(statusCandidate)) return

    setTables(prev => {
      return prev.map(t => {
        if (t.id !== tableId) return t

        return {
          ...t,
          status: statusCandidate,
          table_number:
            typeof row.table_number === 'number'
              ? row.table_number
              : Number(row.table_number),
          label:
            typeof row.label === 'string'
              ? row.label
              : row.label === null
                ? null
                : t.label,
        }
      })
    })

    if (statusCandidate === 'available') {
      setOrders(prev => prev.filter(o => o.table_id !== tableId))

      if (selectedSessionTableIdRef.current === tableId) {
        setSelectedSessionId(null)
      }
    }
  }, [])

  useRealtimeCashier({
    restaurantId,
    onOrderChange,
    onOrderItemInsert,
    onTableUpdate,
  })

  const handleSelectSession = useCallback((sessionId: string) => {
    setSelectedSessionId(sessionId)
  }, [])

  const handleMarkReady = useCallback(
    async (orderId: string) => {
      const prevOrder = orders.find(o => o.id === orderId)
      if (!prevOrder || prevOrder.status === 'ready') return

      setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, status: 'ready' } : o)))

      const res = await markOrderReady(orderId)
      if (!res.success) {
        setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, status: prevOrder.status } : o)))
      }
    },
    [orders]
  )

  const handleCloseTab = useCallback(async (sessionId: string, tableId: string) => {
    const res = await closeTab(sessionId, tableId)
    if (!res.success) return res

    setOrders(prev => prev.filter(o => orderSessionId(o) !== sessionId))
    setTables(prev => prev.map(t => (t.id === tableId ? { ...t, status: 'available' } : t)))
    setSelectedSessionId(null)

    return res
  }, [])

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-brand-50">
      <PushPermissionBanner
        openRequestNonce={pushPromptNonce}
        onPermissionChange={handleNotificationPermissionChange}
      />
      <div className="flex min-h-0 flex-1 w-full">
        <LeftPanel
          restaurantName={restaurantName}
          sessionGroups={sessionGroups}
          allTables={tables}
          selectedSessionId={selectedSessionId}
          onSelectSession={handleSelectSession}
          notificationPermission={notificationPermission}
          onRequestPushPrompt={handleRequestPushPrompt}
        />

        <RightPanel
          selectedSession={selectedSession}
          selectedSessionId={selectedSessionId}
          currency={currency}
          newOrderIdMap={newOrderIdMap}
          onMarkReady={handleMarkReady}
          onRequestCloseTab={handleCloseTab}
        />
      </div>
    </div>
  )
}

