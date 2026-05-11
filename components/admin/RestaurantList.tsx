'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { el } from 'date-fns/locale'
import { Building2, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { AdminRestaurantSummary } from '@/lib/types/admin'
import { NewRestaurantForm } from '@/components/admin/NewRestaurantForm'

type PlanFilter = 'all' | 'free' | 'basic' | 'pro'
type StatusFilter = 'all' | 'active' | 'past_due' | 'cancelled'

type Props = {
  initialRestaurants: AdminRestaurantSummary[]
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  try {
    return format(new Date(value), 'dd MMM yyyy', { locale: el })
  } catch {
    return '—'
  }
}

function planBadgeClass(plan: string): string {
  if (plan === 'basic') return 'bg-blue-100 text-blue-700'
  if (plan === 'pro') return 'bg-accent-100 text-accent-700'
  return 'bg-brand-100 text-brand-600'
}

function planLabel(plan: string): string {
  if (plan === 'basic') return 'Basic'
  if (plan === 'pro') return 'Pro'
  return 'Free'
}

function statusBadgeClass(status: string): string {
  if (status === 'past_due') return 'bg-amber-100 text-amber-700'
  if (status === 'cancelled') return 'bg-red-100 text-red-700'
  return 'bg-green-100 text-green-700'
}

function statusLabel(status: string): string {
  if (status === 'past_due') return 'Σε καθυστέρηση'
  if (status === 'cancelled') return 'Ακυρωμένο'
  return 'Ενεργό'
}

function FilterPill({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
        active ? 'bg-brand-900 text-white' : 'bg-brand-100 text-brand-700 hover:bg-brand-200'
      }`}
    >
      {label}
    </button>
  )
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={`skeleton-${i}`} className="animate-pulse border-b border-brand-100">
          <td className="px-4 py-4">
            <div className="h-4 w-40 rounded bg-brand-100" />
            <div className="mt-2 h-3 w-28 rounded bg-brand-100" />
          </td>
          {Array.from({ length: 6 }).map((__, index) => (
            <td key={index} className="px-4 py-4">
              <div className="h-4 w-24 rounded bg-brand-100" />
            </td>
          ))}
          <td className="px-4 py-4">
            <div className="h-8 w-20 rounded bg-brand-100" />
          </td>
        </tr>
      ))}
    </>
  )
}

export function RestaurantList({ initialRestaurants }: Props) {
  const router = useRouter()
  const [restaurants, setRestaurants] = useState(initialRestaurants)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState<PlanFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [isNewOpen, setIsNewOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const filtered = useMemo(() => {
    return restaurants.filter((restaurant) => {
      const term = search.trim().toLowerCase()
      const matchesSearch =
        term.length === 0 ||
        restaurant.name.toLowerCase().includes(term) ||
        restaurant.slug.toLowerCase().includes(term)
      const matchesPlan = planFilter === 'all' || restaurant.plan === planFilter
      const matchesStatus = statusFilter === 'all' || restaurant.subscription_status === statusFilter
      return matchesSearch && matchesPlan && matchesStatus
    })
  }, [restaurants, search, planFilter, statusFilter])

  const refreshRestaurants = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/restaurants', { cache: 'no-store' })
      if (!response.ok) throw new Error('Αποτυχία ανανέωσης λίστας')
      const data = (await response.json()) as AdminRestaurantSummary[]
      setRestaurants(data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-2xl text-brand-900">Εστιατόρια</h2>
          <p className="mt-1 text-sm text-brand-500">{restaurants.length} εστιατόρια συνολικά</p>
        </div>
        <button
          type="button"
          onClick={() => setIsNewOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600"
        >
          <Plus className="h-4 w-4" aria-hidden />
          <span>Νέο Εστιατόριο</span>
        </button>
      </div>

      <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-card">
        <div className="flex items-center gap-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Αναζήτηση με όνομα ή slug..."
            className="w-full max-w-lg rounded-lg border border-brand-200 px-3 py-2 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
          <div className="flex gap-2">
            <FilterPill active={planFilter === 'all'} label="All" onClick={() => setPlanFilter('all')} />
            <FilterPill active={planFilter === 'free'} label="Free" onClick={() => setPlanFilter('free')} />
            <FilterPill active={planFilter === 'basic'} label="Basic" onClick={() => setPlanFilter('basic')} />
            <FilterPill active={planFilter === 'pro'} label="Pro" onClick={() => setPlanFilter('pro')} />
          </div>
          <div className="flex gap-2">
            <FilterPill active={statusFilter === 'all'} label="All" onClick={() => setStatusFilter('all')} />
            <FilterPill active={statusFilter === 'active'} label="Active" onClick={() => setStatusFilter('active')} />
            <FilterPill active={statusFilter === 'past_due'} label="Past Due" onClick={() => setStatusFilter('past_due')} />
            <FilterPill active={statusFilter === 'cancelled'} label="Cancelled" onClick={() => setStatusFilter('cancelled')} />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-brand-200 bg-white shadow-card">
        <table className="min-w-full">
          <thead className="border-b border-brand-200 bg-brand-50 text-left text-xs uppercase tracking-wide text-brand-500">
            <tr>
              <th className="px-4 py-3">Εστιατόριο</th>
              <th className="px-4 py-3">Πλάνο</th>
              <th className="px-4 py-3">Κατάσταση</th>
              <th className="px-4 py-3">Επόμενη χρέωση</th>
              <th className="px-4 py-3">Έσοδα (30ημ)</th>
              <th className="px-4 py-3">Παραγγελίες</th>
              <th className="px-4 py-3">Προσωπικό</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? <SkeletonRows /> : null}
            {!loading && filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center">
                    <Building2 className="h-12 w-12 text-brand-200" aria-hidden />
                    <p className="mt-3 text-sm text-brand-500">Δεν βρέθηκαν εστιατόρια</p>
                  </div>
                </td>
              </tr>
            ) : null}
            {!loading &&
              filtered.map((restaurant) => (
                <tr
                  key={restaurant.id}
                  onClick={() => router.push(`/restaurants/${restaurant.id}`)}
                  className="cursor-pointer border-b border-brand-100 transition-colors hover:bg-brand-50"
                >
                  <td className="px-4 py-4">
                    <p className="font-semibold text-brand-900">{restaurant.name}</p>
                    <p className="mt-1 font-mono text-xs text-brand-400">{restaurant.slug}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${planBadgeClass(restaurant.plan)}`}>
                      {planLabel(restaurant.plan)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(restaurant.subscription_status)}`}
                    >
                      {statusLabel(restaurant.subscription_status)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-brand-700">{formatDate(restaurant.current_period_end)}</td>
                  <td className="px-4 py-4 text-sm text-brand-700">€{restaurant.revenue_30d.toFixed(2)}</td>
                  <td className="px-4 py-4 text-sm text-brand-700">{restaurant.orders_count_30d}</td>
                  <td className="px-4 py-4 text-sm text-brand-700">{restaurant.staff_count}</td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        router.push(`/restaurants/${restaurant.id}`)
                      }}
                      className="rounded-lg border border-brand-300 px-3 py-1.5 text-sm text-brand-700 transition-colors hover:bg-brand-50"
                    >
                      Προβολή
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <NewRestaurantForm
        open={isNewOpen}
        onClose={() => setIsNewOpen(false)}
        onCreated={async () => {
          await refreshRestaurants()
          router.refresh()
        }}
      />
    </div>
  )
}
