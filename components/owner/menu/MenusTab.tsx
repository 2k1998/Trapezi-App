'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useOwnerRestaurant } from '@/components/owner/owner-context'
import { summarizeMenuSchedules } from '@/lib/menu/schedule-summary'
import { apiSendJson, apiPutJson, apiDelete, apiGetJson } from '@/lib/menu/client-api'
import { EmptyState } from './EmptyState'
import type { MenuItemAdmin, MenuWithSchedules } from './types'
import type { MenuSchedule, MenuItemAssignment } from '@/types/menu'

const UI_DAYS: { label: string; dow: number }[] = [
  { label: 'Mon', dow: 1 },
  { label: 'Tue', dow: 2 },
  { label: 'Wed', dow: 3 },
  { label: 'Thu', dow: 4 },
  { label: 'Fri', dow: 5 },
  { label: 'Sat', dow: 6 },
  { label: 'Sun', dow: 0 },
]

type DayRow = { day_of_week: number; label: string; enabled: boolean; start: string; end: string }

function rowsFromSchedules(schedules: MenuSchedule[]): DayRow[] {
  const map = new Map<number, { start: string; end: string }>()
  for (const s of schedules) {
    map.set(s.day_of_week, {
      start: s.start_time.slice(0, 5),
      end: s.end_time.slice(0, 5),
    })
  }
  return UI_DAYS.map(({ dow, label }) => ({
    day_of_week: dow,
    label,
    enabled: map.has(dow),
    start: map.get(dow)?.start ?? '12:00',
    end: map.get(dow)?.end ?? '17:00',
  }))
}

