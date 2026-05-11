'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { el } from 'date-fns/locale'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { AdminRestaurantDetail, AdminTable } from '@/lib/types/admin'
import { earlyExitFee } from '@/lib/billing/lease'

type Props = {
  detail: AdminRestaurantDetail
}

type TabKey = 'overview' | 'staff' | 'menu' | 'tables' | 'orders' | 'branding'

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

function roleBadgeClass(role: string): string {
  if (role === 'manager') return 'bg-purple-100 text-purple-700'
  if (role === 'cashier') return 'bg-blue-100 text-blue-700'
  if (role === 'admin') return 'bg-red-100 text-red-700'
  return 'bg-brand-100 text-brand-700'
}

function groupBySection(tables: AdminTable[], sections: AdminRestaurantDetail['sections']) {
  const sectionMap = new Map(sections.map((section) => [section.id, section]))
  const grouped = new Map<string, { name: string; displayOrder: number; tables: AdminTable[] }>()

  for (const table of tables) {
    const section = table.section_id ? sectionMap.get(table.section_id) : null
    const key = section?.id ?? 'unassigned'
    const current = grouped.get(key) ?? {
      name: section?.name ?? 'Χωρίς ενότητα',
      displayOrder: section?.display_order ?? 9999,
      tables: [],
    }
    current.tables.push(table)
    grouped.set(key, current)
  }

  return Array.from(grouped.values()).sort((a, b) => a.displayOrder - b.displayOrder)
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Επισκόπηση' },
  { key: 'staff', label: 'Προσωπικό' },
  { key: 'menu', label: 'Μενού' },
  { key: 'tables', label: 'Τραπέζια' },
  { key: 'orders', label: 'Παραγγελίες' },
  { key: 'branding', label: 'Branding' },
]

