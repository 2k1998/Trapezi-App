'use client'

import { useEffect, useMemo, useState } from 'react'
import { useOwnerRestaurant } from '@/components/owner/owner-context'
import { ErrorBanner, WarningBanner } from '@/components/owner/menu/Banners'
import { PlanGate } from '@/components/owner/PlanGate'
import { apiGetJson, apiSendJson } from '@/lib/menu/client-api'
import { effectivePlan, planAtLeast, type Plan } from '@/lib/plans/gates'
import type { StaffCredentials } from '@/lib/types/staff'

type StaffRow = {
  id: string
  name: string
  email: string
  role: 'owner' | 'manager' | 'cashier'
  active: boolean
  failed_pin_attempts: number
}

type AddPayload = {
  name: string
  email: string
  role: 'owner' | 'manager' | 'cashier'
  restaurantId: string
}

function roleBadge(role: StaffRow['role']) {
  if (role === 'owner') return 'border-brand-300 bg-brand-100 text-brand-800'
  if (role === 'manager') return 'border-accent-500/40 bg-accent-400/20 text-brand-900'
  return 'border-success-300 bg-success-50 text-success-700'
}

function normalisePlan(plan: string): Plan {
  const p = plan.toLowerCase()
  if (p === 'pro' || p === 'enterprise') return 'pro'
  if (p === 'basic') return 'basic'
  return 'free'
}