function MenuEditorModal({
  menu,
  items,
  onClose,
  onSaved,
}: {
  menu: MenuWithSchedules
  items: MenuItemAdmin[]
  onClose: () => void
  onSaved: () => void
}) {
  const { restaurantId } = useOwnerRestaurant()
  const [tab, setTab] = useState<'schedule' | 'items'>('schedule')
  const [rows, setRows] = useState<DayRow[]>(() =>
    rowsFromSchedules(menu.menu_schedules ?? [])
  )
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set())
  const [loadingAssign, setLoadingAssign] = useState(true)
  const [saving, setSaving] = useState(false)
  const [assignBusy, setAssignBusy] = useState<string | null>(null)

  const loadAssignments = useCallback(async () => {
    setLoadingAssign(true)
    try {
      const data = await apiGetJson<MenuItemAssignment[]>(
        `/api/menu/menus/${menu.id}/items?restaurantId=${encodeURIComponent(restaurantId)}`
      )
      setAssignedIds(new Set(data.map(a => a.menu_item_id)))
    } catch {
      setAssignedIds(new Set())
    } finally {
      setLoadingAssign(false)
    }
  }, [menu.id, restaurantId])

  useEffect(() => {
    void loadAssignments()
  }, [loadAssignments])

  const saveSchedule = async () => {
    setSaving(true)
    try {
      const schedules = rows
        .filter(r => r.enabled)
        .map(r => ({
          day_of_week: r.day_of_week,
          start_time: r.start.length === 5 ? `${r.start}:00` : r.start,
          end_time: r.end.length === 5 ? `${r.end}:00` : r.end,
        }))
      await apiPutJson(
        `/api/menu/menus/${menu.id}/schedule`,
        { restaurant_id: restaurantId, schedules }
      )
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const toggleItem = async (menuItemId: string, checked: boolean) => {
    setAssignBusy(menuItemId)
    try {
      if (checked) {
        await apiSendJson(`/api/menu/menus/${menu.id}/items`, 'POST', {
          restaurant_id: restaurantId,
          menu_item_id: menuItemId,
        })
        setAssignedIds(prev => new Set([...prev, menuItemId]))
      } else {
        await apiDelete(`/api/menu/menus/${menu.id}/items`, {
          restaurant_id: restaurantId,
          menu_item_id: menuItemId,
        })
        setAssignedIds(prev => {
          const n = new Set(prev)
          n.delete(menuItemId)
          return n
        })
      }
      onSaved()
    } finally {
      setAssignBusy(null)
    }
  }

  return (
    <>
      <motion.button
        type="button"
        aria-label="Close"
        className="fixed inset-0 z-40 bg-brand-900/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl bg-white shadow-elevated"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
      >
        <div className="border-b border-brand-200 px-4 py-3">
          <h3 className="font-display text-lg font-semibold text-brand-900">
            {menu.name_en || menu.name_el}
          </h3>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setTab('schedule')}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                tab === 'schedule' ? 'bg-brand-800 text-white' : 'bg-brand-100 text-brand-700'
              }`}
            >
              Schedule
            </button>
            <button
              type="button"
              onClick={() => setTab('items')}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                tab === 'items' ? 'bg-brand-800 text-white' : 'bg-brand-100 text-brand-700'
              }`}
            >
              Items
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'schedule' ? (
            <div className="space-y-3">
              {rows.map((row, i) => (
                <div
                  key={row.day_of_week}
                  className="flex flex-wrap items-center gap-2 border-b border-brand-100 pb-2"
                >
                  <label className="flex w-24 items-center gap-2 text-sm text-brand-800">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={e => {
                        const next = [...rows]
                        next[i] = { ...row, enabled: e.target.checked }
                        setRows(next)
                      }}
                    />
                    {row.label}
                  </label>
                  <input
                    type="time"
                    disabled={!row.enabled}
                    value={row.start}
                    onChange={e => {
                      const next = [...rows]
                      next[i] = { ...row, start: e.target.value }
                      setRows(next)
                    }}
                    className="rounded border border-brand-200 px-2 py-1 text-sm disabled:opacity-50"
                  />
                  <span className="text-brand-500">–</span>
                  <input
                    type="time"
                    disabled={!row.enabled}
                    value={row.end}
                    onChange={e => {
                      const next = [...rows]
                      next[i] = { ...row, end: e.target.value }
                      setRows(next)
                    }}
                    className="rounded border border-brand-200 px-2 py-1 text-sm disabled:opacity-50"
                  />
                </div>
              ))}
              <button
                type="button"
                disabled={saving}
                onClick={saveSchedule}
                className="mt-4 w-full rounded-lg bg-brand-800 py-2 text-sm font-medium text-white hover:bg-brand-900"
              >
                {saving ? 'Saving…' : 'Save schedule'}
              </button>
            </div>
          ) : loadingAssign ? (
            <div className="py-8 text-center text-sm text-brand-500">Loading…</div>
          ) : (
            <ul className="space-y-2">
              {items.map(it => (
                <li key={it.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`mitem-${it.id}`}
                    checked={assignedIds.has(it.id)}
                    disabled={assignBusy === it.id}
                    onChange={e => toggleItem(it.id, e.target.checked)}
                  />
                  <label htmlFor={`mitem-${it.id}`} className="text-sm text-brand-800">
                    {it.name_el || it.name_en}
                    <span className="ml-2 text-xs capitalize text-brand-500">({it.type})</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-brand-200 p-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-brand-200 py-2 text-sm font-medium text-brand-800 hover:bg-brand-50"
          >
            Close
          </button>
        </div>
      </motion.div>
    </>
  )
}

type Props = {
  menus: MenuWithSchedules[]
  items: MenuItemAdmin[]
  loading: boolean
  onRefresh: () => void
}

export function MenusTab({ menus, items, loading, onRefresh }: Props) {
  const { restaurantId } = useOwnerRestaurant()
  const [editorMenu, setEditorMenu] = useState<MenuWithSchedules | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addBusy, setAddBusy] = useState(false)
  const [deleteMenu, setDeleteMenu] = useState<MenuWithSchedules | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const addMenu = async () => {
    if (!addName.trim()) return
    setAddBusy(true)
    try {
      type Tr = { el: string | null; en: string | null }
      const tr = await apiSendJson<Tr>('/api/menu/translate', 'POST', { text: addName.trim() })
      const el = tr?.el ?? addName.trim()
      const en = tr?.en ?? addName.trim()
      await apiSendJson('/api/menu/menus', 'POST', {
        restaurant_id: restaurantId,
        name_el: el,
        name_en: en,
        is_default: false,
      })
      setAddOpen(false)
      setAddName('')
      onRefresh()
    } finally {
      setAddBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteMenu) return
    setDeleteBusy(true)
    try {
      await fetch(
        `/api/menu/menus/${deleteMenu.id}?restaurantId=${encodeURIComponent(restaurantId)}`,
        { method: 'DELETE', credentials: 'include' }
      ).then(async r => {
        if (!r.ok) {
          const t = await r.json().catch(() => ({}))
          throw new Error((t as { error?: string }).error ?? r.statusText)
        }
      })
      setDeleteMenu(null)
      onRefresh()
    } finally {
      setDeleteBusy(false)
    }
  }

  if (loading && menus.length === 0) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 animate-pulse rounded-full bg-brand-200" aria-label="Loading" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
        >
          Add Menu
        </button>
      </div>

      {menus.length === 0 ? (
        <EmptyState title="No menus" hint="Create a menu to use scheduled menus on Pro." />
      ) : (
        <ul className="space-y-3">
          {menus.map(m => {
            const sched = m.menu_schedules ?? []
            return (
              <li
                key={m.id}
                className="rounded-xl border border-brand-200 bg-white p-4 shadow-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-brand-900">{m.name_en || m.name_el}</span>
                      {m.is_default && (
                        <span className="rounded-full bg-accent-400/20 px-2 py-0.5 text-xs font-medium text-accent-600">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-brand-600">
                      {summarizeMenuSchedules(sched)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditorMenu(m)}
                      className="rounded-lg border border-brand-200 px-3 py-1.5 text-sm text-brand-800 hover:bg-brand-50"
                    >
                      Edit schedule
                    </button>
                    <button
                      type="button"
                      disabled={m.is_default}
                      title={m.is_default ? 'Cannot delete default menu' : undefined}
                      onClick={() => setDeleteMenu(m)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <AnimatePresence>
        {editorMenu && (
          <MenuEditorModal
            menu={editorMenu}
            items={items}
            onClose={() => setEditorMenu(null)}
            onSaved={onRefresh}
          />
        )}
      </AnimatePresence>

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-elevated">
            <h3 className="font-display text-lg font-semibold text-brand-900">Add menu</h3>
            <input
              type="text"
              value={addName}
              onChange={e => setAddName(e.target.value)}
              placeholder="Menu name"
              className="mt-4 w-full rounded-lg border border-brand-200 px-3 py-2"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="rounded-lg px-4 py-2 text-sm text-brand-700 hover:bg-brand-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={addBusy}
                onClick={addMenu}
                className="rounded-lg bg-brand-800 px-4 py-2 text-sm text-white"
              >
                {addBusy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/40 p-4">
          <div className="max-w-md rounded-xl bg-white p-6 shadow-elevated">
            <p className="text-brand-900">Delete menu &quot;{deleteMenu.name_en || deleteMenu.name_el}&quot;?</p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteMenu(null)}
                className="rounded-lg px-4 py-2 text-sm text-brand-700 hover:bg-brand-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={confirmDelete}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm text-white"
              >
                {deleteBusy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
