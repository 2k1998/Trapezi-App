'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ErrorBanner } from '@/components/owner/menu/Banners'
import { apiGetJson } from '@/lib/menu/client-api'
import type {
  BestSellerCategory,
  BestSellerItem,
  HeatmapCell,
  KPIMetrics,
  RevenueDataPoint,
} from '@/types/analytics'
import { getDateRangeFromPreset, toIso } from './date-range'
import { formatMoney } from './format'
import type { DatePreset } from './types'

type Props = {
  restaurantId: string
  currency: string
}

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function OverviewTab({ restaurantId, currency }: Props) {
  const [preset, setPreset] = useState<DatePreset>('last30Days')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [metrics, setMetrics] = useState<KPIMetrics | null>(null)
  const [revenue, setRevenue] = useState<RevenueDataPoint[]>([])
  const [items, setItems] = useState<BestSellerItem[]>([])
  const [categories, setCategories] = useState<BestSellerCategory[]>([])
  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const range = getDateRangeFromPreset(preset, customFrom, customTo)
    const query = new URLSearchParams({
      restaurantId,
      from: toIso(range.from),
      to: toIso(range.to),
    }).toString()
    setLoading(true)
    setError(null)
    void Promise.all([
      apiGetJson<KPIMetrics>(`/api/analytics/metrics?${query}`),
      apiGetJson<RevenueDataPoint[]>(`/api/analytics/revenue-chart?${query}`),
      apiGetJson<{ items: BestSellerItem[]; categories: BestSellerCategory[] }>(
        `/api/analytics/best-sellers?${query}`
      ),
      apiGetJson<HeatmapCell[]>(`/api/analytics/heatmap?${query}`),
    ])
      .then(([m, rev, best, hm]) => {
        setMetrics(m)
        setRevenue(rev)
        setItems(best.items ?? [])
        setCategories(best.categories ?? [])
        setHeatmap(hm ?? [])
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load overview'))
      .finally(() => setLoading(false))
  }, [restaurantId, preset, customFrom, customTo])

  const maxHeat = useMemo(() => Math.max(0, ...heatmap.map(c => c.count)), [heatmap])
  const heatCell = (day: number, hour: number) => {
    const cell = heatmap.find(c => c.day === day && c.hour === hour)
    const count = cell?.count ?? 0
    if (count === 0) return { count, cls: 'bg-brand-100' }
    const ratio = maxHeat > 0 ? count / maxHeat : 0
    if (ratio > 0.75) return { count, cls: 'bg-brand-800' }
    if (ratio > 0.5) return { count, cls: 'bg-brand-600' }
    if (ratio > 0.25) return { count, cls: 'bg-brand-400' }
    return { count, cls: 'bg-brand-300' }
  }

  const kpiCard = (label: string, value: string, sub?: string, tone?: string) => (
    <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-card">
      <p className="text-xs uppercase tracking-wide text-brand-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-brand-900">{value}</p>
      {sub ? <p className={`mt-1 text-sm ${tone ?? 'text-brand-500'}`}>{sub}</p> : null}
    </div>
  )

  const dateBtn = (id: DatePreset, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setPreset(id)}
      className={`rounded-full border px-3 py-1 text-xs font-medium ${
        preset === id
          ? 'border-brand-800 bg-brand-800 text-white'
          : 'border-brand-300 bg-white text-brand-700 hover:bg-brand-50'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div className="sticky top-0 z-10 rounded-xl border border-brand-200 bg-white p-3 shadow-card">
        <div className="flex flex-wrap gap-2">
          {dateBtn('today', 'Today')}
          {dateBtn('last7Days', 'Last 7 days')}
          {dateBtn('last30Days', 'Last 30 days')}
          {dateBtn('last6Months', 'Last 6 months')}
          {dateBtn('last9Months', 'Last 9 months')}
          {dateBtn('lastYear', 'Last year')}
          {dateBtn('custom', 'Custom')}
        </div>
        {preset === 'custom' && (
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="rounded-lg border border-brand-300 px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="rounded-lg border border-brand-300 px-3 py-2 text-sm"
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-brand-100" />
          ))}
        </div>
      ) : metrics ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {kpiCard('Total Revenue', formatMoney(metrics.total_revenue, currency))}
          {kpiCard('Total Orders', String(metrics.total_orders))}
          {kpiCard('Average Order Value', formatMoney(metrics.average_order_value, currency))}
          {kpiCard(
            'WoW Change',
            metrics.wow_change_percent === null ? '—' : `${metrics.wow_change_percent}%`,
            'vs previous period',
            metrics.wow_change_percent === null
              ? 'text-brand-500'
              : metrics.wow_change_percent >= 0
                ? 'text-success-700'
                : 'text-red-700'
          )}
        </div>
      ) : null}

      <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-card">
        <h3 className="mb-3 text-sm font-semibold text-brand-900">Revenue Over Time</h3>
        {loading ? (
          <div className="h-72 animate-pulse rounded-lg bg-brand-100" />
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-brand-200" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip
                  formatter={value => formatMoney(Number(value ?? 0), currency)}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="currentColor"
                  strokeWidth={2}
                  dot={false}
                  className="text-accent-500"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-card">
          <h3 className="mb-3 text-sm font-semibold text-brand-900">Top Items</h3>
          {loading ? (
            <div className="h-72 animate-pulse rounded-lg bg-brand-100" />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-brand-500">
                    <th className="py-2">Rank</th>
                    <th className="py-2">Item</th>
                    <th className="py-2">Category</th>
                    <th className="py-2">Units</th>
                    <th className="py-2">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {items.slice(0, 10).map((item, idx) => (
                    <tr key={item.item_id} className="border-t border-brand-100">
                      <td className="py-2">{idx + 1}</td>
                      <td className="py-2">{item.name}</td>
                      <td className="py-2">{item.category ?? 'Uncategorized'}</td>
                      <td className="py-2">{item.units_sold}</td>
                      <td className="py-2">{formatMoney(item.total_revenue, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-card">
          <h3 className="mb-3 text-sm font-semibold text-brand-900">By Category</h3>
          {loading ? (
            <div className="h-72 animate-pulse rounded-lg bg-brand-100" />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categories} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-brand-200" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="category" width={110} />
                  <Tooltip
                    formatter={value => formatMoney(Number(value ?? 0), currency)}
                  />
                  <Bar
                    dataKey="total_revenue"
                    fill="currentColor"
                    radius={4}
                    className="text-accent-500"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-card">
        <h3 className="mb-3 text-sm font-semibold text-brand-900">Peak Hours Heatmap</h3>
        {loading ? (
          <div className="h-72 animate-pulse rounded-lg bg-brand-100" />
        ) : (
          <div className="overflow-x-auto">
            <div className="grid min-w-[980px] grid-cols-[80px_repeat(24,minmax(24px,1fr))] gap-1 text-xs">
              <div />
              {Array.from({ length: 24 }).map((_, h) => (
                <div key={h} className="text-center text-brand-500">
                  {String(h).padStart(2, '0')}
                </div>
              ))}
              {dayLabels.map((day, dayIdx) => (
                <div key={day} className="contents">
                  <div key={`label-${day}`} className="pr-2 text-right font-medium text-brand-700">
                    {day}
                  </div>
                  {Array.from({ length: 24 }).map((_, h) => {
                    const { count, cls } = heatCell(dayIdx, h)
                    return (
                      <div
                        key={`${day}-${h}`}
                        title={`${day} ${String(h).padStart(2, '0')}:00 — ${count}`}
                        className={`h-5 rounded ${cls}`}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