export default function OwnerStaffPage() {
  const { restaurantId, plan, subscriptionStatus, dunningDay } = useOwnerRestaurant()
  const currentPlan = normalisePlan(plan)
  const canCreateStaff = planAtLeast(
    effectivePlan(currentPlan, subscriptionStatus, dunningDay),
    'pro'
  )
  const [rows, setRows] = useState<StaffRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'cashier' | 'manager' | 'owner'>('cashier')
  const [credentials, setCredentials] = useState<StaffCredentials | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const roleCounts = useMemo(() => {
    const cashier = rows.filter(r => r.role === 'cashier' && r.active).length
    const manager = rows.filter(r => r.role === 'manager' && r.active).length
    return { cashier, manager }
  }, [rows])

  const loadStaff = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiGetJson<StaffRow[]>(
        `/api/staff?restaurantId=${encodeURIComponent(restaurantId)}`
      )
      setRows(data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load staff')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadStaff()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId])

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setWarning('Copied to clipboard')
    } catch {
      setWarning('Copy failed')
    }
  }

  const createStaff = async () => {
    const payload: AddPayload = {
      name: fullName.trim(),
      email: email.trim(),
      role,
      restaurantId,
    }
    try {
      const result = await apiSendJson<StaffCredentials>('/api/staff', 'POST', payload)
      if (result) {
        setCredentials(result)
      }
      setDrawerOpen(false)
      setFullName('')
      setEmail('')
      setRole('cashier')
      await loadStaff()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create staff')
    }
  }

  const resetPassword = async (row: StaffRow) => {
    if (!window.confirm(`Generate a new password for ${row.name}? Their current password will stop working immediately.`)) return
    try {
      const result = await apiSendJson<{ generated_password: string }>(
        `/api/staff/${row.id}/reset-password`,
        'POST',
        { restaurantId }
      )
      setCredentials({
        staff_id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        generated_password: result?.generated_password ?? '',
        generated_pin: 'unchanged',
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reset password')
    }
  }

  const resetPin = async (row: StaffRow) => {
    try {
      const result = await apiSendJson<{ generated_pin: string }>(
        `/api/staff/${row.id}/reset-pin`,
        'POST',
        { restaurantId }
      )
      setCredentials({
        staff_id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        generated_password: 'unchanged',
        generated_pin: result?.generated_pin ?? '',
      })
      await loadStaff()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reset PIN')
    }
  }

  const toggleActive = async (row: StaffRow) => {
    if (row.active) {
      const confirmed = window.confirm(`This will immediately log out ${row.name}. Continue?`)
      if (!confirmed) return
    }
    try {
      await apiSendJson(`/api/staff/${row.id}`, 'PATCH', {
        restaurantId,
        active: !row.active,
      })
      await loadStaff()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update status')
    }
  }

  const removeStaff = async (row: StaffRow) => {
    const ok = window.confirm(`Remove ${row.name} from your team? Their order history will be preserved.`)
    if (!ok) return
    try {
      await fetch(`/api/staff/${row.id}?restaurantId=${encodeURIComponent(restaurantId)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      await loadStaff()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete staff')
    }
  }

  const disableCashier = roleCounts.cashier >= 1
  const disableManager = roleCounts.manager >= 1

  return (
    <div className="p-4 lg:p-6">
      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}
      {warning ? <WarningBanner message={warning} onDismiss={() => setWarning(null)} /> : null}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-2xl text-brand-900">Staff</h2>
        {canCreateStaff ? (
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
          >
            Add Staff
          </button>
        ) : null}
      </div>

      {!canCreateStaff ? (
        <div className="mb-4">
          <PlanGate
            requiredPlan="pro"
            currentPlan={currentPlan}
            subscriptionStatus={subscriptionStatus}
            dunningDay={dunningDay}
            featureName="Διαχείριση προσωπικού"
          >
            {null}
          </PlanGate>
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-brand-100" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3">
          {rows.map(row => (
            <div key={row.id} className="rounded-xl border border-brand-200 bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-brand-900">{row.name}</p>
                  <p className="text-sm text-brand-600">{row.email}</p>
                  <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs ${roleBadge(row.role)}`}>
                    {row.role}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleActive(row)}
                    className="rounded-lg border border-brand-300 px-3 py-2 text-xs font-medium text-brand-800"
                  >
                    {row.active ? 'Deactivate' : 'Reactivate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void resetPassword(row)}
                    className="rounded-lg border border-brand-300 px-3 py-2 text-xs font-medium text-brand-800"
                  >
                    Reset Password
                  </button>
                  <button
                    type="button"
                    onClick={() => void resetPin(row)}
                    className="rounded-lg border border-brand-300 px-3 py-2 text-xs font-medium text-brand-800"
                  >
                    Reset PIN
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeStaff(row)}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {drawerOpen ? (
        <div className="fixed inset-0 z-[60] flex justify-end bg-brand-900/40">
          <div className="h-full w-full max-w-md border-l border-brand-200 bg-white p-5 shadow-elevated">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-brand-900">Add Staff</h3>
              <button type="button" onClick={() => setDrawerOpen(false)} className="text-sm text-brand-600">
                Close
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm text-brand-700">Full name</label>
                <input
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full rounded-lg border border-brand-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-brand-700">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-brand-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-brand-700">Role</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={disableCashier}
                    title={disableCashier ? 'Only one cashier account is allowed' : undefined}
                    onClick={() => setRole('cashier')}
                    className={`rounded-lg border px-2 py-2 text-sm ${role === 'cashier' ? 'border-brand-800 bg-brand-800 text-white' : 'border-brand-300'} disabled:opacity-50`}
                  >
                    Cashier
                  </button>
                  <button
                    type="button"
                    disabled={disableManager}
                    title={disableManager ? 'Only one manager account is allowed' : undefined}
                    onClick={() => setRole('manager')}
                    className={`rounded-lg border px-2 py-2 text-sm ${role === 'manager' ? 'border-brand-800 bg-brand-800 text-white' : 'border-brand-300'} disabled:opacity-50`}
                  >
                    Manager
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('owner')}
                    className={`rounded-lg border px-2 py-2 text-sm ${role === 'owner' ? 'border-brand-800 bg-brand-800 text-white' : 'border-brand-300'}`}
                  >
                    Owner
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void createStaff()}
                className="w-full rounded-lg bg-brand-800 py-2 text-sm font-medium text-white hover:bg-brand-900"
              >
                Create Staff
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {credentials ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-brand-900/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-brand-200 bg-white p-5 shadow-elevated">
            <h3 className="text-lg font-semibold text-brand-900">Credentials</h3>
            <p className="mt-1 text-sm text-brand-600">
              Save these credentials now. The password cannot be retrieved after closing this window.
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <p><span className="font-medium">Staff:</span> {credentials.name}</p>
              <p><span className="font-medium">Role:</span> {credentials.role}</p>
              <p className="flex items-center gap-2">
                <span className="font-medium">Email:</span> {credentials.email}
                <button type="button" onClick={() => void copyText(credentials.email)} className="text-xs underline">
                  Copy
                </button>
              </p>
              <p className="flex items-center gap-2">
                <span className="font-medium">Password:</span>{' '}
                {showPassword ? credentials.generated_password : '••••••••••'}
                <button type="button" onClick={() => setShowPassword(v => !v)} className="text-xs underline">
                  {showPassword ? 'Hide' : 'Show'}
                </button>
                <button type="button" onClick={() => void copyText(credentials.generated_password)} className="text-xs underline">
                  Copy
                </button>
              </p>
              <p className="flex items-center gap-2 text-lg font-semibold">
                <span className="text-sm font-medium">PIN:</span> {credentials.generated_pin}
                <button type="button" onClick={() => void copyText(credentials.generated_pin)} className="text-xs underline font-normal">
                  Copy
                </button>
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCredentials(null)
                setShowPassword(false)
              }}
              className="mt-5 w-full rounded-lg bg-brand-800 py-2 text-sm font-medium text-white hover:bg-brand-900"
            >
              I have saved the credentials
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
