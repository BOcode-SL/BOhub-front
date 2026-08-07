/// <reference lib="webworker" />
// ponytail: no fetch/precache — injectManifest+workbox-build hangs on Vite 8/Rolldown; shell via HTTP cache of hashed assets. Ceiling: no offline shell; upgrade = workbox precache when plugin fixed.

declare let self: ServiceWorkerGlobalScope

self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        void self.skipWaiting()
    }
})

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim())
})
