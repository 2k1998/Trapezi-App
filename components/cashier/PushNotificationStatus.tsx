'use client'

import { useEffect, useState } from 'react'

type Props = {
  permission: NotificationPermission | null
  onRequestPrompt: () => void
}

export function PushNotificationStatus({ permission, onRequestPrompt }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return <div className="h-5 w-[132px] flex-shrink-0" aria-hidden />
  }

  if (!('Notification' in window)) {
    return null
  }

  const on = permission === 'granted'
  const label = on ? 'Notifications on' : 'Notifications off'

  if (on) {
    return (
      <button
        type="button"
        disabled
        className="flex max-w-[140px] cursor-default items-center gap-1.5 text-left"
        aria-label={label}
      >
        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500" aria-hidden />
        <span className="text-[11px] font-medium leading-tight text-brand-600">{label}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onRequestPrompt}
      className="flex max-w-[140px] items-center gap-1.5 rounded-md text-left text-brand-600 transition-colors hover:bg-brand-200/60 hover:text-brand-800"
      aria-label={`${label}. Tap to enable notifications.`}
    >
      <span className="h-2 w-2 flex-shrink-0 rounded-full bg-brand-400" aria-hidden />
      <span className="text-[11px] font-medium leading-tight">{label}</span>
    </button>
  )
}
