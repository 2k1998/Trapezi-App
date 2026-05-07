'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useOwnerRestaurant } from '@/components/owner/owner-context'
import { formatMoney } from '@/lib/formatMoney'
import { formatDayList } from '@/lib/menu/schedule-summary'
import { apiSendJson } from '@/lib/menu/client-api'
import { EmptyState } from './EmptyState'
import type { HappyHourRuleWithItems, MenuItemAdmin } from './types'

const UI_DAYS: { label: string; dow: number }[] = [
  { label: 'Mon', dow: 1 },
  { label: 'Tue', dow: 2 },
  { label: 'Wed', dow: 3 },
  { label: 'Thu', dow: 4 },
  { label: 'Fri', dow: 5 },
  { label: 'Sat', dow: 6 },
  { label: 'Sun', dow: 0 },
]

type Props = {
  rules: HappyHourRuleWithItems[]
  items: MenuItemAdmin[]
  loading: boolean
  onRefresh: () => void
  onTranslationWarning: (msg: string) => void
}

function RuleDrawer({
  open,
  rule,
  items,
  onClose,
  onSaved,
  onTranslationWarning,
}: {
  open: boolean
  rule: HappyHourRuleWithItems | null
  items: MenuItemAdmin[]
  onClose: () => void
  onSaved: () => void
  onTranslationWarning: (msg: string) => void
}) {
  const { restaurantId, currency } = useOwnerRestaurant()
  const [labelPrimary, setLabelPrimary] = useState('')
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage')
  const [discountValue, setDiscountValue] = useState('')
  const [days, setDays] = useState<number[]>([])
  const [start, setStart] = useState('17:00')
  const [end, setEnd] = useState('19:00')
  const [itemIds, setItemIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLocalError(null)
    if (rule) {
      setLabelPrimary(rule.label_el || rule.label_en || '')
      setDiscountType(rule.discount_type)
      setDiscountValue(String(rule.discount_value))
      setDays([...rule.day_of_week])
      setStart(rule.start_time.slice(0, 5))
      setEnd(rule.end_time.slice(0, 5))
      setItemIds(new Set(rule.items ?? []))
    } else {
      setLabelPrimary('')
      setDiscountType('percentage')
      setDiscountValue('10')
      setDays([1, 2, 3, 4, 5])
      setStart('17:00')
      setEnd('19:00')
      setItemIds(new Set())
    }
  }, [open, rule])

  const toggleDay = (dow: number) => {
    setDays(prev => (prev.includes(dow) ? prev.filter(x => x !== dow) : [...prev, dow]))
  }

  const toggleItem = (id: string) => {
    setItemIds(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const save = async () => {
    setLocalError(null)
    const dv = parseFloat(discountValue.replace(',', '.'))
    if (!Number.isFinite(dv) || dv < 0) {
      setLocalError('Enter a valid discount value')
      return
    }
    if (days.length === 0) {
      setLocalError('Select at least one day')
      return
    }

    setSaving(true)
    try {
      let label_el: string | null = null
      let label_en: string | null = null
      if (labelPrimary.trim()) {
        type Tr = { el: string | null; en: string | null; warning?: string }
        const tr = await apiSendJson<Tr>('/api/menu/translate', 'POST', {
          text: labelPrimary.trim(),
        })
        if (tr?.warning || (tr?.el == null && tr?.en == null)) {
          onTranslationWarning(
            'Auto-translation failed for the label. Please edit rule and add translations later if needed.'
          )
          label_el = labelPrimary.trim()
          label_en = labelPrimary.trim()
        } else if (tr) {
          label_el = tr.el ?? labelPrimary.trim()
          label_en = tr.en ?? labelPrimary.trim()
        }
      }

      const body = {
        restaurant_id: restaurantId,
        label_el,
        label_en,
        discount_type: discountType,
        discount_value: dv,
        day_of_week: days,
        start_time: start.length === 5 ? `${start}:00` : start,
        end_time: end.length === 5 ? `${end}:00` : end,
        item_ids: [...itemIds],
      }

      if (rule) {
        await apiSendJson(`/api/menu/happy-hour/${rule.id}`, 'PATCH', body)
      } else {
        await apiSendJson('/api/menu/happy-hour', 'POST', body)
      }
      onSaved()
      onClose()
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
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
          <motion.aside
            className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-md flex-col border-l border-brand-200 bg-white shadow-elevated"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
          >
            <div className="flex items-center justify-between border-b border-brand-200 px-4 py-3">
              <h2 className="font-display text-lg font-semibold text-brand-900">
                {rule ? 'Edit happy hour' : 'Add happy hour'}
              </h2>
              <button type="button" onClick={onClose} className="p-2 text-brand-600 hover:bg-brand-100">
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {localError && <p className="mb-3 text-sm text-red-600">{localError}</p>}
              <label className="mb-1 block text-sm font-medium text-brand-700">Label (optional)</label>
              <input
                type="text"
                value={labelPrimary}
                onChange={e => setLabelPrimary(e.target.value)}
                className="mb-4 w-full rounded-lg border border-brand-200 px-3 py-2"
              />
              <span className="mb-2 block text-sm font-medium text-brand-700">Discount</span>
              <div className="mb-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setDiscountType('percentage')}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    discountType === 'percentage'
                      ? 'bg-brand-800 text-white'
                      : 'bg-brand-100 text-brand-700'
                  }`}
                >
                  Percentage
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType('fixed')}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    discountType === 'fixed'
                      ? 'bg-brand-800 text-white'
                      : 'bg-brand-100 text-brand-700'
                  }`}
                >
                  Fixed amount
                </button>
              </div>
              <div className="mb-4 flex items-center gap-2">
                {discountType === 'percentage' ? (
                  <>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={discountValue}
                      onChange={e => setDiscountValue(e.target.value)}
                      className="w-24 rounded-lg border border-brand-200 px-3 py-2"
                    />
                    <span className="text-brand-600">%</span>
                  </>
                ) : (
                  <>
                    <span className="text-brand-600">
                      {new Intl.NumberFormat(undefined, {
                        style: 'currency',
                        currency: currency.toUpperCase(),
                      })
                        .formatToParts(0)
                        .find(p => p.type === 'currency')?.value ?? '€'}
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={discountValue}
                      onChange={e => setDiscountValue(e.target.value)}
                      className="flex-1 rounded-lg border border-brand-200 px-3 py-2"
                    />
                  </>
                )}
              </div>
              <fieldset className="mb-4">
                <legend className="mb-2 text-sm font-medium text-brand-700">Days</legend>
                <div className="flex flex-wrap gap-2">
                  {UI_DAYS.map(d => (
                    <label key={d.dow} className="flex items-center gap-1 text-sm text-brand-800">
                      <input
                        type="checkbox"
                        checked={days.includes(d.dow)}
                        onChange={() => toggleDay(d.dow)}
                      />
                      {d.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <label className="text-sm text-brand-700">Start</label>
                <input
                  type="time"
                  value={start}
                  onChange={e => setStart(e.target.value)}
                  className="rounded border border-brand-200 px-2 py-1"
                />
                <label className="text-sm text-brand-700">End</label>
                <input
                  type="time"
                  value={end}
                  onChange={e => setEnd(e.target.value)}
                  className="rounded border border-brand-200 px-2 py-1"
                />
              </div>
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-brand-700">Items</legend>
                <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-brand-100 p-2">
                  {items.map(it => (
                    <li key={it.id}>
                      <label className="flex items-center gap-2 text-sm text-brand-800">
                        <input
                          type="checkbox"
                          checked={itemIds.has(it.id)}
                          onChange={() => toggleItem(it.id)}
                        />
                        {it.name_el || it.name_en}
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            </div>
            <div className="border-t border-brand-200 p-4">
              <button
                type="button"
                disabled={saving}
                onClick={save}
                className="w-full rounded-lg bg-brand-800 py-2.5 font-medium text-white hover:bg-brand-900 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

export function HappyHourTab({
  rules,
  items,
  loading,
  onRefresh,
  onTranslationWarning,
}: Props) {
  const { restaurantId, currency } = useOwnerRestaurant()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<HappyHourRuleWithItems | null>(null)
  const [deleteRule, setDeleteRule] = useState<HappyHourRuleWithItems | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const discountLabel = (r: HappyHourRuleWithItems) => {
    if (r.discount_type === 'percentage') {
      return `${r.discount_value}% off`
    }
    return `${formatMoney(Number(r.discount_value), currency)} off`
  }

  const confirmDelete = async () => {
    if (!deleteRule) return
    setDeleteBusy(true)
    try {
      await fetch(
        `/api/menu/happy-hour/${deleteRule.id}?restaurantId=${encodeURIComponent(restaurantId)}`,
        { method: 'DELETE', credentials: 'include' }
      ).then(async r => {
        if (!r.ok) throw new Error(await r.text())
      })
      setDeleteRule(null)
      onRefresh()
    } finally {
      setDeleteBusy(false)
    }
  }

  if (loading && rules.length === 0) {
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
          onClick={() => {
            setEditing(null)
            setDrawerOpen(true)
          }}
          className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
        >
          Add Rule
        </button>
      </div>

      {rules.length === 0 ? (
        <EmptyState
          title="No happy hour rules"
          hint="Create a rule to discount selected items during specific hours."
          actionLabel="Add rule"
          onAction={() => {
            setEditing(null)
            setDrawerOpen(true)
          }}
        />
      ) : (
        <ul className="space-y-3">
          {rules.map(r => (
            <li
              key={r.id}
              className="rounded-xl border border-brand-200 bg-white p-4 shadow-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-brand-900">
                    {r.label_el || r.label_en || 'No label'}
                  </div>
                  <div className="text-success-600 mt-1 font-medium">{discountLabel(r)}</div>
                  <p className="mt-1 text-sm text-brand-600">
                    {formatDayList(r.day_of_week)} {r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)}
                  </p>
                  <p className="mt-1 text-xs text-brand-500">
                    {(r.items ?? []).length} item{(r.items ?? []).length === 1 ? '' : 's'} assigned
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(r)
                      setDrawerOpen(true)
                    }}
                    className="rounded-lg border border-brand-200 px-3 py-1.5 text-sm text-brand-800 hover:bg-brand-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteRule(r)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <RuleDrawer
        open={drawerOpen}
        rule={editing}
        items={items}
        onClose={() => setDrawerOpen(false)}
        onSaved={onRefresh}
        onTranslationWarning={onTranslationWarning}
      />

      {deleteRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/40 p-4">
          <div className="max-w-md rounded-xl bg-white p-6 shadow-elevated">
            <p className="text-brand-900">Delete this happy hour rule?</p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteRule(null)}
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
