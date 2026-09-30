/* Locatelli catalogue — offline cache. Photos and the film have content-hashed names, so they are
   cached for good; the page itself is always fetched fresh when online (cached copy only offline). */
const CACHE = 'lucateli-v133';
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){ return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); })); })
    .then(function(){ return self.clients.claim(); }));
});
self.addEventListener('fetch', function(e){
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== self.location.origin) return;
  if (/\/(img|icons)\/|intro-film-[0-9a-f]+\.js$|og-image\.jpg$/.test(url.pathname)){
    e.respondWith(caches.open(CACHE).then(function(c){
      return c.match(req).then(function(hit){
        return hit || fetch(req).then(function(res){ if (res.ok && res.status === 200) c.put(req, res.clone()); return res; });
      });
    }));
    return;
  }
  if (req.mode === 'navigate'){
    e.respondWith(fetch(req).then(function(res){ const cp = res.clone(); caches.open(CACHE).then(function(c){ c.put(req, cp); }); return res; })
      .catch(function(){ return caches.match(req); }));
  }
});
