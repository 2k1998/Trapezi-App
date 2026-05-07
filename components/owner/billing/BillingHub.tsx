'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { el } from 'date-fns/locale'
import { Info } from 'lucide-react'
import { useOwnerRestaurant } from '@/components/owner/owner-context'
import { ErrorBanner } from '@/components/owner/menu/Banners'
import { apiGetJson } from '@/lib/menu/client-api'
import type { BillingInfo } from '@/lib/types/billing'

type BillingInfoResponse = BillingInfo & {
  earlyExitFee: number
  contractEndDate: string | null
  leaseMonthlyWithVAT: number
}

type PlanLevel = 'free' | 'basic' | 'pro' | 'enterprise'

function normalisePlan(plan: string): PlanLevel {
  const p = plan.toLowerCase()
  if (p === 'pro') return 'pro'
  if (p === 'enterprise') return 'enterprise'
  if (p === 'basic') return 'basic'
  return 'free'
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  try {
    return format(new Date(value), 'dd MMM yyyy', { locale: el })
  } catch {
    return '—'
  }
}

function priceLabel(plan: PlanLevel): string {
  if (plan === 'basic') return '€69 / μήνα'
  if (plan === 'pro') return '€129 / μήνα'
  if (plan === 'enterprise') return '€490 / μήνα'
  return '—'
}

