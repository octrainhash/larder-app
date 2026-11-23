// App shell works offline; live data (products, stores, recipes) always goes to the network.
const CACHE='flogger-v2';
const SHELL=['./','index.html','styles.css','app.js','data.js','scanner.js','viewer.js','vendor/three.module.min.js','vendor/OrbitControls.js','vendor/zxing.min.js','vendor/supabase.js','cloud.js','config.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin)return;
  // network first so updates arrive immediately, cache as fallback offline
  e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(ca=>ca.put(e.request,c));return r}).catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('index.html'))));
});

self.addEventListener('push',e=>{
  let d={};try{d=e.data.json()}catch(_){d={title:'Flogger',body:e.data?e.data.text():''}}
  e.waitUntil(self.registration.showNotification(d.title||'Flogger',{body:d.body||'',icon:'icons/icon-192.png',badge:'icons/icon-192.png',data:{url:d.url||'./'},tag:'larder'}));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const url=new URL((e.notification.data&&e.notification.data.url)||'./',self.registration.scope).href;
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(ws=>{for(const w of ws){if(w.url.startsWith(self.registration.scope))return w.focus()}return clients.openWindow(url)}));
});
