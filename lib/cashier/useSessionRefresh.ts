'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const TEN_MINUTES_MS = 10 * 60 * 1000

export function useSessionRefresh(): void {
  useEffect(() => {
    const supabase = createClient()

    const interval = setInterval(() => {
      supabase.auth.refreshSession().catch(() => {
        // Silent — cashier screen must not crash on refresh failure
      })
    }, TEN_MINUTES_MS)

    return () => {
      clearInterval(interval)
    }
  }, [])
}