function PlanBadge({ plan }: { plan: PlanLevel }) {
  const map: Record<PlanLevel, string> = {
    free: 'bg-brand-100 text-brand-700',
    basic: 'bg-blue-100 text-blue-800',
    pro: 'bg-accent-400/30 text-accent-700',
    enterprise: 'bg-accent-400/30 text-accent-700',
  }
  const label: Record<PlanLevel, string> = {
    free: 'Free',
    basic: 'Basic',
    pro: 'Pro',
    enterprise: 'Enterprise',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${map[plan]}`}
    >
      {label[plan]}
    </span>
  )
}

function StatusBadge({ status }: { status: BillingInfo['subscriptionStatus'] }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center rounded-full bg-success-50 px-3 py-1 text-xs font-semibold text-success-700">
        Ενεργό
      </span>
    )
  }
  if (status === 'past_due') {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
        Σε καθυστέρηση
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
      Ακυρωμένο
    </span>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-brand-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-brand-900">{value}</dd>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-32 animate-pulse rounded-xl bg-brand-100" />
      ))}
    </div>
  )
}

function FreePlanView() {
  const features: Array<{ label: string; free: boolean; basic: boolean; pro: boolean }> = [
    { label: 'Παραγγελίες & πληρωμές', free: false, basic: true, pro: true },
    { label: 'Πολλαπλά μενού & προγραμματισμός', free: false, basic: false, pro: true },
    { label: 'Αναλυτικά στοιχεία & εξαγωγές', free: false, basic: false, pro: true },
    { label: 'Πλήρες white-label', free: false, basic: false, pro: true },
  ]
  const Cell = ({ on }: { on: boolean }) => (
    <span className={on ? 'text-success-700' : 'text-brand-400'}>{on ? '✓' : '—'}</span>
  )

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand-200 bg-white p-6 shadow-card">
        <h2 className="font-display text-xl font-semibold text-brand-900">
          Βρίσκεστε στο δωρεάν πλάνο
        </h2>
        <p className="mt-2 text-sm text-brand-600">
          Αναβαθμίστε σε Basic ή Pro για να ενεργοποιήσετε παραγγελίες, πληρωμές και αναλυτικά
          στοιχεία.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-card">
          <p className="font-display text-lg font-semibold text-brand-900">Free</p>
          <p className="mt-1 text-sm text-brand-600">€0 / μήνα</p>
          <ul className="mt-4 space-y-2 text-sm text-brand-700">
            {features.map(f => (
              <li key={f.label} className="flex items-start justify-between gap-2">
                <span>{f.label}</span>
                <Cell on={f.free} />
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-card">
          <p className="font-display text-lg font-semibold text-brand-900">Basic</p>
          <p className="mt-1 text-sm text-brand-600">€69 / μήνα</p>
          <ul className="mt-4 space-y-2 text-sm text-brand-700">
            {features.map(f => (
              <li key={f.label} className="flex items-start justify-between gap-2">
                <span>{f.label}</span>
                <Cell on={f.basic} />
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-accent-500/40 bg-accent-400/10 p-4 shadow-card">
          <p className="font-display text-lg font-semibold text-brand-900">Pro</p>
          <p className="mt-1 text-sm text-brand-600">€129 / μήνα</p>
          <ul className="mt-4 space-y-2 text-sm text-brand-700">
            {features.map(f => (
              <li key={f.label} className="flex items-start justify-between gap-2">
                <span>{f.label}</span>
                <Cell on={f.pro} />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-card">
        <a
          href="mailto:billing@trapeziapp.com"
          className="inline-flex items-center justify-center rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-900"
        >
          Αναβάθμιση πλάνου — Επικοινωνήστε μαζί μας
        </a>
      </div>
    </div>
  )
}

export function BillingHub() {
  const { restaurantId, slug, plan: rawPlan } = useOwnerRestaurant()
  const plan = normalisePlan(rawPlan)
  const [data, setData] = useState<BillingInfoResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    apiGetJson<BillingInfoResponse>(
      `/api/billing/info?restaurantId=${encodeURIComponent(restaurantId)}`
    )
      .then(payload => {
        if (cancelled) return
        setData(payload)
      })
      .catch(e => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Αποτυχία φόρτωσης στοιχείων χρέωσης')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [restaurantId])

  const onOpenPortal = async () => {
    if (portalLoading) return
    setPortalLoading(true)
    setError(null)
    try {
      const res = await apiGetJson<{ url: string }>(
        `/api/billing/portal?restaurantId=${encodeURIComponent(restaurantId)}&slug=${encodeURIComponent(slug)}`
      )
      window.location.href = res.url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Αποτυχία ανοίγματος πύλης πληρωμής')
      setPortalLoading(false)
    }
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-brand-900">Χρέωση</h2>
        <p className="mt-1 text-sm text-brand-600">
          Διαχείριση συνδρομής, συμβολαίου και τρόπου πληρωμής.
        </p>
      </div>

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      {loading || !data ? (
        <Skeleton />
      ) : plan === 'free' ? (
        <FreePlanView />
      ) : (
        <>
          <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-card">
            <div className="flex flex-wrap items-center gap-3">
              <PlanBadge plan={plan} />
              <StatusBadge status={data.subscriptionStatus} />
            </div>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <Row label="Μηνιαία χρέωση" value={priceLabel(plan)} />
              <Row label="Επόμενη χρέωση" value={formatDate(data.currentPeriodEnd)} />
            </dl>
          </div>

          {data.contractStartDate ? (
            <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-card">
              <h3 className="text-lg font-semibold text-brand-900">Συμβόλαιο</h3>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <Row label="Έναρξη συμβολαίου" value={formatDate(data.contractStartDate)} />
                <Row label="Λήξη συμβολαίου" value={formatDate(data.contractEndDate)} />
              </dl>
              <div className="mt-4 border-t border-brand-200 pt-4">
                {data.earlyExitFee > 0 ? (
                  <p className="flex flex-wrap items-center gap-2 text-sm text-brand-700">
                    <span>
                      Χρέωση πρόωρης αποχώρησης:{' '}
                      <span className="font-semibold text-brand-900">
                        €{data.earlyExitFee.toFixed(2)}
                      </span>
                    </span>
                    <span
                      className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full bg-brand-100 text-brand-500"
                      title={`Αφορά τις εναπομείνασες δόσεις μίσθωσης iPad (€${data.leaseMonthlyWithVAT.toFixed(2)}/μήνα)`}
                      aria-label="Περισσότερες πληροφορίες"
                    >
                      <Info className="h-3 w-3" aria-hidden />
                    </span>
                  </p>
                ) : (
                  <p className="text-sm font-medium text-success-700">
                    Δεν υπάρχει χρέωση πρόωρης αποχώρησης ✓
                  </p>
                )}
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-card">
            <h3 className="text-lg font-semibold text-brand-900">Ενέργειες</h3>
            <div className="mt-4 space-y-3">
              {data.stripeCustomerId ? (
                <button
                  type="button"
                  onClick={() => void onOpenPortal()}
                  disabled={portalLoading}
                  className="rounded-lg border border-brand-300 bg-white px-4 py-2 text-sm font-medium text-brand-800 transition-colors hover:bg-brand-50 disabled:opacity-60"
                >
                  {portalLoading ? 'Φόρτωση...' : 'Ενημέρωση τρόπου πληρωμής'}
                </button>
              ) : null}
              <p className="text-xs text-brand-500">
                Για ακύρωση της συνδρομής, επικοινωνήστε μαζί μας:{' '}
                <a
                  href="mailto:billing@trapeziapp.com"
                  className="font-semibold text-brand-700 underline hover:text-brand-900"
                >
                  billing@trapeziapp.com
                </a>
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
