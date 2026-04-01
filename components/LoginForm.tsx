'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Props = {
  slug: string
  restaurantId: string
  restaurantName: string
  restaurantPlan: string
}

export function LoginForm({ slug, restaurantId, restaurantPlan }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (authError || !authData.user) {
      setError('Invalid credentials')
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
      setError('Invalid credentials')
      setLoading(false)
      return
    }

    // Verify this staff member belongs to this restaurant
    if (staffData.restaurant_id !== restaurantId) {
      await supabase.auth.signOut()
      setError('Invalid credentials')
      setLoading(false)
      return
    }

    const { role } = staffData

    // Cashiers require a paid plan
    if (role === 'cashier' && restaurantPlan === 'free') {
      await supabase.auth.signOut()
      setError('This feature requires a paid plan')
      setLoading(false)
      return
    }

    let targetRoute: string
    if (role === 'owner') {
      targetRoute = `/${slug}/dashboard`
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
    <div className="min-h-screen bg-brand-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-[400px] bg-white p-8 rounded-xl shadow-card animate-fade-up">
        <h1 className="font-display text-2xl font-semibold mb-6 text-center text-brand-900">
          Staff Login
        </h1>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-brand-700 mb-1" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-brand-200 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
              placeholder="name@restaurant.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-700 mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-brand-200 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-800 text-white font-medium py-2 px-4 rounded-md hover:bg-brand-900 transition-colors disabled:opacity-70"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
