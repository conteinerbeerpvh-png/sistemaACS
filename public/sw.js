const CACHE = 'acs-publico-v8';
const PUBLICOS = ['/offline.html', '/offline.js', '/assets/icons/icon-192.png', '/assets/icons/icon-512.png', '/assets/icons/maskable-512.png', '/assets/icons/apple-touch-icon.png'];
self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PUBLICOS)));
});
self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        for (const chave of await caches.keys()) if (chave.startsWith('acs-publico-') && chave !== CACHE) await caches.delete(chave);
        await self.clients.claim();
    })());
});
self.addEventListener('message', event => { if (event.data?.type === 'ATIVAR_ATUALIZACAO') self.skipWaiting(); });
self.addEventListener('fetch', event => {
    const { request } = event; const url = new URL(request.url);
    // Todas as APIs, POSTs e respostas autenticadas ficam exclusivamente na rede.
    if (url.origin !== self.location.origin || request.method !== 'GET' || request.headers.has('Authorization') || url.pathname.startsWith('/api/')) return;
    if (request.mode === 'navigate' && ['/', '/index.html'].includes(url.pathname)) {
        event.respondWith(fetch(request).catch(async () => (await caches.open(CACHE)).match('/offline.html')));
    } else if (!url.search && PUBLICOS.includes(url.pathname)) {
        event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(request)) || fetch(request)));
    }
});
