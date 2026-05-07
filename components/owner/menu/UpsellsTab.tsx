'use client'

import { useMemo, useState } from 'react'
import { useOwnerRestaurant } from '@/components/owner/owner-context'
import { apiSendJson, apiDelete } from '@/lib/menu/client-api'
import { EmptyState } from './EmptyState'
import type { MenuItemAdmin, UpsellSuggestion } from './types'

type Props = {
  items: MenuItemAdmin[]
  upsells: UpsellSuggestion[]
  loading: boolean
  onRefresh: () => void
}

export function UpsellsTab({ items, upsells, loading, onRefresh }: Props) {
  const { restaurantId } = useOwnerRestaurant()
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const byItem = useMemo(() => {
    const m = new Map<string, UpsellSuggestion[]>()
    for (const u of upsells) {
      const arr = m.get(u.item_id) ?? []
      arr.push(u)
      m.set(u.item_id, arr)
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => a.display_order - b.display_order)
    }
    return m
  }, [upsells])

  const optionsFor = (itemId: string) =>
    items.filter(i => i.id !== itemId).map(i => ({
      id: i.id,
      label: i.name_el || i.name_en || '—',
    }))

  const setSlot = async (
    itemId: string,
    displayOrder: 1 | 2,
    newSuggestedId: string | null,
    existing: UpsellSuggestion | undefined
  ) => {
    if (newSuggestedId === existing?.suggested_item_id) return
    const key = `${itemId}-${displayOrder}`
    setBusyKey(key)
    try {
      if (existing) {
        await apiDelete('/api/menu/upsells', { restaurant_id: restaurantId, id: existing.id })
      }
      if (newSuggestedId) {
        await apiSendJson('/api/menu/upsells', 'POST', {
          restaurant_id: restaurantId,
          item_id: itemId,
          suggested_item_id: newSuggestedId,
          display_order: displayOrder,
        })
      }
      onRefresh()
    } finally {
      setBusyKey(null)
    }
  }

  const removeSlot = async (row: UpsellSuggestion) => {
    setBusyKey(row.id)
    try {
      await apiDelete('/api/menu/upsells', { restaurant_id: restaurantId, id: row.id })
      onRefresh()
    } finally {
      setBusyKey(null)
    }
  }

  if (loading && items.length === 0) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 animate-pulse rounded-full bg-brand-200" aria-label="Loading" />
      </div>
    )
  }

  if (items.length === 0) {
    return <EmptyState title="No items" hint="Add menu items first to configure upsells." />
  }

  return (
    <ul className="space-y-4">
      {items.map(item => {
        const slots = byItem.get(item.id) ?? []
        const s1 = slots.find(s => s.display_order === 1)
        const s2 = slots.find(s => s.display_order === 2)
        const opts = optionsFor(item.id)

        return (
          <li
            key={item.id}
            className="rounded-xl border border-brand-200 bg-white p-4 shadow-card"
          >
            <div className="mb-3 font-medium text-brand-900">
              {item.name_el || item.name_en}
            </div>
            <div className="space-y-2">
              <UpsellSlotRow
                label="Suggestion 1"
                busy={busyKey === `${item.id}-1`}
                value={s1?.suggested_item_id ?? ''}
                options={opts}
                onChange={v => setSlot(item.id, 1, v || null, s1)}
                onRemove={s1 ? () => removeSlot(s1) : undefined}
              />
              <UpsellSlotRow
                label="Suggestion 2"
                busy={busyKey === `${item.id}-2`}
                value={s2?.suggested_item_id ?? ''}
                options={opts}
                onChange={v => setSlot(item.id, 2, v || null, s2)}
                onRemove={s2 ? () => removeSlot(s2) : undefined}
              />
            </div>
            {!s2 && (
              <p className="mt-2 text-xs text-brand-500">
                Pick an item in an empty slot to add a suggestion (up to 2 per item).
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function UpsellSlotRow({
  label,
  value,
  options,
  onChange,
  onRemove,
  busy,
}: {
  label: string
  value: string
  options: { id: string; label: string }[]
  onChange: (id: string) => void
  onRemove?: () => void
  busy: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-28 text-sm text-brand-600">{label}</span>
      <select
        disabled={busy}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-brand-200 px-2 py-1.5 text-sm"
      >
        <option value="">— Select item —</option>
        {options.map(o => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      {onRemove && value && (
        <button
          type="button"
          disabled={busy}
          onClick={onRemove}
          className="text-sm text-red-600 hover:underline disabled:opacity-50"
        >
          Remove
        </button>
      )}
    </div>
  )
}
