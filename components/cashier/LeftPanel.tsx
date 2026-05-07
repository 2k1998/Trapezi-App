'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { useReducedMotion } from 'framer-motion'
import type { SessionGroup, TableRow } from '@/lib/cashier/index.client'
import { PushNotificationStatus } from './PushNotificationStatus'
import { TableCard } from './TableCard'

export function LeftPanel({
  restaurantName,
  logoUrl,
  sessionGroups,
  allTables,
  plan,
  selectedSessionId,
  onSelectSession,
  notificationPermission,
  onRequestPushPrompt,
}: {
  restaurantName: string
  logoUrl: string | null
  sessionGroups: SessionGroup[]
  allTables: TableRow[]
  plan: string
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
  const isPro = plan === 'pro' || plan === 'enterprise'
  const hasSections = allTables.some(t => (t.section_name ?? '').trim().length > 0)
  const useGrouping = isPro && hasSections

  const storageKey = `cashier-section-collapse`
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) setCollapsed(JSON.parse(raw) as Record<string, boolean>)
    } catch {
      setCollapsed({})
    }
  }, [])

  const setSectionCollapsed = (key: string) => {
    setCollapsed(prev => {
      const next = { ...prev, [key]: !prev[key] }
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const tableById = new Map(allTables.map(t => [t.id, t]))
  const occupiedBySection = new Map<string, SessionGroup[]>()
  for (const sg of sessionGroups) {
    const section = tableById.get(sg.tableId)?.section_name ?? 'Other'
    if (!occupiedBySection.has(section)) occupiedBySection.set(section, [])
    occupiedBySection.get(section)!.push(sg)
  }
  const availableBySection = new Map<string, TableRow[]>()
  for (const t of availableTables) {
    const section = t.section_name ?? 'Other'
    if (!availableBySection.has(section)) availableBySection.set(section, [])
    availableBySection.get(section)!.push(t)
  }

  const sectionSort = ([a]: [string, unknown], [b]: [string, unknown]) => {
    if (a === 'Other') return 1
    if (b === 'Other') return -1
    return a.localeCompare(b)
  }

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
              {logoUrl ? (
                <img src={logoUrl} alt="Restaurant logo" className="mb-2 h-8 w-auto max-w-[120px] object-contain" />
              ) : (
                <Image
                  src="/logo.png"
                  alt="Trapezi"
                  width={120}
                  height={40}
                  priority
                  className="mb-2 object-contain invert"
                />
              )}
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
                {useGrouping
                  ? Array.from(occupiedBySection.entries()).sort(sectionSort).map(([section, groups]) => (
                      <div key={section} className="rounded-xl border border-brand-200 bg-white/70 p-2">
                        <button
                          type="button"
                          onClick={() => setSectionCollapsed(`occ-${section}`)}
                          className="mb-2 flex w-full items-center justify-between px-1 text-left text-xs font-semibold uppercase tracking-wide text-brand-600"
                        >
                          <span>{section}</span>
                          <span>{collapsed[`occ-${section}`] ? '▸' : '▾'}</span>
                        </button>
                        {!collapsed[`occ-${section}`] ? (
                          <div className="space-y-3">
                            {groups.map(sg => (
                              <TableCard
                                key={sg.sessionId}
                                sessionGroup={sg}
                                isSelected={sg.sessionId === selectedSessionId}
                                onSelect={() => onSelectSession(sg.sessionId)}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))
                  : sessionGroups.map(sg => (
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
                {useGrouping
                  ? Array.from(availableBySection.entries()).sort(sectionSort).map(([section, tables]) => (
                      <div key={section} className="rounded-xl border border-brand-200 bg-white/70 p-2">
                        <button
                          type="button"
                          onClick={() => setSectionCollapsed(`av-${section}`)}
                          className="mb-2 flex w-full items-center justify-between px-1 text-left text-xs font-semibold uppercase tracking-wide text-brand-600"
                        >
                          <span>{section}</span>
                          <span>{collapsed[`av-${section}`] ? '▸' : '▾'}</span>
                        </button>
                        {!collapsed[`av-${section}`] ? (
                          <div className="space-y-3">
                            {tables.map(t => (
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
                        ) : null}
                      </div>
                    ))
                  : availableTables.map(t => (
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