export function RestaurantDetail({ detail }: Props) {
  const { restaurant } = detail
  const [tab, setTab] = useState<TabKey>('overview')
  const [categoriesOpen, setCategoriesOpen] = useState(true)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})

  const groupedTables = useMemo(() => groupBySection(detail.tables, detail.sections), [detail.tables, detail.sections])
  const printers =
    ((restaurant.metadata as Record<string, unknown> | null)?.printers as Array<{ ip?: string; name?: string }> | undefined) ??
    []
  const branding = ((restaurant.metadata as Record<string, unknown> | null)?.branding as Record<string, string | null> | undefined) ?? {}
  const contractStart = restaurant.contract_start_date ? new Date(restaurant.contract_start_date) : null
  const exitFee = contractStart ? earlyExitFee(contractStart) : 0

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/restaurants" className="text-sm text-brand-600 hover:text-brand-900">
            ← Εστιατόρια
          </Link>
          <h2 className="mt-2 font-display text-2xl text-brand-900">{restaurant.name}</h2>
          <div className="mt-2 flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${planBadgeClass(restaurant.plan)}`}>
              {restaurant.plan.toUpperCase()}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(restaurant.subscription_status)}`}>
              {statusLabel(restaurant.subscription_status)}
            </span>
          </div>
        </div>
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-lg bg-brand-200 px-4 py-2 text-sm text-brand-600 opacity-50"
        >
          Επεξεργασία
        </button>
      </div>

      <div className="border-b border-brand-200">
        <div className="flex gap-2">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`rounded-t-lg px-3 py-2 text-sm ${
                tab === item.key
                  ? 'border-b-2 border-accent-500 font-semibold text-brand-900'
                  : 'text-brand-500 hover:text-brand-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-card">
            <h3 className="mb-3 font-semibold text-brand-900">Βασικές πληροφορίες</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-brand-500">Όνομα</dt>
                <dd className="text-brand-900">{restaurant.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-brand-500">Slug</dt>
                <dd className="font-mono text-brand-900">{restaurant.slug}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-brand-500">Δημιουργία</dt>
                <dd className="text-brand-900">{formatDate(restaurant.created_at)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-brand-500">Customer URL</dt>
                <dd>
                  <a className="text-accent-600 hover:underline" href={`https://trapeziapp.com/${restaurant.slug}`} target="_blank" rel="noreferrer">
                    trapeziapp.com/{restaurant.slug}
                  </a>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-brand-500">Login URL</dt>
                <dd>
                  <a className="text-accent-600 hover:underline" href={`https://trapeziapp.com/${restaurant.slug}/login`} target="_blank" rel="noreferrer">
                    trapeziapp.com/{restaurant.slug}/login
                  </a>
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-card">
            <h3 className="mb-3 font-semibold text-brand-900">Συνδρομή</h3>
            <div className="mb-3 flex gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${planBadgeClass(restaurant.plan)}`}>
                {restaurant.plan.toUpperCase()}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(restaurant.subscription_status)}`}>
                {statusLabel(restaurant.subscription_status)}
              </span>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-brand-500">Επόμενη χρέωση</dt>
                <dd className="text-brand-900">{formatDate(restaurant.current_period_end)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-brand-500">Συμβόλαιο</dt>
                <dd className="text-brand-900">
                  {formatDate(restaurant.contract_start_date)} →{' '}
                  {restaurant.contract_start_date
                    ? formatDate(new Date(new Date(restaurant.contract_start_date).setFullYear(new Date(restaurant.contract_start_date).getFullYear() + 1)).toISOString())
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-brand-500">Early exit fee</dt>
                <dd className="text-brand-900">€{exitFee.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-brand-500">Stripe customer</dt>
                <dd className="text-right">
                  {restaurant.stripe_customer_id ? (
                    <a
                      className="font-mono text-xs text-accent-600 hover:underline"
                      href={`https://dashboard.stripe.com/customers/${restaurant.stripe_customer_id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {restaurant.stripe_customer_id}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-brand-500">Stripe subscription</dt>
                <dd className="text-right">
                  {restaurant.stripe_subscription_id ? (
                    <a
                      className="font-mono text-xs text-accent-600 hover:underline"
                      href={`https://dashboard.stripe.com/subscriptions/${restaurant.stripe_subscription_id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {restaurant.stripe_subscription_id}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-card">
            <h3 className="mb-3 font-semibold text-brand-900">Εκτυπωτές</h3>
            {printers.length === 0 ? (
              <p className="text-sm text-brand-500">Δεν έχουν οριστεί εκτυπωτές</p>
            ) : (
              <ul className="space-y-1 text-sm text-brand-700">
                {printers.map((printer, index) => (
                  <li key={`${printer.ip ?? 'ip'}-${index}`}>{printer.ip ?? '—'}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-card">
            <h3 className="mb-3 font-semibold text-brand-900">Στατιστικά</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-brand-500">Προσωπικό</dt>
                <dd>{restaurant.staff_count}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-brand-500">Menu items</dt>
                <dd>{restaurant.menu_items_count}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-brand-500">Τραπέζια</dt>
                <dd>{restaurant.tables_count}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-brand-500">Παραγγελίες 30ημ</dt>
                <dd>{restaurant.orders_count_30d}</dd>
              </div>
            </dl>
          </div>
        </div>
      ) : null}

      {tab === 'staff' ? (
        <div className="overflow-hidden rounded-xl border border-brand-200 bg-white shadow-card">
          <table className="min-w-full">
            <thead className="border-b border-brand-200 bg-brand-50 text-left text-xs uppercase tracking-wide text-brand-500">
              <tr>
                <th className="px-4 py-3">Όνομα</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Ρόλος</th>
                <th className="px-4 py-3">PIN</th>
                <th className="px-4 py-3">Δημιουργία</th>
              </tr>
            </thead>
            <tbody>
              {detail.staff.map((staff) => (
                <tr key={staff.id} className={`border-b border-brand-100 ${staff.deleted_at ? 'opacity-50 line-through' : ''}`}>
                  <td className="px-4 py-3 text-sm text-brand-900">{staff.display_name}</td>
                  <td className="px-4 py-3 text-sm text-brand-700">{staff.email}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${roleBadgeClass(staff.role)}`}>
                      {staff.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-brand-700">{staff.pin_hash ? '✓ set' : '✗ not set'}</td>
                  <td className="px-4 py-3 text-sm text-brand-700">{formatDate(staff.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === 'menu' ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-card">
            <button
              type="button"
              onClick={() => setCategoriesOpen((prev) => !prev)}
              className="flex w-full items-center justify-between text-left"
            >
              <h3 className="font-semibold text-brand-900">Categories</h3>
              {categoriesOpen ? <ChevronUp className="h-4 w-4 text-brand-500" /> : <ChevronDown className="h-4 w-4 text-brand-500" />}
            </button>
            {categoriesOpen ? (
              <ul className="mt-3 space-y-2">
                {detail.categories.map((category) => {
                  const count = detail.menu_items.filter((item) => item.category_id === category.id).length
                  return (
                    <li key={category.id} className="flex items-center justify-between text-sm">
                      <span className="text-brand-900">
                        {category.name_el} / {category.name_en ?? '—'}
                      </span>
                      <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-700">{count}</span>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-xl border border-brand-200 bg-white shadow-card">
            <table className="min-w-full">
              <thead className="border-b border-brand-200 bg-brand-50 text-left text-xs uppercase tracking-wide text-brand-500">
                <tr>
                  <th className="px-4 py-3">name_el</th>
                  <th className="px-4 py-3">name_en</th>
                  <th className="px-4 py-3">price</th>
                  <th className="px-4 py-3">type</th>
                  <th className="px-4 py-3">available</th>
                  <th className="px-4 py-3">deleted</th>
                </tr>
              </thead>
              <tbody>
                {detail.menu_items.map((item) => (
                  <tr key={item.id} className="border-b border-brand-100">
                    <td className="px-4 py-3 text-sm text-brand-900">{item.name_el}</td>
                    <td className="px-4 py-3 text-sm text-brand-700">{item.name_en ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-brand-700">€{item.price.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-brand-700">{item.type}</td>
                    <td className="px-4 py-3 text-sm text-brand-700">{item.available ? '✓' : '✗'}</td>
                    <td className="px-4 py-3 text-sm text-brand-700">
                      {item.deleted_at ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Διαγραμμένο</span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === 'tables' ? (
        <div className="space-y-3">
          {groupedTables.map((group) => (
            <div key={group.name} className="rounded-xl border border-brand-200 bg-white shadow-card">
              <button
                type="button"
                onClick={() => setOpenSections((prev) => ({ ...prev, [group.name]: !prev[group.name] }))}
                className="flex w-full items-center justify-between px-4 py-3"
              >
                <h3 className="font-semibold text-brand-900">{group.name}</h3>
                {openSections[group.name] === false ? (
                  <ChevronDown className="h-4 w-4 text-brand-500" />
                ) : (
                  <ChevronUp className="h-4 w-4 text-brand-500" />
                )}
              </button>

              {openSections[group.name] === false ? null : (
                <div className="overflow-hidden border-t border-brand-200">
                  <table className="min-w-full">
                    <thead className="border-b border-brand-100 bg-brand-50 text-left text-xs uppercase tracking-wide text-brand-500">
                      <tr>
                        <th className="px-4 py-2">number</th>
                        <th className="px-4 py-2">name</th>
                        <th className="px-4 py-2">capacity</th>
                        <th className="px-4 py-2">section</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.tables.map((table) => (
                        <tr key={table.id} className={`border-b border-brand-100 ${table.deleted_at ? 'opacity-50 line-through' : ''}`}>
                          <td className="px-4 py-2 text-sm text-brand-900">{table.number}</td>
                          <td className="px-4 py-2 text-sm text-brand-700">{table.name ?? '—'}</td>
                          <td className="px-4 py-2 text-sm text-brand-700">{table.capacity ?? '—'}</td>
                          <td className="px-4 py-2 text-sm text-brand-700">{group.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {tab === 'orders' ? (
        <div className="space-y-3">
          {detail.recent_orders.map((order) => (
            <article key={order.id} className="rounded-xl border border-brand-200 bg-white p-4 shadow-card">
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <p className="text-sm text-brand-700">
                    Τραπέζι {order.table_number ?? '—'} • {order.customer_name ?? 'Χωρίς όνομα'}
                  </p>
                  <p className="text-xs text-brand-500">{formatDate(order.created_at)}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(order.status)}`}>
                  {order.status}
                </span>
              </div>
              <ul className="space-y-1 text-sm text-brand-700">
                {order.items.map((item) => (
                  <li key={item.id}>
                    {item.name_snapshot} × {item.quantity}
                  </li>
                ))}
              </ul>
              <p className="mt-2 font-semibold text-brand-900">Σύνολο: €{order.total.toFixed(2)}</p>
            </article>
          ))}
        </div>
      ) : null}

      {tab === 'branding' ? (
        <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-card">
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-brand-500">Accent color</dt>
              <dd className="flex items-center gap-2 text-brand-900">
                <span
                  className="h-8 w-8 rounded-full border border-brand-300 bg-white"
                  style={branding.accent_color ? { backgroundColor: branding.accent_color } : undefined}
                />
                {branding.accent_color ?? '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-brand-500">Secondary color</dt>
              <dd className="flex items-center gap-2 text-brand-900">
                <span
                  className="h-8 w-8 rounded-full border border-brand-300 bg-white"
                  style={branding.secondary_color ? { backgroundColor: branding.secondary_color } : undefined}
                />
                {branding.secondary_color ?? '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-brand-500">Logo</dt>
              <dd>
                {branding.logo_url ? (
                  <img src={branding.logo_url} alt="Logo" className="h-10 w-auto object-contain" />
                ) : (
                  <span className="text-brand-700">Δεν έχει οριστεί</span>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-brand-500">Font</dt>
              <dd className="text-brand-900">{branding.font ?? 'Default'}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-brand-500">Confirmation message</dt>
              <dd className="text-right text-brand-900">
                <p>EN: {branding.confirmation_message_en ?? '—'}</p>
                <p>EL: {branding.confirmation_message_el ?? '—'}</p>
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  )
}
