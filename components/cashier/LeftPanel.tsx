'use client'

import { useEffect } from 'react'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { useReducedMotion } from 'framer-motion'
import type { SessionGroup, TableRow } from '@/lib/cashier/index.client'
import { PushNotificationStatus } from './PushNotificationStatus'
import { TableCard } from './TableCard'

export function LeftPanel({
  restaurantName,
  sessionGroups,
  allTables,
  selectedSessionId,
  onSelectSession,
  notificationPermission,
  onRequestPushPrompt,
}: {
  restaurantName: string
  sessionGroups: SessionGroup[]
  allTables: TableRow[]
  selectedSessionId: string | null
  onSelectSession: (sessionId: string) => void
  notificationPermission: NotificationPermission | null
  onRequestPushPrompt: () => void
}) {
  const reduceMotion = useReducedMotion()

  const occupiedTableIds = new Set(sessionGroups.map(g => g.tableId))
  const availableTables = allTables.filter(
    t => t.status === 'available' && !occupiedTableIds.has(t.id)
  )

  const [occupiedListRef, enableOccupiedAnimations] = useAutoAnimate<HTMLDivElement>()

  useEffect(() => {
    enableOccupiedAnimations(!reduceMotion)
  }, [enableOccupiedAnimations, reduceMotion])

  return (
    <aside className="w-80 flex-shrink-0 border-r border-brand-200 bg-brand-50">
      <div className="flex h-full flex-col">
        <div className="flex-shrink-0 border-b border-brand-200 px-4 py-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-brand-600">Cashier</div>
              <div className="font-display text-lg text-brand-900">{restaurantName}</div>
            </div>
            <PushNotificationStatus
              permission={notificationPermission}
              onRequestPrompt={onRequestPushPrompt}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          <div className="space-y-3">
            <section aria-label="Occupied tables">
              <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-brand-500">
                Active tabs
              </div>
              <div ref={occupiedListRef} className="space-y-3">
                {sessionGroups.map(sg => (
                  <TableCard
                    key={sg.sessionId}
                    sessionGroup={sg}
                    isSelected={sg.sessionId === selectedSessionId}
                    onSelect={() => onSelectSession(sg.sessionId)}
                  />
                ))}
              </div>
            </section>

            <div className="my-3 border-t border-brand-200" />

            <section aria-label="Available tables">
              <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-brand-500">
                Available
              </div>
              <div className="space-y-3">
                {availableTables.map(t => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-brand-200 bg-brand-100/60 px-4 py-3 text-left opacity-60"
                    aria-disabled="true"
                  >
                    <div className="text-sm font-semibold text-brand-700">
                      Table {t.table_number}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </aside>
  )
}

