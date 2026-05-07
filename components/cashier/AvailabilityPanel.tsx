'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiGetJson, apiSendJson } from '@/lib/menu/client-api'

type Row = {
  id: string
  name_el: string | null
  name_en: string | null
  type: 'food' | 'drink'
}

type Assignment = { menu_item_id: string; available: boolean }

type Props = {
  restaurantId: string
  defaultMenuId: string
}

export function AvailabilityPanel({ restaurantId, defaultMenuId }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [availableMap, setAvailableMap] = useState<Map<string, boolean>>(new Map())
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const rid = encodeURIComponent(restaurantId)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [items, assignments] = await Promise.all([
        apiGetJson<Row[]>(`/api/menu/items?restaurantId=${rid}`),
        apiGetJson<Assignment[]>(`/api/menu/menus/${defaultMenuId}/items?restaurantId=${rid}`),
      ])
      const assigned = new Set(assignments.map(a => a.menu_item_id))
      const m = new Map<string, boolean>()
      for (const a of assignments) {
        m.set(a.menu_item_id, a.available)
      }
      setRows(items.filter(i => assigned.has(i.id)))
      setAvailableMap(m)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [restaurantId, defaultMenuId, rid])

  useEffect(() => {
    if (expanded) void load()
  }, [expanded, load])

  const toggle = async (menuItemId: string, next: boolean) => {
    const prev = availableMap.get(menuItemId) ?? true
    setBusyId(menuItemId)
    setAvailableMap(m => new Map(m).set(menuItemId, next))
    try {
      await apiSendJson(`/api/menu/menus/${defaultMenuId}/availability`, 'PATCH', {
        restaurant_id: restaurantId,
        menu_item_id: menuItemId,
        available: next,
      })
    } catch {
      setAvailableMap(m => new Map(m).set(menuItemId, prev))
      setLoadError('Could not update availability')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex-shrink-0 border-t border-brand-200 bg-brand-100/80">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="flex w-full items-center justify-between px-4 py-2 text-left text-sm font-semibold text-brand-800 hover:bg-brand-200/60"
        aria-expanded={expanded}
      >
        <span>Manage Availability</span>
        <span className="text-brand-500" aria-hidden>
          {expanded ? '▴' : '▾'}
        </span>
      </button>
      {expanded && (
        <div className="max-h-48 overflow-y-auto border-t border-brand-200 px-3 py-2">
          {loadError && (
            <p className="mb-2 text-xs text-red-600" role="alert">
              {loadError}
            </p>
          )}
          {loading && rows.length === 0 ? (
            <p className="text-xs text-brand-500">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-xs text-brand-500">No menu items linked to the default menu.</p>
          ) : (
            <ul className="space-y-1">
              {rows.map(it => {
                const name = it.name_el || it.name_en || '—'
                const av = availableMap.get(it.id) ?? true
                const busy = busyId === it.id
                return (
                  <li
                    key={it.id}
                    className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm ${
                      av ? 'text-brand-800' : 'text-brand-400 line-through opacity-70'
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      <span
                        className="mr-2 inline-flex w-8 justify-center text-xs font-semibold uppercase text-brand-500"
                        aria-hidden
                      >
                        {it.type === 'food' ? 'F' : 'D'}
                      </span>
                      {name}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={av}
                      disabled={busy}
                      onClick={() => toggle(it.id, !av)}
                      className={`relative h-6 w-10 flex-shrink-0 rounded-full transition-colors ${
                        av ? 'bg-success-600' : 'bg-brand-300'
                      } disabled:opacity-50`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          av ? 'left-4' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
