'use client'

import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { persistPushSubscription, subscribeUserToPush } from '@/lib/push/index.client'

const SESSION_DISMISS_KEY = 'trapezi_push_prompt_dismissed'

function readSessionDismissed(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(SESSION_DISMISS_KEY) === '1'
}

function setSessionDismissed(): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(SESSION_DISMISS_KEY, '1')
}

type Props = {
  /** Increment (e.g. from parent state) to re-open the banner after header tap */
  openRequestNonce?: number
  onPermissionChange?: (permission: NotificationPermission) => void
}

export function PushPermissionBanner({ openRequestNonce = 0, onPermissionChange }: Props) {
  const [supported, setSupported] = useState(true)
  const [permission, setPermission] = useState<NotificationPermission | null>(null)
  const [sessionDismissed, setSessionDismissedState] = useState(false)
  const [forcedOpen, setForcedOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setSupported(false)
      return
    }
    const p = Notification.permission
    setPermission(p)
    setSessionDismissedState(readSessionDismissed())
    onPermissionChange?.(p)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only notification sync
  }, [])

  // If permission is already granted but the subscription may not be in the DB
  // (e.g. first load after browser prompt, or DB was cleared), re-subscribe silently.
  // This is the case where the banner never shows because permission !== 'default',
  // so the Enable button is never clicked, and the subscription is never saved.
  useEffect(() => {
    if (permission !== 'granted') return
    subscribeUserToPush().then(sub => {
      if (sub) {
        persistPushSubscription(sub).then(ok => {
          if (!ok) console.error('[Push] Silent re-subscribe: failed to persist subscription')
        })
      }
    })
  // Run once when permission resolves to 'granted' (covers mount + post-click)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission])

  useEffect(() => {
    if (openRequestNonce > 0 && supported && permission !== null && permission !== 'granted') {
      setForcedOpen(true)
    }
  }, [openRequestNonce, supported, permission])

  const dismissForSession = useCallback(() => {
    setSessionDismissed()
    setSessionDismissedState(true)
    setForcedOpen(false)
  }, [])

  const updatePermission = useCallback(
    (p: NotificationPermission) => {
      setPermission(p)
      if (p === 'granted') setForcedOpen(false)
      onPermissionChange?.(p)
    },
    [onPermissionChange]
  )

  const handleMaybeLater = useCallback(() => {
    dismissForSession()
  }, [dismissForSession])

  const handleEnable = useCallback(async () => {
    console.log('[Push] Enable button clicked')
    if (!supported || busy) return
    setBusy(true)
    try {
      const sub = await subscribeUserToPush()
      const p = Notification.permission
      updatePermission(p)
      if (p === 'denied') {
        dismissForSession()
        return
      }
      if (sub) {
        const ok = await persistPushSubscription(sub)
        if (!ok) {
          console.error('[Push] Failed to persist subscription')
        }
      }
    } finally {
      setBusy(false)
    }
  }, [supported, busy, updatePermission, dismissForSession])

  if (!supported || permission === null) {
    return null
  }

  const autoEligible = permission === 'default' && !sessionDismissed
  const forceEligible = forcedOpen && permission !== 'granted'
  const visible = autoEligible || forceEligible

  return (
    <AnimatePresence initial={false}>
      {visible ? (
        <motion.div
          key="push-banner"
          role="region"
          aria-label="Notification settings"
          initial={{ y: -24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -16, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="flex-shrink-0 border-b border-brand-200 bg-brand-100 px-4 py-3"
        >
          <div className="mx-auto flex max-w-[1600px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <p className="text-sm text-brand-800">
              Enable notifications to get alerted for new orders and tab updates.
            </p>
            <div className="flex flex-shrink-0 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={handleEnable}
                className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-900 disabled:opacity-60"
              >
                {busy ? 'Working…' : 'Enable'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleMaybeLater}
                className="rounded-lg border border-brand-300 bg-white px-4 py-2 text-sm font-medium text-brand-800 transition-colors hover:bg-brand-50 disabled:opacity-60"
              >
                Maybe later
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
