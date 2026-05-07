'use client'

import { useState, useMemo } from 'react'
import { useOwnerRestaurant } from '@/components/owner/owner-context'
import { formatMoney } from '@/lib/formatMoney'
import { ALLERGEN_OPTIONS } from '@/components/owner/constants'
import { apiDelete } from '@/lib/menu/client-api'
import { ItemFormDrawer } from './ItemFormDrawer'
import { EmptyState } from './EmptyState'
import type { Category, MenuItemAdmin, MenuItemWithDiscount } from './types'

function allergenLabel(slug: string): string {
  return ALLERGEN_OPTIONS.find(a => a.value === slug)?.label ?? slug
}

type Props = {
  items: MenuItemAdmin[]
  categories: Category[]
  activeByItemId: Map<string, MenuItemWithDiscount>
  loading: boolean
  onRefresh: () => void
  onTranslationWarning: (msg: string) => void
}

export function ItemsTab({
  items,
  categories,
  activeByItemId,
  loading,
  onRefresh,
  onTranslationWarning,
}: Props) {
  const { restaurantId, currency } = useOwnerRestaurant()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<MenuItemAdmin | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MenuItemAdmin | null>(null)
  const [deleting, setDeleting] = useState(false)

  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])

  const categoryName = (item: MenuItemAdmin) => {
    if (!item.category_id) return 'Uncategorized'
    const c = catMap.get(item.category_id)
    return c ? c.name_el || c.name_en : item.category || 'Uncategorized'
  }

  const displayName = (item: MenuItemAdmin) => item.name_el || item.name_en || '—'

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiDelete(
        `/api/menu/items/${deleteTarget.id}?restaurantId=${encodeURIComponent(restaurantId)}`
      )
      setDeleteTarget(null)
      onRefresh()
    } catch {
      /* parent error banner */
    } finally {
      setDeleting(false)
    }
  }

  if (loading && items.length === 0) {
    return (
      <div className="flex justify-center py-16">
        <div
          className="h-10 w-10 animate-pulse rounded-full bg-brand-200"
          aria-label="Loading"
        />
      </div>
    )
  }

  if (!loading && items.length === 0) {
    return (
      <>
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setEditing(null)
              setDrawerOpen(true)
            }}
            className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
          >
            Add Item
          </button>
        </div>
        <EmptyState
          title="No items yet"
          hint="Add your first menu item to appear on your customer menu and cashier."
          actionLabel="Add your first item"
          onAction={() => {
            setEditing(null)
            setDrawerOpen(true)
          }}
        />
        <ItemFormDrawer
          open={drawerOpen}
          item={editing}
          categories={categories}
          onClose={() => setDrawerOpen(false)}
          onSaved={onRefresh}
          onTranslationWarning={onTranslationWarning}
        />
      </>
    )
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => {
            setEditing(null)
            setDrawerOpen(true)
          }}
          className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
        >
          Add Item
        </button>
      </div>

      <ul className="space-y-3">
        {items.map(item => {
          const active = activeByItemId.get(item.id)
          const disc = active?.discounted_price
          const base = Number(item.price)
          const showDisc = disc != null && disc < base

          return (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-white p-4 shadow-card"
            >
              <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-brand-200">
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-brand-900">{displayName(item)}</div>
                <div className="text-sm text-brand-500">{categoryName(item)}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(item.allergens ?? []).map(a => (
                    <span
                      key={a}
                      className="rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-700"
                    >
                      {allergenLabel(a)}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-right">
                {showDisc ? (
                  <div>
                    <div className="text-success-600 font-semibold">
                      {formatMoney(disc, currency)}
                    </div>
                    <div className="text-sm text-brand-400 line-through">
                      {formatMoney(base, currency)}
                    </div>
                  </div>
                ) : (
                  <div className="font-semibold text-brand-900">{formatMoney(base, currency)}</div>
                )}
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                  item.type === 'food'
                    ? 'bg-brand-200 text-brand-800'
                    : 'bg-accent-400/20 text-accent-600'
                }`}
              >
                {item.type}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(item)
                    setDrawerOpen(true)
                  }}
                  className="rounded-lg border border-brand-200 px-3 py-1.5 text-sm font-medium text-brand-800 hover:bg-brand-50"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(item)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <ItemFormDrawer
        open={drawerOpen}
        item={editing}
        categories={categories}
        onClose={() => setDrawerOpen(false)}
        onSaved={onRefresh}
        onTranslationWarning={onTranslationWarning}
      />

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="max-w-md rounded-xl bg-white p-6 shadow-elevated animate-scale-in"
          >
            <p className="text-brand-900">
              Delete <strong>{displayName(deleteTarget)}</strong>? This cannot be undone for
              customers who have already ordered it.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
