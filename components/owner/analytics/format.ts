import { format } from 'date-fns'

export function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency || 'EUR',
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatDateTime(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return format(d, 'dd MMM yyyy, HH:mm')
}

export function statusTone(status: string): string {
  const s = status.toLowerCase()
  if (s === 'paid') return 'bg-success-50 text-success-700 border-success-300'
  if (s === 'ready') return 'bg-accent-400/20 text-brand-900 border-accent-500/40'
  if (s === 'closed') return 'bg-brand-100 text-brand-700 border-brand-300'
  return 'bg-brand-50 text-brand-700 border-brand-200'
}
