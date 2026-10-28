// =====================================================================
// SIGFCO — Service Worker mínimo e conservador (§8.3 — limites reais PWA)
// Objectivo: permitir instalação como PWA e shell básico. A persistência
// de dados offline é garantida pelo IndexedDB (não pelo SW). Nada é
// cacheado agressivamente para não mascarar frescura de telemetria.
// =====================================================================
const CACHE = 'sigfco-shell-v1'
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  )
})

// Network-first: a UI nunca serve dados velhos como se fossem actuais
// (GPS-012); offline total → página informando que os dados locais
// continuam guardados no IndexedDB.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return // API sempre à rede
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && SHELL.includes(url.pathname)) {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(e.request, clone))
        }
        return res
      })
      .catch(() => caches.match(url.pathname).then((hit) => hit ?? caches.match('/')))
  )
})
