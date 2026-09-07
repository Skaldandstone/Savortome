/** Local browser QA only. Never mount this harness in the application. */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const root=new URL('../apps/web/public/',import.meta.url);
const port=Number(process.env.CARE_HARNESS_PORT || 3096);
let revision=1;
const page=String.raw`<!doctype html><html lang="en"><title>Offline privacy QA</title><body><h1>Offline privacy QA</h1><p>Synthetic fixtures only. This server binds to loopback.</p><button id="install">Install and test privacy</button><button id="update">Update and retest</button><a href="/care">Test offline navigation</a><pre id="result" role="status">Ready</pre><script>
const result=document.querySelector('#result');
async function inspect(){
  const keys=await caches.keys();const entries=[];
  for(const key of keys){for(const req of await (await caches.open(key)).keys())entries.push(new URL(req.url).pathname);}
  if(keys.some(x=>x==='pages-v1'))throw Error('Legacy cache survived');
  if(entries.some(x=>x.startsWith('/api/')||x.startsWith('/private')))throw Error('Private data cached');
  if(!entries.includes('/care-offline.html'))throw Error('Offline shell absent');
  result.textContent='PASS: legacy cache removed; only public assets stored.\n'+JSON.stringify({keys,entries},null,2);
}
async function privateRequests(){
  for(const account of ['a','b','signed-out'])await fetch('/api/private?account='+account,{headers:{Authorization:'Bearer synthetic-'+account}});
  await fetch('/api/write',{method:'POST',body:'synthetic'});
  await fetch('/private-page');
  await inspect();
}
document.querySelector('#install').onclick=async()=>{try{
  result.textContent='Installing...';
  await (await caches.open('pages-v1')).put('/private-old',new Response('synthetic previous account'));
  const controlled=new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
  await navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'});
  await navigator.serviceWorker.ready;
  if(!navigator.serviceWorker.controller)await controlled;
  await privateRequests();
}catch(e){result.textContent='FAIL '+e.message;}};
document.querySelector('#update').onclick=async()=>{try{
  result.textContent='Updating...';
  await fetch('/qa/update',{method:'POST'});
  const changed=new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
  await (await navigator.serviceWorker.getRegistration()).update();await changed;
  await privateRequests();result.textContent+='\nPASS: changed worker activated and privacy checks repeated.';
}catch(e){result.textContent='FAIL '+e.message;}};
</script></body></html>`;
createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost:3096');
  if(url.pathname==='/care'){req.socket.destroy();return;}
  if(url.pathname==='/qa/update'){revision++;res.end('updated');return;}
  if(url.pathname==='/qa'){res.setHeader('Content-Type','text/html');res.end(page);return;}
  if(url.pathname.startsWith('/api/')||url.pathname==='/private-page'){res.setHeader('Cache-Control','private, no-store');res.end('Synthetic account fixture');return;}
  const allowed=['/sw.js','/care-offline.js','/icons/icon-192.png','/icons/icon-512.png'];
  if(!allowed.includes(url.pathname)){res.writeHead(404);res.end();return;}
  try{
    const data=await readFile(new URL('.'+url.pathname,root));
    res.setHeader('Cache-Control',url.pathname==='/sw.js'?'no-store':'public, max-age=0');
    res.setHeader('Content-Type',url.pathname.endsWith('.js')?'application/javascript':url.pathname.endsWith('.html')?'text/html':'image/png');
    res.end(url.pathname==='/sw.js'?Buffer.concat([data,Buffer.from('\n// harness revision '+revision)]):data);
  }catch{res.writeHead(404);res.end();}
}).listen(port,'127.0.0.1',()=>console.log('Browser QA: http://localhost:'+port+'/qa'));
