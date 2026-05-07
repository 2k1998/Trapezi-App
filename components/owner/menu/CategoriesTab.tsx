'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useOwnerRestaurant } from '@/components/owner/owner-context'
import { apiSendJson, apiDelete } from '@/lib/menu/client-api'
import { EmptyState } from './EmptyState'
import type { Category, MenuItemAdmin } from './types'

type Props = {
  categories: Category[]
  items: MenuItemAdmin[]
  loading: boolean
  onRefresh: () => void
}

export function CategoriesTab({ categories, items, loading, onRefresh }: Props) {
  const { restaurantId } = useOwnerRestaurant()
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [renameCat, setRenameCat] = useState<Category | null>(null)
  const [renameText, setRenameText] = useState('')
  const [renameBusy, setRenameBusy] = useState(false)
  const [deleteCat, setDeleteCat] = useState<Category | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [moveBusy, setMoveBusy] = useState<string | null>(null)

  const sorted = useMemo(
    () => [...categories].sort((a, b) => a.display_order - b.display_order),
    [categories]
  )

  const itemCountForCategory = (id: string) => items.filter(i => i.category_id === id).length

  const addCategory = async () => {
    if (!newName.trim()) return
    setAdding(true)
    try {
      await apiSendJson('/api/menu/categories', 'POST', {
        restaurant_id: restaurantId,
        source_text: newName.trim(),
      })
      setNewName('')
      onRefresh()
    } finally {
      setAdding(false)
    }
  }

  const move = async (cat: Category, dir: 'up' | 'down') => {
    const i = sorted.findIndex(c => c.id === cat.id)
    const j = dir === 'up' ? i - 1 : i + 1
    if (j < 0 || j >= sorted.length) return
    const a = sorted[i]
    const b = sorted[j]
    setMoveBusy(cat.id)
    try {
      await Promise.all([
        apiSendJson(`/api/menu/categories/${a.id}`, 'PATCH', {
          restaurant_id: restaurantId,
          display_order: b.display_order,
        }),
        apiSendJson(`/api/menu/categories/${b.id}`, 'PATCH', {
          restaurant_id: restaurantId,
          display_order: a.display_order,
        }),
      ])
      onRefresh()
    } finally {
      setMoveBusy(null)
    }
  }

  const saveRename = async () => {
    if (!renameCat || !renameText.trim()) return
    setRenameBusy(true)
    try {
      type Tr = { el: string | null; en: string | null }
      const tr = await apiSendJson<Tr>('/api/menu/translate', 'POST', { text: renameText.trim() })
      const el = tr?.el ?? renameText.trim()
      const en = tr?.en ?? renameText.trim()
      await apiSendJson(`/api/menu/categories/${renameCat.id}`, 'PATCH', {
        restaurant_id: restaurantId,
        name_el: el,
        name_en: en,
      })
      setRenameCat(null)
      onRefresh()
    } finally {
      setRenameBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteCat) return
    setDeleteBusy(true)
    try {
      await apiDelete(
        `/api/menu/categories/${deleteCat.id}?restaurantId=${encodeURIComponent(restaurantId)}`
      )
      setDeleteCat(null)
      onRefresh()
    } finally {
      setDeleteBusy(false)
    }
  }

  if (loading && categories.length === 0) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 animate-pulse rounded-full bg-brand-200" aria-label="Loading" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-end">
        <div className="flex w-full flex-1 flex-wrap items-end gap-2 sm:max-w-md sm:justify-end">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="New category name"
            className="min-w-0 flex-1 rounded-lg border border-brand-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={adding || !newName.trim()}
            onClick={addCategory}
            className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-50"
          >
            {adding ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          title="No categories"
          hint="Categories help organize your menu. Add one above."
        />
      ) : (
        <ul className="space-y-2">
          {sorted.map((cat, idx) => (
            <li
              key={cat.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-white px-4 py-3 shadow-card"
            >
              <span className="text-brand-400 select-none" aria-hidden>
                ⋮⋮
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-brand-900">{cat.name_el || cat.name_en}</div>
                <div className="text-xs text-brand-500">{cat.name_en} / {cat.name_el}</div>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={idx === 0 || moveBusy === cat.id}
                  onClick={() => move(cat, 'up')}
                  className="rounded border border-brand-200 px-2 py-1 text-sm text-brand-700 disabled:opacity-40"
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={idx === sorted.length - 1 || moveBusy === cat.id}
                  onClick={() => move(cat, 'down')}
                  className="rounded border border-brand-200 px-2 py-1 text-sm text-brand-700 disabled:opacity-40"
                  aria-label="Move down"
                >
                  ↓
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRenameCat(cat)
                  setRenameText(cat.name_el || cat.name_en)
                }}
                className="rounded-lg border border-brand-200 px-3 py-1.5 text-sm text-brand-800 hover:bg-brand-50"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => setDeleteCat(cat)}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence>
        {renameCat && (
          <>
            <motion.button
              type="button"
              aria-label="Close"
              className="fixed inset-0 z-40 bg-brand-900/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRenameCat(null)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-elevated"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
            >
              <h3 className="font-display text-lg font-semibold text-brand-900">Rename category</h3>
              <input
                type="text"
                value={renameText}
                onChange={e => setRenameText(e.target.value)}
                className="mt-4 w-full rounded-lg border border-brand-200 px-3 py-2"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRenameCat(null)}
                  className="rounded-lg px-4 py-2 text-sm text-brand-700 hover:bg-brand-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={renameBusy}
                  onClick={saveRename}
                  className="rounded-lg bg-brand-800 px-4 py-2 text-sm text-white hover:bg-brand-900"
                >
                  {renameBusy ? 'Saving…' : 'Save'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {deleteCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/40 p-4">
          <div className="max-w-md rounded-xl bg-white p-6 shadow-elevated">
            <p className="text-brand-900">
              {itemCountForCategory(deleteCat.id) > 0
                ? `${itemCountForCategory(deleteCat.id)} items will become uncategorized. Continue?`
                : `Delete category "${deleteCat.name_el || deleteCat.name_en}"?`}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteCat(null)}
                className="rounded-lg px-4 py-2 text-sm text-brand-700 hover:bg-brand-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={confirmDelete}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm text-white hover:bg-red-800"
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
