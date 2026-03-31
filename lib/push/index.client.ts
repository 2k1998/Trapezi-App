'use client'

import { savePushSubscriptionAction } from '@/lib/push/actions'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function getPublicVapidKey(): string {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
}

export async function persistPushSubscription(subscription: PushSubscription): Promise<boolean> {
  const json = subscription.toJSON()
  const endpoint = json.endpoint
  const keys = json.keys
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return false
  }

  const res = await savePushSubscriptionAction({
    endpoint,
    keys: { p256dh: keys.p256dh, auth: keys.auth },
  })

  console.log('[Push] savePushSubscriptionAction result:', res)
  return res.ok === true
}

export async function subscribeUserToPush(): Promise<PushSubscription | null> {
  try {
    const permission = await Notification.requestPermission()
    console.log('[Push] Notification permission:', permission)
    if (permission !== 'granted') {
      console.warn('[Push] Notification permission denied')
      return null
    }

    const registration = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready
    console.log('[Push] Service worker registered and ready:', registration.scope)

    const vapidKey = getPublicVapidKey()
    console.log(
      '[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY (first 10):',
      vapidKey ? vapidKey.slice(0, 10) : 'UNDEFINED — env var missing!'
    )

    if (!vapidKey) {
      console.error('[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set. Cannot subscribe.')
      return null
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })
    console.log('[Push] pushManager.subscribe() succeeded. Endpoint:', subscription.endpoint.slice(0, 40) + '…')

    return subscription
  } catch (err) {
    console.error('[Push] Failed to subscribe:', err)
    return null
  }
}
