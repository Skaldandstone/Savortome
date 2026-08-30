import { readFileSync, existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../../../apps/web/public/sw.js',import.meta.url),'utf8');
test('service worker never intercepts APIs, authenticated fetches, auth pages or mutations', () => {
  const handlers: Record<string, (event: any)=>void>={};
  runInNewContext(source,{ self:{location:{origin:'https://beta.test'},addEventListener:(name:string,fn:any)=>handlers[name]=fn},URL });
  for(const path of ['/api/profile/dietary','/api/pantry','/api/list','/api/admin/users','/api/billing','/sign-in','/sign-up']) {
    let intercepted=false;
    handlers.fetch!({request:{url:`https://beta.test${path}`,method:'GET',mode:'cors',headers:new Headers()},respondWith:()=>intercepted=true});
    assert.equal(intercepted,false,path);
  }
  for(const method of ['POST','PUT','DELETE']) {
    let intercepted=false;
    handlers.fetch!({request:{url:'https://beta.test/api/list',method,mode:'cors',headers:new Headers()},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
  }
  let intercepted=false;
  handlers.fetch!({request:{url:'https://beta.test/woodland/hearth.png',method:'GET',mode:'cors',headers:new Headers({authorization:'Bearer test'})},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
});
test('activation removes legacy private caches, preserving unrelated origin caches',async()=>{
  const handlers: Record<string, (event:any)=>void>={};const deleted:string[]=[];let done:Promise<void>|undefined;
  runInNewContext(source,{ self:{location:{origin:'https://beta.test'},addEventListener:(name:string,fn:any)=>handlers[name]=fn,clients:{claim:async()=>{}}},caches:{keys:async()=>['shell-v1','pages-v1','assets-v1','seconds-public-v2','seconds-public-v3','unrelated-cache'],delete:async(name:string)=>{deleted.push(name);return true;}},URL });
  handlers.activate!({waitUntil:(p:Promise<void>)=>done=p});await done;
  assert.deepEqual(deleted.sort(),['assets-v1','pages-v1','seconds-public-v2','shell-v1']);
});

function worker(fetcher: (url: any, options?: any) => Promise<any>) {
  const handlers: Record<string,(event:any)=>void>={};const stored:string[]=[];
  runInNewContext(source,{self:{location:{origin:'https://beta.test'},addEventListener:(name:string,fn:any)=>handlers[name]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{}}},URL,Response,fetch:fetcher,caches:{open:async()=>({match:async()=>undefined,put:async(request:any)=>{stored.push(typeof request==='string'?request:request.url);}})}});
  return {handlers,stored};
}
const response=(type:string, extras:Record<string,unknown>={})=>({ok:true,type:'basic',redirected:false,headers:new Headers({'content-type':type,'cache-control':'public,max-age=0'}),clone(){return this;},...extras});
test('precache omits credentials and validates the whole shell before storing',async()=>{
  const requests:any[]=[];const {handlers,stored}=worker(async(url,options)=>{requests.push(options);return response(url.endsWith('.html')?'text/html':url.endsWith('.js')?'application/javascript':'image/png');});
  let done:Promise<void>|undefined;handlers.install!({waitUntil:(p:Promise<void>)=>done=p});await done;
  assert.equal(stored.length,4);assert.equal(requests.length,3);assert.ok(requests.every(x=>x.credentials==='omit'&&x.cache==='reload'));
});
test('a private or redirected precache response fails installation without partial storage',async()=>{
  for(const bad of [response('application/javascript',{redirected:true}),response('application/javascript',{headers:new Headers({'content-type':'application/javascript','cache-control':'private,no-store'})})]){
    const {handlers,stored}=worker(async(url)=>url.endsWith('.js')?bad:response('image/png'));
    let done:Promise<void>|undefined;handlers.install!({waitUntil:(p:Promise<void>)=>done=p});await assert.rejects(done!);assert.equal(stored.length,0);
  }
});

test('offline document has no public HTML file and online requests never return the cached shell',async()=>{
  assert.equal(existsSync(new URL('../../../apps/web/public/care-offline.html',import.meta.url)),false);
  const notFound=response('text/html',{ok:false,status:404});
  const {handlers,stored}=worker(async()=>notFound);let done:Promise<any>|undefined;
  handlers.fetch!({request:{url:'https://beta.test/care-offline.html',method:'GET',mode:'navigate',headers:new Headers()},respondWith:(p:Promise<any>)=>done=p});
  assert.equal(await done,notFound);assert.equal(stored.length,0);
});
test('static cache rejects account-shaped responses, redirects, failures, and cookie variation',async()=>{
  const bad=[response('application/json'),response('image/png',{redirected:true}),response('image/png',{ok:false}),response('image/png',{type:'opaque'}),response('image/png',{headers:new Headers({'content-type':'image/png','cache-control':'private'})}),response('image/png',{headers:new Headers({'content-type':'image/png','vary':'Accept-Encoding, Cookie'})})];
  for(const item of bad){
    const {handlers,stored}=worker(async()=>item);let done:Promise<any>|undefined;
    handlers.fetch!({request:{url:'https://beta.test/woodland/hearth.png',method:'GET',mode:'cors',headers:new Headers()},respondWith:(p:Promise<any>)=>done=p});await done;assert.equal(stored.length,0);
  }
});
test('valid public image is cached while query URLs and unknown static payloads are excluded',async()=>{
  const {handlers,stored}=worker(async()=>response('image/png'));let done:Promise<any>|undefined;
  handlers.fetch!({request:{url:'https://beta.test/woodland/hearth.png',method:'GET',mode:'cors',headers:new Headers()},respondWith:(p:Promise<any>)=>done=p});await done;assert.equal(stored.length,1);
  for(const path of ['/woodland/hearth.png?user=private','/_next/static/private.json','/api/list','/recipe/private']){
    let intercepted=false;handlers.fetch!({request:{url:'https://beta.test'+path,method:'GET',mode:'cors',headers:new Headers()},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
  }
});
test('offline private-page navigation returns only the generic shell and stores no response',async()=>{
  const handlers:Record<string,(event:any)=>void>={};const shell={text:'Generic care'};let stored=false;
  runInNewContext(source,{self:{location:{origin:'https://beta.test'},addEventListener:(n:string,f:any)=>handlers[n]=f},URL,fetch:async()=>{throw Error('offline');},caches:{open:async()=>({match:async(path:string)=>path==='/care-offline.html'?shell:null,put:async()=>{stored=true;}})},Response});
  let done:Promise<any>|undefined;handlers.fetch!({request:{url:'https://beta.test/recipe/private',method:'GET',mode:'navigate',headers:new Headers()},respondWith:(p:Promise<any>)=>done=p});assert.equal(await done,shell);assert.equal(stored,false);
});
