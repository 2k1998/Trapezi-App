'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { CreditCard, LogOut } from 'lucide-react'
import { PushPermissionBanner } from '@/components/staff/PushPermissionBanner'
import { PastDueBanner } from '@/components/owner/PastDueBanner'
import { createClient } from '@/lib/supabase/client'

function planLabel(plan: string): string {
  const p = plan.toLowerCase()
  if (p === 'free') return 'Free'
  if (p === 'basic') return 'Basic'
  if (p === 'pro') return 'Pro'
  if (p === 'enterprise') return 'Enterprise'
  return plan.charAt(0).toUpperCase() + plan.slice(1)
}

function IconMenu({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6h16M4 12h16M4 18h7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconChart({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 19V5M8 19v-6M12 19V9M16 19v-4M20 19v-8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconSettings({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconTable({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 7h18M5 7v10M19 7v10M3 12h18M8 7v10M16 7v10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

type Props = {
  slug: string
  restaurantName: string
  plan: string
  logoUrl?: string | null
  accentColor?: string
  secondaryColor?: string
  children: React.ReactNode
}

function isLight(hex: string): boolean {
  const safe = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#1D6FBF'
  const r = parseInt(safe.slice(1, 3), 16)
  const g = parseInt(safe.slice(3, 5), 16)
  const b = parseInt(safe.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 128
}

export function OwnerShell({
  slug,
  restaurantName,
  plan,
  logoUrl = null,
  accentColor = '#1D6FBF',
  secondaryColor = '#6B6860',
  children,
}: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [loggingOut, setLoggingOut] = useState(false)
  const menuPrefix = `/${slug}/owner/menu`
  const analyticsPrefix = `/${slug}/owner/analytics`
  const staffPrefix = `/${slug}/owner/staff`
  const settingsPrefix = `/${slug}/owner/settings`
  const tablesPrefix = `/${slug}/owner/tables`
  const billingPrefix = `/${slug}/owner/billing`
  const menuActive = pathname.startsWith(menuPrefix)
  const analyticsActive = pathname.startsWith(analyticsPrefix)
  const staffActive = pathname.startsWith(staffPrefix)
  const settingsActive = pathname.startsWith(settingsPrefix)
  const tablesActive = pathname.startsWith(tablesPrefix)
  const billingActive = pathname.startsWith(billingPrefix)
  const onAccent = isLight(accentColor) ? '#0F0E0D' : '#FFFFFF'

  const navClass = (active: boolean) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors md:justify-center lg:justify-start ${
      active
        ? 'text-brand-900'
        : 'text-brand-600 hover:bg-brand-100 hover:text-brand-900'
    }`

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await supabase.auth.signOut()
    } finally {
      router.push(`/${slug}/login`)
      router.refresh()
      setLoggingOut(false)
    }
  }

  return (
    <div
      className="flex min-h-screen bg-brand-50"
      data-owner-dashboard="true"
      style={
        {
          ['--color-accent' as string]: accentColor,
          ['--color-secondary' as string]: secondaryColor,
          ['--color-on-accent' as string]: onAccent,
        } as CSSProperties
      }
    >
      <style jsx global>{`
        [data-owner-dashboard='true'] .bg-brand-800,
        [data-owner-dashboard='true'] .bg-brand-900 {
          background-color: var(--color-accent) !important;
          color: var(--color-on-accent) !important;
        }
        [data-owner-dashboard='true'] .text-white {
          color: var(--color-on-accent) !important;
        }
        [data-owner-dashboard='true'] .bg-accent-400,
        [data-owner-dashboard='true'] .bg-accent-500,
        [data-owner-dashboard='true'] .bg-accent-600 {
          background-color: var(--color-secondary) !important;
        }
        [data-owner-dashboard='true'] .text-accent-400,
        [data-owner-dashboard='true'] .text-accent-500,
        [data-owner-dashboard='true'] .text-accent-600 {
          color: var(--color-secondary) !important;
        }
        [data-owner-dashboard='true'] .border-accent-400,
        [data-owner-dashboard='true'] .border-accent-500,
        [data-owner-dashboard='true'] .border-accent-600 {
          border-color: var(--color-secondary) !important;
        }
      `}</style>
      <PushPermissionBanner openRequestNonce={0} />
      <aside
        className="flex w-16 flex-shrink-0 flex-col border-r border-brand-200 bg-white shadow-card lg:w-56"
        aria-label="Owner navigation"
      >
        <div className="hidden h-16 items-center border-b border-brand-200 bg-brand-950 px-4 text-white lg:flex">
          <div className="flex items-center gap-2 min-w-0">
            {logoUrl ? (
              <img src={logoUrl} alt="Restaurant logo" className="max-h-10 w-auto max-w-[180px] object-contain" />
            ) : (
              <Image
                src="/logo.png"
                alt="Trapezi"
                width={140}
                height={48}
                priority
                className="object-contain"
              />
            )}
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2 lg:p-3">
          <Link
            href={menuPrefix}
            className={navClass(menuActive)}
            aria-current={menuActive ? 'page' : undefined}
            style={
              menuActive
                ? {
                    backgroundColor: `${accentColor}1A`,
                    borderLeft: `3px solid ${accentColor}`,
                    color: accentColor,
                  }
                : undefined
            }
          >
            <IconMenu className="flex-shrink-0 text-accent-600" aria-hidden />
            <span className="hidden lg:inline">Menu</span>
            <span className="sr-only lg:hidden">Menu</span>
          </Link>
          <Link
            href={analyticsPrefix}
            className={navClass(analyticsActive)}
            aria-current={analyticsActive ? 'page' : undefined}
            style={
              analyticsActive
                ? {
                    backgroundColor: `${accentColor}1A`,
                    borderLeft: `3px solid ${accentColor}`,
                    color: accentColor,
                  }
                : undefined
            }
          >
            <IconChart className="flex-shrink-0 text-accent-600" aria-hidden />
            <span className="hidden lg:inline">Analytics</span>
            <span className="sr-only lg:hidden">Analytics</span>
          </Link>
          <Link
            href={staffPrefix}
            className={navClass(staffActive)}
            aria-current={staffActive ? 'page' : undefined}
            style={
              staffActive
                ? {
                    backgroundColor: `${accentColor}1A`,
                    borderLeft: `3px solid ${accentColor}`,
                    color: accentColor,
                  }
                : undefined
            }
          >
            <IconUsers className="flex-shrink-0 text-accent-600" aria-hidden />
            <span className="hidden lg:inline">Staff</span>
            <span className="sr-only lg:hidden">Staff</span>
          </Link>
          <Link
            href={tablesPrefix}
            className={navClass(tablesActive)}
            aria-current={tablesActive ? 'page' : undefined}
            style={
              tablesActive
                ? {
                    backgroundColor: `${accentColor}1A`,
                    borderLeft: `3px solid ${accentColor}`,
                    color: accentColor,
                  }
                : undefined
            }
          >
            <IconTable className="flex-shrink-0 text-accent-600" aria-hidden />
            <span className="hidden lg:inline">Tables</span>
            <span className="sr-only lg:hidden">Tables</span>
          </Link>
          <Link
            href={billingPrefix}
            className={navClass(billingActive)}
            aria-current={billingActive ? 'page' : undefined}
            style={
              billingActive
                ? {
                    backgroundColor: `${accentColor}1A`,
                    borderLeft: `3px solid ${accentColor}`,
                    color: accentColor,
                  }
                : undefined
            }
          >
            <CreditCard className="h-5 w-5 flex-shrink-0 text-accent-600" aria-hidden />
            <span className="hidden lg:inline">Billing</span>
            <span className="sr-only lg:hidden">Billing</span>
          </Link>
          <Link
            href={settingsPrefix}
            className={navClass(settingsActive)}
            aria-current={settingsActive ? 'page' : undefined}
            style={
              settingsActive
                ? {
                    backgroundColor: `${accentColor}1A`,
                    borderLeft: `3px solid ${accentColor}`,
                    color: accentColor,
                  }
                : undefined
            }
          >
            <IconSettings className="flex-shrink-0 text-accent-600" aria-hidden />
            <span className="hidden lg:inline">Settings</span>
            <span className="sr-only lg:hidden">Settings</span>
          </Link>
        </nav>
        <div className="border-t border-brand-200 p-2 lg:p-3">
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-brand-500 transition-colors hover:bg-brand-100 hover:text-brand-700 disabled:opacity-60 md:justify-center lg:justify-start"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" aria-hidden />
            <span className="hidden lg:inline">{loggingOut ? 'Logging out...' : 'Log out'}</span>
            <span className="sr-only lg:hidden">Log out</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-brand-200 bg-white px-4 shadow-premium lg:px-6">
          <h1 className="truncate font-display text-lg font-semibold text-brand-900 md:text-xl">
            {restaurantName}
          </h1>
          <span
            className="flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
            style={{ backgroundColor: accentColor, color: onAccent }}
          >
            {planLabel(plan)}
          </span>
        </header>
        <PastDueBanner />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
