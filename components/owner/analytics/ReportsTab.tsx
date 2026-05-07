'use client'

import { useEffect, useMemo, useState } from 'react'
import { ErrorBanner } from '@/components/owner/menu/Banners'
import { apiGetJson, apiSendJson } from '@/lib/menu/client-api'
import type { BestSellerItem, KPIMetrics, ReportSettings } from '@/types/analytics'
import { getLastWeekRange, toIso } from './date-range'
import { formatMoney } from './format'

type Props = {
  restaurantId: string
  currency: string
}

export function ReportsTab({ restaurantId, currency }: Props) {
  const [settings, setSettings] = useState<ReportSettings | null>(null)
  const [email, setEmail] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastMetrics, setLastMetrics] = useState<KPIMetrics | null>(null)
  const [bestSellers, setBestSellers] = useState<BestSellerItem[]>([])

  const lastRange = useMemo(() => getLastWeekRange(), [])

  useEffect(() => {
    const query = new URLSearchParams({
      restaurantId,
      from: toIso(lastRange.from),
      to: toIso(lastRange.to),
    }).toString()
    setLoading(true)
    setError(null)
    void Promise.all([
      apiGetJson<ReportSettings>(`/api/analytics/report-settings?restaurantId=${encodeURIComponent(restaurantId)}`),
      apiGetJson<KPIMetrics>(`/api/analytics/metrics?${query}`),
      apiGetJson<{ items: BestSellerItem[] }>(`/api/analytics/best-sellers?${query}`),
    ])
      .then(([s, m, best]) => {
        setSettings(s)
        setEmail(s.weekly_report_email || '')
        setLastMetrics(m)
        setBestSellers(best.items ?? [])
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load report settings'))
      .finally(() => setLoading(false))
  }, [restaurantId, lastRange])

  const patchSettings = async (patch: Partial<ReportSettings>) => {
    setSaving(true)
    setError(null)
    try {
      const data = await apiSendJson<ReportSettings>(
        `/api/analytics/report-settings?restaurantId=${encodeURIComponent(restaurantId)}`,
        'PATCH',
        patch
      )
      if (data) {
        setSettings(data)
        setEmail(data.weekly_report_email)
      }
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div className="rounded-xl border border-brand-200 bg-white p-5 shadow-card">
        <h3 className="text-lg font-semibold text-brand-900">Weekly Email Report</h3>

        {loading || !settings ? (
          <div className="mt-4 h-24 animate-pulse rounded-lg bg-brand-100" />
        ) : (
          <>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-brand-200 p-3">
              <div>
                <p className="text-sm font-medium text-brand-900">
                  Send weekly performance report every Monday
                </p>
                <p className="text-xs text-brand-500">
                  Reports are sent every Monday at 10:00 Athens time.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.weekly_report_enabled}
                onClick={() =>
                  void patchSettings({
                    weekly_report_enabled: !settings.weekly_report_enabled,
                  })
                }
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  settings.weekly_report_enabled ? 'bg-success-600' : 'bg-brand-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    settings.weekly_report_enabled ? 'left-5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-brand-200 p-3">
              <label className="mb-2 block text-sm font-medium text-brand-900">
                Recipient email address
              </label>
              <div className="flex gap-2">
                <input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-brand-300 px-3 py-2 text-sm text-brand-900"
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void patchSettings({ weekly_report_email: email.trim() })}
                  className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
              {saved ? <p className="mt-2 text-xs text-success-700">Saved ✓</p> : null}
            </div>
          </>
        )}
      </div>

      <div className="rounded-xl border border-brand-200 bg-white p-5 shadow-card">
        <h3 className="text-lg font-semibold text-brand-900">Last Report</h3>
        {!lastMetrics || lastMetrics.total_orders === 0 ? (
          <p className="mt-3 text-sm text-brand-500">
            No report has been sent yet. Your first report will arrive next Monday.
          </p>
        ) : (
          <div className="mt-3 space-y-2 rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm">
            <p className="text-brand-700">
              Period covered: {lastRange.from.toLocaleDateString()} -{' '}
              {lastRange.to.toLocaleDateString()}
            </p>
            <p className="text-brand-900">
              Total revenue: {formatMoney(lastMetrics.total_revenue, currency)}
            </p>
            <p className="text-brand-900">Total orders: {lastMetrics.total_orders}</p>
            <p className="text-brand-900">
              Average order value: {formatMoney(lastMetrics.average_order_value, currency)}
            </p>
            <div className="pt-2">
              <p className="mb-1 text-xs uppercase text-brand-500">Top 3 best sellers</p>
              {bestSellers.slice(0, 3).map(item => (
                <p key={item.item_id} className="text-brand-800">
                  {item.name} ({item.units_sold})
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
