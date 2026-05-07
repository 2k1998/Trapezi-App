'use client'

import { useEffect, useMemo, useState } from 'react'
import { useOwnerRestaurant } from '@/components/owner/owner-context'
import { useOwnerBranding } from '@/components/owner/owner-branding-context'
import { ErrorBanner, WarningBanner } from '@/components/owner/menu/Banners'
import { apiGetJson, apiSendJson } from '@/lib/menu/client-api'
import type { BrandingSettings, PrinterSettings, SecuritySettings } from '@/lib/types/staff'

type Tab = 'branding' | 'printers' | 'security' | 'onboarding'

const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/
const fonts = ['Inter', 'Playfair Display', 'Lora', 'Montserrat', 'Raleway'] as const
const FONT_HREF_MAP: Record<string, string> = {
  Inter: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'Playfair Display': 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap',
  Lora: 'https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&display=swap',
  Montserrat: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap',
  Raleway: 'https://fonts.googleapis.com/css2?family=Raleway:wght@400;500;600;700&display=swap',
}
const MAX_LOGO_BYTES = 2 * 1024 * 1024
const ALLOWED_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const onboardingSteps = [
  {
    title: 'Mount and power the iPad',
    body: 'Place the iPad at the cashier station, connect power, and disable auto-lock.',
  },
  {
    title: 'Open cashier URL',
    body: 'Open the cashier URL below in Safari and pin it for daily use.',
  },
  {
    title: 'Install QZ Tray',
    body: 'Install and run QZ Tray on the cashier iPad for direct printer communication.',
  },
  {
    title: 'Connect printers',
    body: 'Verify Kitchen, Bar, and Cashier printer IP addresses are saved in settings.',
  },
  {
    title: 'Run service test',
    body: 'Place a test order and confirm all role-specific printouts work correctly.',
  },
]

