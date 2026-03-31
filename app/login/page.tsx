'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
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

    const emailTrimmed = email.trim()
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: emailTrimmed,
      password,
    })

    if (authError || !authData.user) {
      setError(authError?.message || 'Login failed')
      setLoading(false)
      return
    }

    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('role, restaurants(slug)')
      .eq('id', authData.user.id)
      .single()

    if (staffError && staffError.code !== 'PGRST116') {
      setError(staffError.message)
      setLoading(false)
      return
    }

    if (!staffData) {
      setError(
        'No staff profile for this account. Ask an admin to add you in Staff, or run: npm run seed:users'
      )
      setLoading(false)
      return
    }

    const role = staffData.role
    const rest = staffData.restaurants as { slug?: string } | { slug?: string }[] | null
    const slug = Array.isArray(rest) ? rest[0]?.slug : rest?.slug

    let targetRoute = '/'
    if (role === 'admin') targetRoute = '/admin'
    else if (role === 'owner' && slug) targetRoute = `/${slug}/dashboard`
    else if (role === 'cashier' && slug) targetRoute = `/${slug}/cashier`
    else {
      setError('Your account has no restaurant assigned. Check staff.restaurant_id in Supabase.')
      setLoading(false)
      return
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
            <label className="block text-sm font-medium text-brand-700 mb-1" htmlFor="email">Email</label>
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
            <label className="block text-sm font-medium text-brand-700 mb-1" htmlFor="password">Password</label>
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
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
