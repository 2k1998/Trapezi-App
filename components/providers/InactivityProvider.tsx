'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  DEFAULT_TIMEOUT_MINUTES,
  INACTIVITY_EVENTS,
  PIN_LOCK_FAILURE_LIMIT,
} from '@/lib/inactivity/config'
import { apiGetJson } from '@/lib/menu/client-api'

type StaffRole = 'owner' | 'manager' | 'cashier' | string

type InactivityContextValue = {
  isLocked: boolean
  staffId: string
  role: StaffRole
}

const InactivityContext = createContext<InactivityContextValue | null>(null)

type Props = {
  children: React.ReactNode
  restaurantId: string
  slug: string
  staffId: string
  role: StaffRole
  firstName?: string
  logoUrl?: string | null
}

export function useInactivity() {
  const ctx = useContext(InactivityContext)
  if (!ctx) throw new Error('useInactivity must be used inside InactivityProvider')
  return ctx
}

export function InactivityProvider({
  children,
  restaurantId,
  slug,
  staffId,
  role,
  firstName = 'Staff',
  logoUrl = null,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [timeoutMinutes, setTimeoutMinutes] = useState(DEFAULT_TIMEOUT_MINUTES)
  const [isLocked, setIsLocked] = useState(false)
  const [enteredPin, setEnteredPin] = useState('')
  const [errorText, setErrorText] = useState<string | null>(null)
  const [attemptsRemaining, setAttemptsRemaining] = useState(PIN_LOCK_FAILURE_LIMIT)
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(false)
  const hardBlockedRef = useRef(false)
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    try {
      sessionStorage.setItem(
        `staff_identity_${slug}`,
        JSON.stringify({ staffId, role, restaurantId, firstName })
      )
    } catch {
      /* ignore */
    }
  }, [firstName, restaurantId, role, slug, staffId])

  useEffect(() => {
    void apiGetJson<{ inactivity_timeout_minutes: number }>(
      `/api/settings/security?restaurantId=${encodeURIComponent(restaurantId)}`
    )
      .then(data => setTimeoutMinutes(data.inactivity_timeout_minutes ?? DEFAULT_TIMEOUT_MINUTES))
      .catch(() => setTimeoutMinutes(DEFAULT_TIMEOUT_MINUTES))
  }, [restaurantId])

  const lockNow = useCallback(() => {
    setIsLocked(true)
    setEnteredPin('')
    setErrorText(null)
  }, [])

  const resetTimer = useCallback(() => {
    if (isLocked) return
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(lockNow, timeoutMinutes * 60 * 1000)
  }, [isLocked, lockNow, timeoutMinutes])

  useEffect(() => {
    resetTimer()
    const handlers = INACTIVITY_EVENTS.map(eventName => {
      const handler = () => resetTimer()
      window.addEventListener(eventName, handler, { passive: true })
      return { eventName, handler }
    })
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
      handlers.forEach(({ eventName, handler }) => {
        window.removeEventListener(eventName, handler)
      })
    }
  }, [resetTimer])

  const failFeedback = useCallback((message: string, remaining: number) => {
    setErrorText(message)
    setAttemptsRemaining(remaining)
    setEnteredPin('')
    setShake(true)
    window.setTimeout(() => setShake(false), 420)
  }, [])

  const verifyPin = useCallback(
    async (pin: string) => {
      if (busy || hardBlockedRef.current) return
      setBusy(true)
      try {
        const res = await fetch('/api/auth/pin-verify', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ staffId, pin }),
        })
        const data = (await res.json()) as
          | { valid: true }
          | { valid: false; attempts_remaining: number; error?: string }

        if (res.ok && 'valid' in data && data.valid) {
          setIsLocked(false)
          setEnteredPin('')
          setErrorText(null)
          setAttemptsRemaining(PIN_LOCK_FAILURE_LIMIT)
          resetTimer()
          return
        }

        const remaining =
          'attempts_remaining' in data ? data.attempts_remaining : Math.max(0, attemptsRemaining - 1)
        const isTooMany = remaining <= 0

        if (isTooMany && (role === 'owner' || role === 'manager')) {
          await supabase.auth.signOut()
          router.replace(`/${slug}/login`)
          return
        }

        if (isTooMany && role === 'cashier') {
          hardBlockedRef.current = true
          failFeedback('Too many attempts. Contact your manager.', 0)
          return
        }

        failFeedback(`Incorrect PIN. ${remaining} attempts remaining.`, remaining)
      } catch {
        failFeedback('Incorrect PIN. Please try again.', attemptsRemaining)
      } finally {
        setBusy(false)
      }
    },
    [attemptsRemaining, busy, failFeedback, resetTimer, role, router, slug, staffId, supabase.auth]
  )

  useEffect(() => {
    if (!isLocked) return
    if (enteredPin.length === 4) {
      void verifyPin(enteredPin)
    }
  }, [enteredPin, isLocked, verifyPin])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isLocked) return
      if (busy || hardBlockedRef.current) return
      if (/^\d$/.test(e.key) && enteredPin.length < 4) {
        setEnteredPin(prev => `${prev}${e.key}`.slice(0, 4))
        return
      }
      if (e.key === 'Backspace') {
        setEnteredPin(prev => prev.slice(0, -1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, enteredPin.length, isLocked])

  const value = useMemo<InactivityContextValue>(
    () => ({ isLocked, staffId, role }),
    [isLocked, role, staffId]
  )

  return (
    <InactivityContext.Provider value={value}>
      {children}
      {isLocked ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-brand-900/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-brand-200 bg-white p-6 shadow-elevated">
            <div className="mb-4 text-center">
              {logoUrl ? (
                <img src={logoUrl} alt="Restaurant logo" className="mx-auto mb-3 h-12 w-auto object-contain" />
              ) : null}
              <p className="font-display text-2xl text-brand-900">Welcome back, {firstName}</p>
            </div>
            <motion.div
              animate={shake ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
              transition={{ duration: 0.35 }}
              className="mb-4 flex justify-center gap-2"
            >
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-4 w-4 rounded-full border ${
                    i < enteredPin.length ? 'border-brand-800 bg-brand-800' : 'border-brand-300 bg-brand-100'
                  }`}
                />
              ))}
            </motion.div>
            {errorText ? <p className="mb-3 text-center text-sm text-red-600">{errorText}</p> : null}
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                <button
                  key={n}
                  type="button"
                  disabled={busy || hardBlockedRef.current || enteredPin.length >= 4}
                  onClick={() => setEnteredPin(prev => `${prev}${n}`.slice(0, 4))}
                  className="h-16 min-h-16 rounded-xl border border-brand-300 bg-brand-50 text-xl font-semibold text-brand-900 hover:bg-brand-100 disabled:opacity-50"
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setEnteredPin('')}
                className="h-16 rounded-xl border border-brand-300 bg-white text-sm font-medium text-brand-700"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={busy || hardBlockedRef.current}
                onClick={() => setEnteredPin(prev => `${prev}0`.slice(0, 4))}
                className="h-16 rounded-xl border border-brand-300 bg-brand-50 text-xl font-semibold text-brand-900 disabled:opacity-50"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => setEnteredPin(prev => prev.slice(0, -1))}
                className="h-16 rounded-xl border border-brand-300 bg-white text-sm font-medium text-brand-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </InactivityContext.Provider>
  )
}
