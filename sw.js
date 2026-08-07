self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', () => self.clients.claim())
self.addEventListener('fetch', (e) => {
  const url = e.request.url
  if (url.includes('supabase.co') || url.includes('/rest/') || url.includes('/auth/') || url.includes('/api/')) return
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request).then(r => r || fetch(e.request))))
})

self.addEventListener('push', function (event) {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'CORUM'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' }
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  )
})