export default function OwnerSettingsPage() {
  const { restaurantId, plan, slug } = useOwnerRestaurant()
  const { branding: layoutBranding, setBranding: setLayoutBranding } = useOwnerBranding()
  const isPro = plan === 'pro' || plan === 'enterprise'
  const [tab, setTab] = useState<Tab>('branding')
  const [branding, setBranding] = useState<BrandingSettings | null>(null)
  const [printers, setPrinters] = useState<PrinterSettings | null>(null)
  const [security, setSecurity] = useState<SecuritySettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [tests, setTests] = useState<Record<'kitchen' | 'bar' | 'cashier', 'idle' | 'ok' | 'fail'>>({
    kitchen: 'idle',
    bar: 'idle',
    cashier: 'idle',
  })
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const onboardingKey = `trapezi-onboarding-${slug}`

  const previewFontClass = useMemo(() => {
    const f = branding?.font ?? 'Inter'
    if (f === 'Playfair Display') return 'font-display'
    return 'font-sans'
  }, [branding?.font])

  const accent = branding?.accent_color || '#1D6FBF'
  const secondary = branding?.secondary_color || '#6B6860'
  const luminance = useMemo(() => {
    const hex = accent.replace('#', '')
    if (hex.length !== 6) return 0.6
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255
  }, [accent])
  const navTextColor = luminance < 0.6 ? '#ffffff' : '#0F0E0D'

  const loadSettings = async () => {
    setError(null)
    try {
      const brandingPromise = layoutBranding
        ? Promise.resolve(layoutBranding)
        : apiGetJson<BrandingSettings>(`/api/settings/branding?restaurantId=${encodeURIComponent(restaurantId)}`)
      const [b, p, s] = await Promise.all([
        brandingPromise,
        apiGetJson<PrinterSettings>(`/api/settings/printers?restaurantId=${encodeURIComponent(restaurantId)}`),
        apiGetJson<SecuritySettings>(`/api/settings/security?restaurantId=${encodeURIComponent(restaurantId)}`),
      ])
      setBranding(b)
      setLayoutBranding(b)
      setPrinters(p)
      setSecurity(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings')
    }
  }

  useEffect(() => {
    void loadSettings()
    try {
      const raw = localStorage.getItem(onboardingKey)
      if (raw) setCompletedSteps(JSON.parse(raw) as number[])
    } catch {
      setCompletedSteps([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, onboardingKey])

  const showSuccess = (msg: string) => {
    setSuccess(msg)
    window.setTimeout(() => setSuccess(null), 1800)
  }

  const saveBranding = async () => {
    if (!branding) return
    try {
      await apiSendJson('/api/settings/branding', 'PATCH', { restaurantId, ...branding })
      setLayoutBranding(branding)
      showSuccess('Branding saved')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save branding')
    }
  }

  const uploadLogo = async (file: File) => {
    if (!branding) return
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setError('Logo must be JPG, PNG, or WEBP.')
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError('Logo must be 2MB or smaller.')
      return
    }

    setUploadingLogo(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('logo', file)
      formData.append('restaurantId', restaurantId)
      const res = await fetch('/api/settings/branding/logo', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Failed to upload logo')
      }
      const data = (await res.json()) as {
        logo_url?: string
        accent_color?: string
        secondary_color?: string | null
        colors_extracted?: boolean
      }
      if (!data.logo_url) throw new Error('Missing logo URL in upload response')
      setBranding(prev => {
        if (!prev) return prev
        return {
          ...prev,
          logo_url: data.logo_url ?? null,
          ...(data.colors_extracted && data.accent_color && { accent_color: data.accent_color }),
          ...(data.colors_extracted && data.secondary_color && { secondary_color: data.secondary_color }),
        }
      })
      setLayoutBranding((prev: typeof layoutBranding) => {
        if (!prev) return prev
        return {
          ...prev,
          logo_url: data.logo_url ?? null,
          ...(data.colors_extracted && data.accent_color && { accent_color: data.accent_color }),
          ...(data.colors_extracted && data.secondary_color && { secondary_color: data.secondary_color }),
        }
      })
      if (data.colors_extracted) {
        showSuccess('Logo uploaded — colors extracted from your logo. Feel free to adjust them.')
      } else {
        showSuccess('Logo uploaded')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to upload logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  const removeLogo = async () => {
    if (!branding) return
    try {
      await apiSendJson('/api/settings/branding', 'PATCH', { restaurantId, logo_url: null })
      setBranding(prev => (prev ? { ...prev, logo_url: null } : prev))
      setLayoutBranding(prev => (prev ? { ...prev, logo_url: null } : prev))
      showSuccess('Logo removed')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove logo')
    }
  }

  const savePrinters = async () => {
    if (!printers) return
    for (const ip of [printers.kitchen, printers.bar, printers.cashier]) {
      if (ip && !IPV4.test(ip)) {
        setError('Invalid IPv4 address')
        return
      }
    }
    try {
      await apiSendJson('/api/settings/printers', 'PATCH', { restaurantId, ...printers })
      showSuccess('Printer settings saved')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save printers')
    }
  }

  const saveSecurity = async () => {
    if (!security) return
    try {
      await apiSendJson('/api/settings/security', 'PATCH', {
        restaurantId,
        inactivity_timeout_minutes: security.inactivity_timeout_minutes,
      })
      showSuccess('Security settings saved')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save security')
    }
  }

  const testPrinter = async (key: 'kitchen' | 'bar' | 'cashier') => {
    const ip = printers?.[key]
    if (!ip) return
    try {
      const controller = new AbortController()
      const id = window.setTimeout(() => controller.abort(), 3000)
      await fetch(`http://${ip}`, { mode: 'no-cors', signal: controller.signal })
      window.clearTimeout(id)
      setTests(prev => ({ ...prev, [key]: 'ok' }))
    } catch {
      setTests(prev => ({ ...prev, [key]: 'fail' }))
    }
  }

  const toggleStep = (idx: number) => {
    const next = completedSteps.includes(idx)
      ? completedSteps.filter(i => i !== idx)
      : [...completedSteps, idx]
    setCompletedSteps(next)
    localStorage.setItem(onboardingKey, JSON.stringify(next))
  }

  const resetChecklist = () => {
    localStorage.removeItem(onboardingKey)
    setCompletedSteps([])
  }

  const tabBtn = (id: Tab, label: string) => (
    <button
      type="button"
      key={id}
      onClick={() => setTab(id)}
      className={`rounded-lg px-4 py-2 text-sm font-medium ${
        tab === id ? 'bg-brand-800 text-white' : 'bg-brand-100 text-brand-700 hover:bg-brand-200'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="p-4 lg:p-6">
      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}
      {success ? <WarningBanner message={success} onDismiss={() => setSuccess(null)} /> : null}
      <div className="mb-4 flex flex-wrap gap-2 border-b border-brand-200 pb-4">
        {tabBtn('branding', 'Branding')}
        {tabBtn('printers', 'Printers')}
        {tabBtn('security', 'Security')}
        {tabBtn('onboarding', 'Onboarding')}
      </div>

      {tab === 'branding' && branding ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {isPro && branding.font ? <link rel="stylesheet" href={FONT_HREF_MAP[branding.font] ?? ''} /> : null}
          <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-card">
            <h3 className="mb-3 text-lg font-semibold text-brand-900">Branding Settings</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm text-brand-700">Logo</label>
                <div
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault()
                    const file = e.dataTransfer.files?.[0]
                    if (file) void uploadLogo(file)
                  }}
                  className="rounded-xl border border-dashed border-brand-300 bg-brand-50 p-4"
                >
                  <input
                    id="branding-logo-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) void uploadLogo(file)
                    }}
                  />
                  <label htmlFor="branding-logo-upload" className="block cursor-pointer text-center">
                    {branding.logo_url ? (
                      <img
                        src={branding.logo_url}
                        alt="Current logo"
                        className="mx-auto mb-3 h-16 w-auto object-contain"
                      />
                    ) : (
                      <div className="mx-auto mb-3 h-16 w-24 rounded bg-brand-200" />
                    )}
                    <p className="text-sm font-medium text-brand-800">
                      {uploadingLogo ? 'Uploading...' : 'Drag & drop logo or click to upload'}
                    </p>
                    <p className="mt-1 text-xs text-brand-500">JPG, PNG, WEBP up to 2MB</p>
                  </label>
                  {branding.logo_url ? (
                    <button
                      type="button"
                      onClick={() => void removeLogo()}
                      className="mt-3 w-full rounded-lg border border-brand-300 bg-white px-3 py-2 text-sm text-brand-700 hover:bg-brand-50"
                    >
                      Remove logo
                    </button>
                  ) : null}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm text-brand-700">Accent color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={branding.accent_color ?? '#1D6FBF'}
                    onChange={e =>
                      setBranding(prev => (prev ? { ...prev, accent_color: e.target.value } : prev))
                    }
                    className="h-10 w-14 rounded border border-brand-300"
                  />
                  <input
                    value={branding.accent_color ?? ''}
                    onChange={e =>
                      setBranding(prev => (prev ? { ...prev, accent_color: e.target.value } : prev))
                    }
                    className="flex-1 rounded-lg border border-brand-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              {isPro ? (
                <>
                  <div>
                    <label className="mb-1 block text-sm text-brand-700">Font</label>
                    <select
                      value={branding.font ?? 'Inter'}
                      onChange={e => setBranding(prev => (prev ? { ...prev, font: e.target.value } : prev))}
                      className="w-full rounded-lg border border-brand-300 px-3 py-2 text-sm"
                    >
                      {fonts.map(f => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-brand-700">Secondary color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={branding.secondary_color ?? '#6B6860'}
                        onChange={e =>
                          setBranding(prev => (prev ? { ...prev, secondary_color: e.target.value } : prev))
                        }
                        className="h-10 w-14 rounded border border-brand-300"
                      />
                      <input
                        value={branding.secondary_color ?? ''}
                        onChange={e =>
                          setBranding(prev => (prev ? { ...prev, secondary_color: e.target.value } : prev))
                        }
                        className="flex-1 rounded-lg border border-brand-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-brand-700">Confirmation message</label>
                    <textarea
                      value={branding.confirmation_message_en ?? ''}
                      onChange={e =>
                        setBranding(prev =>
                          prev ? { ...prev, confirmation_message_en: e.target.value } : prev
                        )
                      }
                      className="min-h-24 w-full rounded-lg border border-brand-300 px-3 py-2 text-sm"
                    />
                    <p className="mt-1 text-xs text-brand-500">
                      Translation: {branding.confirmation_message_el ?? 'Will be auto-generated'}
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-brand-700">Receipt header</label>
                    <input
                      value={branding.receipt_header ?? ''}
                      onChange={e =>
                        setBranding(prev => (prev ? { ...prev, receipt_header: e.target.value } : prev))
                      }
                      className="w-full rounded-lg border border-brand-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-brand-700">Receipt footer</label>
                    <input
                      value={branding.receipt_footer ?? ''}
                      onChange={e =>
                        setBranding(prev => (prev ? { ...prev, receipt_footer: e.target.value } : prev))
                      }
                      className="w-full rounded-lg border border-brand-300 px-3 py-2 text-sm"
                    />
                  </div>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => void saveBranding()}
                className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
              >
                Save
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-card">
            <h3 className="mb-3 text-lg font-semibold text-brand-900">Live Preview</h3>
            <div
              className={`rounded-xl border border-brand-200 p-4 ${previewFontClass}`}
              style={{ backgroundColor: `${accent}0D`, fontFamily: branding.font ?? 'Inter' }}
            >
              <div
                className="mb-3 flex items-center justify-between rounded-lg px-3 py-2"
                style={{ backgroundColor: accent, color: navTextColor }}
              >
                <span className="text-sm font-semibold">Menu</span>
                <span className="text-xs">EN</span>
              </div>
              {branding.logo_url ? (
                <img src={branding.logo_url} alt="Logo preview" className="mb-3 h-10 w-auto object-contain" />
              ) : (
                <div className="mb-3 h-10 w-24 rounded bg-brand-200" />
              )}
              <div className="mb-2 flex gap-2">
                <span
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={{ backgroundColor: accent, color: navTextColor }}
                >
                  Pizza
                </span>
                <span
                  className="rounded-full px-3 py-1 text-xs font-medium text-white"
                  style={{ backgroundColor: secondary }}
                >
                  Vegetarian
                </span>
              </div>
              <div
                className="rounded-xl border p-3 transition-colors"
                style={{ borderColor: `${accent}33` }}
              >
                <p className="text-lg text-brand-900">Margherita Pizza</p>
                <p className="text-sm text-brand-600">Tomato, mozzarella, basil</p>
                <p className="mt-2 text-base font-semibold" style={{ color: accent }}>
                  €12.50
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg px-4 py-2 text-sm font-medium"
                  style={{ backgroundColor: accent, color: navTextColor }}
                >
                  Add to cart
                </button>
                <button
                  type="button"
                  className="rounded-lg px-4 py-2 text-sm font-medium"
                  style={{ backgroundColor: accent, color: navTextColor }}
                >
                  Order
                </button>
                <button
                  type="button"
                  className="rounded-lg px-4 py-2 text-sm font-medium"
                  style={{ backgroundColor: accent, color: navTextColor }}
                >
                  Pay
                </button>
              </div>
              <button
                type="button"
                className="mt-3 rounded-lg border px-4 py-2 text-sm font-medium"
                style={{ borderColor: `${accent}33`, color: accent }}
              >
                Sample card hover highlight
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'printers' && printers ? (
        <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-card">
          <h3 className="mb-3 text-lg font-semibold text-brand-900">Printer Settings</h3>
          {(['kitchen', 'bar', 'cashier'] as const).map(key => {
            const valid = !printers[key] || IPV4.test(printers[key] ?? '')
            return (
              <div key={key} className="mb-3 rounded-lg border border-brand-200 p-3">
                <p className="mb-2 text-sm font-medium capitalize text-brand-800">{key} Printer</p>
                <div className="flex gap-2">
                  <input
                    value={printers[key] ?? ''}
                    onChange={e => setPrinters(prev => (prev ? { ...prev, [key]: e.target.value } : prev))}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm ${valid ? 'border-brand-300' : 'border-red-300 bg-red-50'}`}
                    placeholder="192.168.1.20"
                  />
                  <button type="button" onClick={() => void testPrinter(key)} className="rounded-lg border border-brand-300 px-3 py-2 text-sm">
                    Test {tests[key] === 'ok' ? '✅' : tests[key] === 'fail' ? '❌' : ''}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrinters(prev => (prev ? { ...prev, [key]: null } : prev))}
                    className="rounded-lg border border-brand-300 px-3 py-2 text-sm"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )
          })}
          <button
            type="button"
            onClick={() => void savePrinters()}
            className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
          >
            Save
          </button>
        </div>
      ) : null}

      {tab === 'security' && security ? (
        <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-card">
          <h3 className="mb-3 text-lg font-semibold text-brand-900">Security</h3>
          <label className="mb-2 block text-sm font-medium text-brand-800">Lock screen after inactivity</label>
          <select
            value={security.inactivity_timeout_minutes}
            onChange={e =>
              setSecurity(prev =>
                prev ? { ...prev, inactivity_timeout_minutes: Number(e.target.value) } : prev
              )
            }
            className="rounded-lg border border-brand-300 px-3 py-2 text-sm"
          >
            {[5, 10, 15, 20, 30].map(v => (
              <option key={v} value={v}>
                {v} min
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-brand-500">
            Applies to all staff including cashier. The cashier screen will lock but never fully log out.
          </p>
          <button
            type="button"
            onClick={() => void saveSecurity()}
            className="mt-3 rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
          >
            Save
          </button>
        </div>
      ) : null}

      {tab === 'onboarding' ? (
        <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-card">
          <h3 className="text-lg font-semibold text-brand-900">iPad Setup Guide</h3>
          <p className="mb-3 text-sm text-brand-600">Follow these steps to set up the cashier iPad.</p>
          <div className="space-y-2">
            {onboardingSteps.map((step, idx) => {
              const done = completedSteps.includes(idx)
              return (
                <div
                  key={idx}
                  className={`flex items-start justify-between rounded-lg border px-3 py-3 ${
                    done ? 'border-success-300 bg-success-50' : 'border-brand-200 bg-brand-50'
                  }`}
                >
                  <div className="pr-4">
                    <p className="text-sm font-semibold text-brand-900">
                      {idx + 1}. {step.title}
                    </p>
                    <p className="text-sm text-brand-600">{step.body}</p>
                    {idx === 1 ? (
                      <button
                        type="button"
                        onClick={() => void navigator.clipboard.writeText(`${window.location.origin}/${slug}/cashier`)}
                        className="mt-2 rounded border border-brand-300 bg-white px-2 py-1 text-xs font-mono text-brand-700"
                      >
                        {`${window.location.origin}/${slug}/cashier`}
                      </button>
                    ) : null}
                  </div>
                  <label className="flex items-center gap-2 text-xs text-brand-700">
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() => toggleStep(idx)}
                    />
                    Mark as done
                  </label>
                </div>
              )
            })}
          </div>
          <button type="button" onClick={resetChecklist} className="mt-3 text-sm text-brand-700 underline">
            Reset checklist
          </button>
        </div>
      ) : null}
    </div>
  )
}
