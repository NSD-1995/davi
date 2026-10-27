/* Only generic public assets enter this cache. No API, HTML, RSC or private media caching. */
const CACHE='davi-public-v1';
const PUBLIC=['/offline.html','/icons/davi-192.png','/icons/davi-512.png','/icons/davi-180.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PUBLIC))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('davi-public-')&&key!==CACHE).map(key=>caches.delete(key))))));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{const request=event.request;if(request.method!=='GET')return;const url=new URL(request.url);if(url.origin!==self.location.origin)return;if(request.mode==='navigate'){event.respondWith(fetch(request).catch(()=>caches.match('/offline.html')));return;}if(PUBLIC.includes(url.pathname)&&!url.search)event.respondWith(caches.match(request).then(hit=>hit||fetch(request)));});
