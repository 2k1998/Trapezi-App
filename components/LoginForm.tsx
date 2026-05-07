'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Props = {
  slug: string
  restaurantId: string
  restaurantName: string
  restaurantPlan: string
  logoUrl: string | null
}

export function LoginForm({ slug, restaurantId, restaurantName, restaurantPlan, logoUrl }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async () => {
    setLoading(true)
    setError(null)

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (authError || !authData.user) {
      setError('Incorrect email or password')
      setLoading(false)
      return
    }

    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('role, restaurant_id')
      .eq('id', authData.user.id)
      .single()

    if (staffError || !staffData) {
      await supabase.auth.signOut()
      setError('Incorrect email or password')
      setLoading(false)
      return
    }

    // Verify this staff member belongs to this restaurant
    if (staffData.restaurant_id !== restaurantId) {
      await supabase.auth.signOut()
      setError('Incorrect email or password')
      setLoading(false)
      return
    }

    const { role } = staffData
    try {
      sessionStorage.setItem(
        `staff_identity_${slug}`,
        JSON.stringify({
          staffId: authData.user.id,
          role,
          restaurantId,
          firstName: authData.user.email?.split('@')[0] ?? 'Staff',
        })
      )
    } catch {
      /* ignore */
    }

    // Cashiers require a paid plan
    if (role === 'cashier' && restaurantPlan === 'free') {
      await supabase.auth.signOut()
      setError('This feature requires a paid plan')
      setLoading(false)
      return
    }

    let targetRoute: string
    if (role === 'owner') {
      targetRoute = `/${slug}/owner/menu`
    } else if (role === 'cashier') {
      targetRoute = `/${slug}/cashier`
    } else {
      // admin role has no slug-scoped route — fall back to /admin
      targetRoute = '/admin'
    }

    router.refresh()
    router.push(targetRoute)
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
          {logoUrl ? (
            <img src={logoUrl} alt={`${restaurantName} logo`} className="mb-4 h-14 w-auto object-contain" />
          ) : (
            <Image
              src="/logo.png"
              alt="Trapezi"
              width={180}
              height={62}
              priority
              className="mb-4 object-contain"
              style={{
                filter:
                  'brightness(0) saturate(100%) invert(18%) sepia(72%) saturate(700%) hue-rotate(200deg) brightness(85%) contrast(100%)',
              }}
            />
          )}
          <h1 className="font-display text-2xl text-brand-900">Staff Login</h1>
          <p className="mt-1 text-sm text-brand-600">{restaurantName}</p>
        </div>

        <div className="space-y-4">
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
              onKeyDown={e => {
                if (e.key === 'Enter') void handleLogin()
              }}
              className="w-full rounded-lg border border-brand-200 px-3 py-2 text-brand-900 focus:outline-none focus:ring-2 focus:ring-accent-500"
              placeholder="name@restaurant.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brand-700" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') void handleLogin()
              }}
              className="w-full rounded-lg border border-brand-200 px-3 py-2 text-brand-900 focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <p className="text-xs text-brand-500">For password resets, contact the owner.</p>
          <button
            type="button"
            onClick={() => void handleLogin()}
            disabled={loading}
            className="w-full rounded-lg bg-brand-800 px-4 py-2 font-medium text-white transition-colors hover:bg-brand-900 disabled:opacity-70"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}
