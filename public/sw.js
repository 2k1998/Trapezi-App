self.addEventListener('push', function(event) {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'Trapezi', {
      body: data.body || '',
      icon: '/icon-192.png'
    })
  )
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Focus the existing open tab rather than opening a new one
      for (const client of clientList) {
        if ('focus' in client) return client.focus()
      }
    })
  )
})
