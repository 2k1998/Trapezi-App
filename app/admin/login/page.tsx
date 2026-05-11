'use client'

import Image from 'next/image'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AdminLoginPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return

    setLoading(true)
    setError(null)

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (authError || !data.user) {
      setError('Λάθος email ή κωδικός πρόσβασης.')
      setLoading(false)
      return
    }

    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (staffError || !staff || staff.role !== 'admin') {
      await supabase.auth.signOut()
      setError('Δεν έχετε δικαίωμα πρόσβασης στο admin panel.')
      setLoading(false)
      return
    }

    window.location.href = '/restaurants'
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{
        background:
          'radial-gradient(ellipse at top right, #3F9EF4 0%, transparent 50%), linear-gradient(to bottom, #216AB7 0%, #0D4386 40%, #082A63 70%, #020B33 100%)',
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-brand-200 bg-white p-8 shadow-card animate-fade-up">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image
            src="/logo.png"
            alt="Trapezi"
            width={180}
            height={62}
            priority
            className="object-contain"
            style={{
              filter:
                'brightness(0) saturate(100%) invert(18%) sepia(72%) saturate(700%) hue-rotate(200deg) brightness(85%) contrast(100%)',
            }}
          />
          <p className="mt-3 text-xs uppercase tracking-widest text-brand-400">Admin Panel</p>
          <h1 className="mt-2 font-display text-2xl text-brand-900">Είσοδος</h1>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-brand-700" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-brand-200 px-3 py-2 text-brand-900 focus:outline-none focus:ring-2 focus:ring-accent-500"
              placeholder="admin@trapeziapp.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-brand-700" htmlFor="password">
              Κωδικός πρόσβασης
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-brand-200 px-3 py-2 text-brand-900 focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-900 px-4 py-2 font-medium text-white transition-colors hover:bg-brand-950 disabled:opacity-70"
          >
            {loading ? 'Σύνδεση...' : 'Σύνδεση'}
          </button>
        </form>
      </div>
    </div>
  )
}
