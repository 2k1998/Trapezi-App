'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Copy, Plus, X } from 'lucide-react'
import type { NewRestaurantResult } from '@/lib/types/admin'
import type { Plan } from '@/lib/types/billing'

type Props = {
  open: boolean
  onClose: () => void
  onCreated: () => Promise<void> | void
}

type FieldErrors = {
  name?: string
  slug?: string
  ownerEmail?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function NewRestaurantForm({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [plan, setPlan] = useState<Plan>('free')
  const [printerIps, setPrinterIps] = useState<string[]>([''])
  const [errors, setErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [created, setCreated] = useState<NewRestaurantResult | null>(null)
  const [createdName, setCreatedName] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    setSubmitError(null)
    setCopied(false)
  }, [open])

  const slugPreview = useMemo(() => `trapeziapp.com/${slug || 'slug'}`, [slug])

  const validate = (): boolean => {
    const next: FieldErrors = {}
    if (!name.trim()) next.name = 'Το όνομα είναι υποχρεωτικό.'
    if (!slug.trim()) next.slug = 'Το slug είναι υποχρεωτικό.'
    else if (!/^[a-z0-9-]+$/.test(slug)) next.slug = 'Το slug επιτρέπει μόνο πεζά, αριθμούς και παύλες.'
    if (!ownerEmail.trim()) next.ownerEmail = 'Το email είναι υποχρεωτικό.'
    else if (!EMAIL_RE.test(ownerEmail.trim())) next.ownerEmail = 'Μη έγκυρο email.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const resetForm = () => {
    setName('')
    setSlug('')
    setOwnerEmail('')
    setPlan('free')
    setPrinterIps([''])
    setErrors({})
    setSubmitError(null)
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading || !validate()) return

    setLoading(true)
    setSubmitError(null)

    try {
      const response = await fetch('/api/admin/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          owner_email: ownerEmail.trim().toLowerCase(),
          plan,
          printer_ips: printerIps.map((ip) => ip.trim()).filter(Boolean),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error ?? 'Αποτυχία δημιουργίας εστιατορίου.')
      }

      setCreated(data as NewRestaurantResult)
      setCreatedName(name.trim())
      await onCreated()
      resetForm()
      onClose()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Αποτυχία δημιουργίας εστιατορίου.')
    } finally {
      setLoading(false)
    }
  }

  const copyPassword = async () => {
    if (!created) return
    await navigator.clipboard.writeText(created.generated_password)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-40 bg-brand-950/30" onClick={onClose} aria-hidden />
      ) : null}

      <aside
        className={`fixed inset-y-0 right-0 z-50 w-[480px] border-l border-brand-200 bg-white shadow-elevated transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-brand-200 px-5 py-4">
            <h3 className="font-display text-xl text-brand-900">Νέο Εστιατόριο</h3>
            <button type="button" onClick={onClose} className="text-brand-500 hover:text-brand-800">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <form id="new-restaurant-form" onSubmit={submit} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-700">Όνομα εστιατορίου</label>
              <input
                value={name}
                onChange={(event) => {
                  const nextName = event.target.value
                  setName(nextName)
                  if (!slug) setSlug(slugify(nextName))
                }}
                className="w-full rounded-lg border border-brand-200 px-3 py-2 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
              {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name}</p> : null}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-brand-700">Slug</label>
              <input
                value={slug}
                onChange={(event) => setSlug(slugify(event.target.value))}
                className="w-full rounded-lg border border-brand-200 px-3 py-2 font-mono text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
              <p className="mt-1 text-xs text-brand-500">{slugPreview}</p>
              {errors.slug ? <p className="mt-1 text-xs text-red-600">{errors.slug}</p> : null}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-brand-700">Owner email</label>
              <input
                type="email"
                value={ownerEmail}
                onChange={(event) => setOwnerEmail(event.target.value)}
                className="w-full rounded-lg border border-brand-200 px-3 py-2 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
              {errors.ownerEmail ? <p className="mt-1 text-xs text-red-600">{errors.ownerEmail}</p> : null}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-brand-700">Πλάνο</label>
              <select
                value={plan}
                onChange={(event) => setPlan(event.target.value as Plan)}
                className="w-full rounded-lg border border-brand-200 px-3 py-2 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-accent-500"
              >
                <option value="free">Free</option>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
              </select>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-medium text-brand-700">Printer IPs</label>
                <button
                  type="button"
                  onClick={() => setPrinterIps((prev) => [...prev, ''])}
                  className="inline-flex items-center gap-1 text-sm text-accent-600 hover:text-accent-700"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Προσθήκη εκτυπωτή
                </button>
              </div>
              <div className="space-y-2">
                {printerIps.map((ip, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      value={ip}
                      onChange={(event) =>
                        setPrinterIps((prev) => prev.map((item, i) => (i === index ? event.target.value : item)))
                      }
                      placeholder="192.168.1.50"
                      className="w-full rounded-lg border border-brand-200 px-3 py-2 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-accent-500"
                    />
                    <button
                      type="button"
                      onClick={() => setPrinterIps((prev) => prev.filter((_, i) => i !== index))}
                      className="rounded-lg p-2 text-brand-500 hover:bg-brand-100 hover:text-brand-700"
                      disabled={printerIps.length === 1}
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {submitError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {submitError}
              </div>
            ) : null}
          </form>

          <div className="border-t border-brand-200 p-5">
            <button
              type="button"
              onClick={onClose}
              className="mr-2 rounded-lg border border-brand-300 px-4 py-2 text-sm text-brand-700 hover:bg-brand-50"
            >
              Ακύρωση
            </button>
            <button
              type="submit"
              form="new-restaurant-form"
              className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-60"
              disabled={loading}
            >
              {loading ? 'Δημιουργία...' : 'Δημιουργία'}
            </button>
          </div>
        </div>
      </aside>

      {created ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-brand-950/40 p-4">
          <div className="w-full max-w-xl rounded-xl border border-brand-200 bg-white p-6 shadow-elevated">
            <div className="mb-4 flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" aria-hidden />
              <h4 className="text-lg font-semibold">Εστιατόριο δημιουργήθηκε!</h4>
            </div>

            <div className="space-y-1 text-sm text-brand-700">
              <p>Εστιατόριο: {createdName}</p>
              <p>URL: trapeziapp.com/{created.slug}</p>
              <p>Login: trapeziapp.com/{created.slug}/login</p>
              <p>Owner: {created.owner_email}</p>
            </div>

            <p className="mt-4 text-sm text-brand-900">Κωδικός πρόσβασης (εμφανίζεται μόνο μία φορά):</p>
            <div className="mt-2 flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 p-3">
              <code className="font-mono text-sm text-brand-900">{created.generated_password}</code>
              <button
                type="button"
                onClick={() => void copyPassword()}
                className="inline-flex items-center gap-1 rounded-md border border-brand-300 px-2.5 py-1 text-xs text-brand-700 hover:bg-white"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden />
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="mt-2 text-xs text-red-600">⚠️ Αποθηκεύστε τον κωδικό — δεν θα εμφανιστεί ξανά.</p>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setCreated(null)}
                className="rounded-lg bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-950"
              >
                Κλείσιμο
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
