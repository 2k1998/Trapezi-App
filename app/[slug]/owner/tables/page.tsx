'use client'

import { useEffect, useMemo, useState } from 'react'
import { useOwnerRestaurant } from '@/components/owner/owner-context'
import { ErrorBanner, WarningBanner } from '@/components/owner/menu/Banners'
import { PlanGateAuto } from '@/components/owner/PlanGate'
import { apiGetJson, apiSendJson } from '@/lib/menu/client-api'
import type { Section, TableRow } from '@/lib/types/staff'

type TableApiRow = TableRow & { section_name?: string | null }

export default function OwnerTablesPage() {
  const { restaurantId, plan } = useOwnerRestaurant()
  const isPro = plan === 'pro' || plan === 'enterprise'
  const [rows, setRows] = useState<TableApiRow[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<TableApiRow | null>(null)
  const [number, setNumber] = useState('')
  const [name, setName] = useState('')
  const [capacity, setCapacity] = useState('')
  const [sectionId, setSectionId] = useState<string>('none')
  const [newSectionName, setNewSectionName] = useState('')

  const loadAll = async () => {
    setError(null)
    try {
      const [tablesData, sectionsData] = await Promise.all([
        apiGetJson<TableApiRow[]>(`/api/tables?restaurantId=${encodeURIComponent(restaurantId)}`),
        apiGetJson<Section[]>(`/api/sections?restaurantId=${encodeURIComponent(restaurantId)}`),
      ])
      setRows(tablesData ?? [])
      setSections(sectionsData ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tables')
    }
  }

  useEffect(() => {
    void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId])

  const openCreate = () => {
    setEditing(null)
    setNumber('')
    setName('')
    setCapacity('')
    setSectionId('none')
    setDrawerOpen(true)
  }

  const openEdit = (row: TableApiRow) => {
    setEditing(row)
    setNumber(String(row.number))
    setName(row.name ?? '')
    setCapacity(row.capacity ? String(row.capacity) : '')
    setSectionId(row.section_id ?? 'none')
    setDrawerOpen(true)
  }

  const saveTable = async () => {
    const payload = {
      restaurantId,
      number: Number(number),
      name: name || null,
      capacity: capacity ? Number(capacity) : null,
      section_id: isPro && sectionId !== 'none' ? sectionId : null,
    }
    try {
      if (editing) {
        await apiSendJson(`/api/tables/${editing.id}`, 'PATCH', payload)
      } else {
        await apiSendJson('/api/tables', 'POST', payload)
      }
      setDrawerOpen(false)
      await loadAll()
      setSuccess('Table saved')
      window.setTimeout(() => setSuccess(null), 1200)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save table'
      setError(msg.includes('TABLE_NUMBER_EXISTS') ? 'Table number already exists.' : msg)
    }
  }

  const deleteTable = async (row: TableApiRow) => {
    if (!window.confirm(`Delete table ${row.number}?`)) return
    try {
      const res = await fetch(`/api/tables/${row.id}?restaurantId=${encodeURIComponent(restaurantId)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        if (data.error === 'TABLE_HAS_OPEN_TAB') {
          setError('This table has an open tab. Close the tab on the cashier screen before deleting.')
        } else {
          setError(data.error ?? 'Failed to delete table')
        }
        return
      }
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete table')
    }
  }

  const groupedSections = useMemo(() => {
    const counts = new Map<string, number>()
    rows.forEach(r => {
      if (r.section_id) counts.set(r.section_id, (counts.get(r.section_id) ?? 0) + 1)
    })
    return counts
  }, [rows])

  const addSection = async () => {
    if (!newSectionName.trim()) return
    try {
      await apiSendJson('/api/sections', 'POST', { name: newSectionName.trim(), restaurantId })
      setNewSectionName('')
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add section')
    }
  }

  const renameSection = async (sec: Section) => {
    const nextName = window.prompt('Edit section name', sec.name)
    if (!nextName) return
    try {
      await apiSendJson(`/api/sections/${sec.id}`, 'PATCH', { restaurantId, name: nextName })
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update section')
    }
  }

  const deleteSection = async (sec: Section) => {
    const ok = window.confirm('Tables in this section will become unassigned. Continue?')
    if (!ok) return
    try {
      await fetch(`/api/sections/${sec.id}?restaurantId=${encodeURIComponent(restaurantId)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete section')
    }
  }

  return (
    <div className="p-4 lg:p-6">
      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}
      {success ? <WarningBanner message={success} onDismiss={() => setSuccess(null)} /> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-brand-200 bg-white p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-2xl text-brand-900">Tables</h2>
            <button
              type="button"
              onClick={openCreate}
              className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
            >
              Add Table
            </button>
          </div>
          <div className="space-y-2">
            {rows.map(row => (
              <div key={row.id} className="grid grid-cols-8 items-center rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm">
                <div>{row.number}</div>
                <div>{row.name ?? '—'}</div>
                <div>{row.capacity ?? '—'}</div>
                <div>{row.section_name ?? '—'}</div>
                <div>{row.status}</div>
                <div className="col-span-3 flex justify-end gap-2">
                  <button type="button" onClick={() => openEdit(row)} className="rounded border border-brand-300 px-2 py-1 text-xs">
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteTable(row)}
                    className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {isPro ? (
          <PlanGateAuto requiredPlan="pro" featureName="Τμήματα τραπεζιών">
            <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-card">
              <h3 className="mb-3 text-lg font-semibold text-brand-900">Sections</h3>
              <div className="mb-3 flex gap-2">
                <input
                  value={newSectionName}
                  onChange={e => setNewSectionName(e.target.value)}
                  className="flex-1 rounded-lg border border-brand-300 px-3 py-2 text-sm"
                  placeholder="Section name"
                />
                <button
                  type="button"
                  onClick={() => void addSection()}
                  className="rounded-lg bg-brand-800 px-3 py-2 text-sm text-white"
                >
                  Save
                </button>
              </div>
              <div className="space-y-2">
                {sections.map(sec => (
                  <div key={sec.id} className="rounded-lg border border-brand-200 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-brand-900">
                        {sec.name} ({groupedSections.get(sec.id) ?? 0})
                      </p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => void renameSection(sec)} className="text-xs underline text-brand-700">
                          Edit
                        </button>
                        <button type="button" onClick={() => void deleteSection(sec)} className="text-xs underline text-red-700">
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </PlanGateAuto>
        ) : null}
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-[60] flex justify-end bg-brand-900/40">
          <div className="h-full w-full max-w-md border-l border-brand-200 bg-white p-5 shadow-elevated">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-brand-900">
                {editing ? 'Edit Table' : 'Add Table'}
              </h3>
              <button type="button" onClick={() => setDrawerOpen(false)} className="text-sm text-brand-600">
                Close
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm text-brand-700">Number</label>
                <input
                  type="number"
                  value={number}
                  onChange={e => setNumber(e.target.value)}
                  className="w-full rounded-lg border border-brand-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-brand-700">Name</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full rounded-lg border border-brand-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-brand-700">Capacity</label>
                <input
                  type="number"
                  value={capacity}
                  onChange={e => setCapacity(e.target.value)}
                  className="w-full rounded-lg border border-brand-300 px-3 py-2 text-sm"
                />
              </div>
              {isPro ? (
                <div>
                  <label className="mb-1 block text-sm text-brand-700">Section</label>
                  <select
                    value={sectionId}
                    onChange={e => setSectionId(e.target.value)}
                    className="w-full rounded-lg border border-brand-300 px-3 py-2 text-sm"
                  >
                    <option value="none">No section</option>
                    {sections.map(sec => (
                      <option key={sec.id} value={sec.id}>
                        {sec.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => void saveTable()}
                className="w-full rounded-lg bg-brand-800 py-2 text-sm font-medium text-white hover:bg-brand-900"
              >
                Save Table
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
