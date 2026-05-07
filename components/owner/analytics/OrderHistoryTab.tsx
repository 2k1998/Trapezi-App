'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ErrorBanner, WarningBanner } from '@/components/owner/menu/Banners'
import { EmptyState } from '@/components/owner/menu/EmptyState'
import { PlanGateAuto } from '@/components/owner/PlanGate'
import { apiGetJson } from '@/lib/menu/client-api'
import type { OrderHistoryRow } from '@/types/analytics'
import { getDateRangeFromPreset, toIso } from './date-range'
import { formatDateTime, formatMoney, statusTone } from './format'
import type { DatePreset, StatusFilter } from './types'

type Props = {
  restaurantId: string
  currency: string
  planLevel: 'free' | 'basic' | 'pro'
}

type OrdersResponse = {
  rows: OrderHistoryRow[]
  total: number
  page: number
  pageSize: number
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms)
    return () => window.clearTimeout(id)
  }, [value, ms])
  return debounced
}

export function OrderHistoryTab({ restaurantId, currency, planLevel }: Props) {
  const isPro = planLevel === 'pro'
  const isBasic = planLevel === 'basic'
  const [searchInput, setSearchInput] = useState('')
  const search = useDebounced(searchInput, 400)
  const [tableNumber, setTableNumber] = useState<number | 'all'>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [preset, setPreset] = useState<DatePreset>(isBasic ? 'last7Days' : 'last30Days')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [rows, setRows] = useState<OrderHistoryRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copyMsg, setCopyMsg] = useState<string | null>(null)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  useEffect(() => {
    if (isBasic) {
      const blocked =
        preset === 'last30Days' ||
        preset === 'last6Months' ||
        preset === 'last9Months' ||
        preset === 'lastYear'
      if (blocked) setPreset('last7Days')
    }
  }, [isBasic, preset])

  const tableOptions = useMemo(() => {
    const uniq = Array.from(new Set(rows.map(r => r.table_number))).sort((a, b) => a - b)
    return uniq
  }, [rows])

  const hasMore = rows.length < total

  async function fetchPage(nextPage: number, append: boolean) {
    const range = getDateRangeFromPreset(preset, customFrom, customTo)
    const params = new URLSearchParams({
      restaurantId,
      from: toIso(range.from),
      to: toIso(range.to),
      page: String(nextPage),
      pageSize: '50',
    })
    if (search.trim()) params.set('search', search.trim())
    if (tableNumber !== 'all') params.set('tableNumber', String(tableNumber))
    if (status !== 'all') params.set('status', status)

    const data = await apiGetJson<OrdersResponse>(`/api/analytics/orders?${params.toString()}`)
    setTotal(data.total)
    setPage(data.page)
    setRows(prev => (append ? [...prev, ...data.rows] : data.rows))
  }

  useEffect(() => {
    setLoading(true)
    setError(null)
    void fetchPage(1, false)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load orders'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, search, tableNumber, status, preset, customFrom, customTo])

  const copyOrderId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id)
      setCopyMsg('Order ID copied')
      window.setTimeout(() => setCopyMsg(null), 1200)
    } catch {
      setCopyMsg('Copy failed')
      window.setTimeout(() => setCopyMsg(null), 1200)
    }
  }

  const onExport = async () => {
    try {
      const range = getDateRangeFromPreset(preset, customFrom, customTo)
      const params = new URLSearchParams({
        restaurantId,
        from: toIso(range.from),
        to: toIso(range.to),
      })
      const res = await fetch(`/api/analytics/export?${params.toString()}`, { credentials: 'include' })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Export failed')
      }
      const fileBuffer = await res.arrayBuffer()
      const blob = new Blob([fileBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const date = new Date().toISOString().slice(0, 10)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `trapezi-export-${date}.xlsx`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed')
    }
  }

  const clearFilters = () => {
    setSearchInput('')
    setTableNumber('all')
    setStatus('all')
    setPreset(isBasic ? 'last7Days' : 'last30Days')
    setCustomFrom('')
    setCustomTo('')
  }

  const dateBtn = (id: DatePreset, label: string, disabled = false) => (
    <button
      type="button"
      key={id}
      disabled={disabled}
      title={disabled ? 'Upgrade to Pro for full history' : undefined}
      onClick={() => !disabled && setPreset(id)}
      className={`rounded-full border px-3 py-1 text-xs font-medium ${
        preset === id
          ? 'border-brand-800 bg-brand-800 text-white'
          : disabled
            ? 'cursor-not-allowed border-brand-200 bg-brand-100 text-brand-400'
            : 'border-brand-300 bg-white text-brand-700 hover:bg-brand-50'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      {copyMsg && <WarningBanner message={copyMsg} onDismiss={() => setCopyMsg(null)} />}

      <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-card">
        <div className="grid gap-3 lg:grid-cols-12">
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search by customer, phone, or item..."
            className="lg:col-span-4 rounded-lg border border-brand-300 px-3 py-2 text-sm text-brand-900 focus:border-brand-500 focus:outline-none"
          />
          <select
            value={tableNumber}
            onChange={e =>
              setTableNumber(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            className="lg:col-span-2 rounded-lg border border-brand-300 px-3 py-2 text-sm text-brand-900 focus:border-brand-500 focus:outline-none"
          >
            <option value="all">All Tables</option>
            {tableOptions.map(t => (
              <option key={t} value={t}>
                Table {t}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={e => setStatus(e.target.value as StatusFilter)}
            className="lg:col-span-2 rounded-lg border border-brand-300 px-3 py-2 text-sm text-brand-900 focus:border-brand-500 focus:outline-none"
          >
            <option value="all">All</option>
            <option value="paid">Paid</option>
            <option value="ready">Ready</option>
            <option value="closed">Closed</option>
          </select>
          <div className="lg:col-span-4 flex items-center justify-end">
            {isPro ? (
              <PlanGateAuto requiredPlan="pro" featureName="Εξαγωγή Excel">
                <button
                  type="button"
                  onClick={onExport}
                  className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
                >
                  Export Excel
                </button>
              </PlanGateAuto>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {dateBtn('today', 'Today')}
          {dateBtn('last7Days', 'Last 7 days')}
          {dateBtn('last30Days', 'Last 30 days', isBasic)}
          {dateBtn('last6Months', 'Last 6 months', isBasic)}
          {dateBtn('last9Months', 'Last 9 months', isBasic)}
          {dateBtn('lastYear', 'Last year', isBasic)}
          {dateBtn('custom', 'Custom')}
        </div>
        {preset === 'custom' && (
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="rounded-lg border border-brand-300 px-3 py-2 text-sm text-brand-900"
            />
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="rounded-lg border border-brand-300 px-3 py-2 text-sm text-brand-900"
            />
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-brand-200 bg-white shadow-card">
        <div className="grid grid-cols-8 gap-2 border-b border-brand-200 bg-brand-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-brand-600">
          <div>Order ID</div>
          <div>Table</div>
          <div>Customer</div>
          <div>Phone</div>
          <div>Items</div>
          <div>Total</div>
          <div>Status</div>
          <div>Date/Time</div>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-brand-100" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No orders found for the selected filters."
              hint="Try adjusting your filters or date range."
              actionLabel="Clear filters"
              onAction={clearFilters}
            />
          </div>
        ) : (
          <div>
            {rows.map(row => {
              const extra = row.items.length > 3 ? row.items.length - 3 : 0
              return (
                <div key={row.id} className="border-b border-brand-100 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setExpandedRow(prev => (prev === row.id ? null : row.id))}
                    className="grid w-full grid-cols-8 gap-2 px-4 py-3 text-left text-sm text-brand-800 hover:bg-brand-50"
                  >
                    <div
                      className="font-mono text-xs text-brand-700 underline decoration-dotted"
                      onClick={e => {
                        e.stopPropagation()
                        void copyOrderId(row.id)
                      }}
                    >
                      {row.id.slice(0, 8)}
                    </div>
                    <div>{row.table_number}</div>
                    <div className="truncate">{row.customer_name || '—'}</div>
                    <div className="truncate">{row.customer_phone || '—'}</div>
                    <div className="truncate">
                      {row.items.slice(0, 3).map(i => i.name_snapshot).join(', ')}
                      {extra > 0 ? ` +${extra} more` : ''}
                    </div>
                    <div>{formatMoney(row.total, currency)}</div>
                    <div>
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${statusTone(row.status)}`}>
                        {row.status}
                      </span>
                    </div>
                    <div>{formatDateTime(row.created_at)}</div>
                  </button>
                  <AnimatePresence initial={false}>
                    {expandedRow === row.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden bg-brand-50"
                      >
                        <div className="space-y-2 px-4 py-3">
                          {row.items.map((item, idx) => (
                            <div
                              key={`${row.id}-${idx}`}
                              className="grid grid-cols-5 gap-2 rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm"
                            >
                              <div className="col-span-2 text-brand-800">{item.name_snapshot}</div>
                              <div className="text-brand-600">Qty {item.quantity}</div>
                              <div className="text-brand-600">{formatMoney(item.unit_price, currency)}</div>
                              <div className="text-brand-900">
                                {formatMoney(item.unit_price * item.quantity, currency)}
                              </div>
                              {item.notes ? (
                                <div className="col-span-5 text-xs text-brand-600">Notes: {item.notes}</div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {hasMore ? (
        <div className="flex justify-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => {
              setLoadingMore(true)
              void fetchPage(page + 1, true)
                .catch(e => setError(e instanceof Error ? e.message : 'Failed to load more'))
                .finally(() => setLoadingMore(false))
            }}
            className="rounded-lg border border-brand-300 bg-white px-5 py-2 text-sm font-medium text-brand-800 hover:bg-brand-50 disabled:opacity-60"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
