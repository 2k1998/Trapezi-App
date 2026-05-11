'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, Building2, LogOut, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  adminName: string
  children: React.ReactNode
}

function pageTitle(pathname: string): string {
  if (pathname.startsWith('/admin/restaurants/')) return 'Λεπτομέρειες Εστιατορίου'
  if (pathname.startsWith('/admin/restaurants')) return 'Εστιατόρια'
  return 'Admin Panel'
}

function navClass(active: boolean): string {
  if (active) {
    return 'flex items-center gap-3 rounded-lg bg-accent-500/20 px-3 py-2 text-sm font-medium text-accent-300'
  }
  return 'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-brand-300 transition-colors hover:bg-brand-800 hover:text-white'
}

export function AdminShell({ adminName, children }: Props) {
  const pathname = usePathname()
  const supabase = createClient()

  const restaurantsActive = pathname === '/admin/restaurants' || pathname.startsWith('/admin/restaurants/')

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="flex min-h-screen bg-brand-50">
      <aside className="fixed inset-y-0 left-0 flex w-64 flex-col bg-brand-950">
        <div className="border-b border-brand-800 px-6 py-5">
          <Image src="/logo.png" alt="Trapezi" width={140} height={48} priority className="object-contain" />
          <p className="mt-1 text-xs uppercase tracking-widest text-brand-400">Admin Panel</p>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          <Link href="/restaurants" className={navClass(restaurantsActive)} aria-current={restaurantsActive ? 'page' : undefined}>
            <Building2 className="h-4 w-4" aria-hidden />
            <span>Εστιατόρια</span>
          </Link>

          <button
            type="button"
            disabled
            title="Έρχεται σύντομα"
            className="flex w-full cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-brand-300 opacity-40"
          >
            <BarChart3 className="h-4 w-4" aria-hidden />
            <span>Αναλυτικά</span>
          </button>

          <button
            type="button"
            disabled
            title="Έρχεται σύντομα"
            className="flex w-full cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-brand-300 opacity-40"
          >
            <Settings className="h-4 w-4" aria-hidden />
            <span>Ρυθμίσεις</span>
          </button>
        </nav>

        <div className="border-t border-brand-800 px-4 py-4">
          <p className="mb-3 truncate text-sm text-brand-300">{adminName}</p>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex items-center gap-2 text-sm text-brand-400 transition-colors hover:text-white"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            <span>Αποσύνδεση</span>
          </button>
        </div>
      </aside>

      <div className="ml-64 flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-brand-200 bg-white px-6 py-4">
          <h1 className="font-display text-xl text-brand-900">{pageTitle(pathname)}</h1>
          <div />
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
