const CACHE_NAME = 'graupner-suite-v3';
const OFFLINE_URL = '/offline.html';

// Assets die immer gecacht werden sollen
const PRECACHE_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precaching App Shell');
      // Precache ohne /offline.html da wir es dynamisch erstellen
      return cache.addAll(['/manifest.json']);
    }).catch(err => console.error('[SW] Precache failed:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) =>
      Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip chrome-extension and other non-http(s) requests
  if (!event.request.url.startsWith('http')) return;

  // Netzwerk-First-Strategie mit Fallback auf Cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone response
        const responseToCache = response.clone();

        // Cache successful responses (aber nicht API-Calls)
        if (response.status === 200 && !event.request.url.includes('/api/')) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }

        return response;
      })
      .catch(() => {
        // Netzwerk fehlgeschlagen - versuche Cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          // Wenn Navigation und kein Cache -> Offline-Seite
          if (event.request.mode === 'navigate') {
            return new Response(
              `<!DOCTYPE html>
              <html lang="de">
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Offline - Graupner Suite</title>
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
                         display: flex; align-items: center; justify-content: center; 
                         min-height: 100vh; margin: 0; background: #f8fafc; color: #334155; }
                  .container { text-align: center; padding: 2rem; }
                  h1 { color: #14532D; font-size: 2rem; margin-bottom: 1rem; }
                  p { color: #64748b; margin-bottom: 2rem; }
                  .icon { font-size: 4rem; margin-bottom: 1rem; }
                  button { background: #14532D; color: white; border: none; 
                          padding: 0.75rem 1.5rem; border-radius: 0.5rem; 
                          font-size: 1rem; cursor: pointer; }
                  button:hover { background: #1a6b3a; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="icon">📡</div>
                  <h1>Keine Internetverbindung</h1>
                  <p>Die Graupner Suite benötigt eine Internetverbindung.<br>
                     Bitte prüfen Sie Ihre Netzwerkverbindung.</p>
                  <button onclick="location.reload()">Erneut versuchen</button>
                </div>
              </body>
              </html>`,
              {
                status: 503,
                statusText: 'Service Unavailable',
                headers: new Headers({
                  'Content-Type': 'text/html'
                })
              }
            );
          }

          // Für andere Requests
          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
  );
});

// Push Notifications
self.addEventListener('push', (event) => {
  let data = { title: 'Graupner Suite', body: 'Neue Benachrichtigung', url: '/' };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }
  const options = {
    body: data.body || 'Neue Nachricht',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'graupner-' + Date.now(),
    renotify: true,
    requireInteraction: true,
    data: { url: data.url || '/' }
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'Graupner Suite', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
