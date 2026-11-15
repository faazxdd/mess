const C='mess-v11',A=['./','./index.html','./exit.js?v=11','./manifest.json','./icon-192.png','./icon-512.png','./apple-touch-icon.png','./intro.mp3'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(A)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim()});
/* offline range requests (audio) are answered from the cached full file */
const rng=async q=>{const r=await caches.match(q.url);if(!r)return Response.error();const b=await r.arrayBuffer(),n=b.byteLength,m=/bytes=(\d*)-(\d*)/.exec(q.headers.get('range')||'');let s=0,t=n-1;if(m){if(m[1]!==''){s=+m[1];if(m[2]!=='')t=+m[2]}else if(m[2]!==''){s=Math.max(0,n-+m[2])}}t=Math.min(t,n-1);return new Response(b.slice(s,t+1),{status:206,headers:{'Content-Type':r.headers.get('Content-Type')||'audio/mpeg','Content-Range':'bytes '+s+'-'+t+'/'+n,'Content-Length':String(t-s+1)}})};
self.addEventListener('fetch',e=>{const q=e.request;if(q.method!=='GET')return;
if(q.headers.has('range')){e.respondWith(fetch(q).catch(()=>rng(q)));return}
e.respondWith(fetch(q).then(r=>{if(r.ok||r.type==='opaque'){const k=r.clone();caches.open(C).then(c=>c.put(q,k)).catch(()=>{})}return r}).catch(()=>caches.match(q).then(m=>m||(q.mode==='navigate'?caches.match('./index.html'):Response.error()))))});
