// Actual browser helper, synthetic FileReader/bitmap/canvas/File. No pixel decoding.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';
const bundle=await build({bundle:true,write:false,format:'iife',globalName:'app',entryPoints:['apps/web/lib/photo.ts']});
function fixture(){
 const state={closed:0,draws:0,blob:{size:10},readFailure:false};
 const context={state,FileReader:class{constructor(){state.reader=this;}readAsDataURL(file){state.readFile=file;if(state.readFailure)throw Error('synthetic reader setup');}},createImageBitmap:async(file,options)=>{state.options=options;return{width:4000,height:3000,close(){state.closed++;}};},document:{createElement:()=>{const canvas={getContext:()=>state.noContext?null:{drawImage:()=>{state.draws++;if(state.drawFailure)throw Error('synthetic drawing failure');}},toBlob:(resolve,type,quality)=>{state.encoding={type,quality};if(!state.encodingStall)resolve(state.blob);}};state.canvas=canvas;return canvas;}},File:class{constructor(parts,name,options){this.size=parts[0].size;this.name=name;this.type=options.type;}}};
 runInNewContext(bundle.outputFiles[0].text,context);return{state,app:context.app};
}
const file={type:'image/png',size:100,name:'synthetic.png'};
const detached=reader=>{assert.equal(reader.onload,null);assert.equal(reader.onerror,null);assert.equal(reader.onabort,null);};
test('photo preparation: data URL strips prefix and detaches reader handlers',async()=>{const f=fixture(),result=f.app.readAsBase64(file);f.state.reader.result='data:image/png;base64,c3ludGhldGlj';f.state.reader.onload();assert.equal(await result,'c3ludGhldGlj');detached(f.state.reader);});
test('photo preparation: existing prefix-free string compatibility is retained',async()=>{const f=fixture(),result=f.app.readAsBase64(file);f.state.reader.result='c3ludGhldGlj';f.state.reader.onload();assert.equal(await result,'c3ludGhldGlj');});
test('photo preparation: read error rejects generically and detaches handlers',async()=>{const f=fixture(),result=f.app.readAsBase64(file);const outcome=assert.rejects(result,/Couldn't read/);f.state.reader.onerror();await outcome;detached(f.state.reader);});
test('photo preparation: aborted read settles instead of hanging',async()=>{const f=fixture(),result=f.app.readAsBase64(file);const outcome=assert.rejects(result,/cancelled/);assert.equal(typeof f.state.reader.onabort,'function');f.state.reader.onabort();await outcome;detached(f.state.reader);});
test('photo preparation: non-string reader result rejects instead of throwing from callback',async()=>{const f=fixture(),result=f.app.readAsBase64(file);const outcome=assert.rejects(result,/Couldn't read/);f.state.reader.result=null;assert.doesNotThrow(()=>f.state.reader.onload());await outcome;detached(f.state.reader);});
test('photo preparation: synchronous reader setup failure detaches handlers',async()=>{const f=fixture();f.state.readFailure=true;await assert.rejects(f.app.readAsBase64(file));detached(f.state.reader);});
test('photo preparation: draw failure releases bitmap and returns original without upload',async()=>{const f=fixture();f.state.drawFailure=true;assert.equal(await f.app.compressForUpload(file),file);assert.equal(f.state.closed,1);});
test('photo preparation: unavailable canvas and null blob retain fallback/release',async()=>{for(const mode of ['noContext','nullBlob']){const f=fixture();if(mode==='noContext')f.state.noContext=true;else f.state.blob=null;assert.equal(await f.app.compressForUpload(file),file);assert.equal(f.state.closed,1);}});
test('photo preparation: EXIF-aware downscale re-encodes smaller JPEG and releases bitmap once',async()=>{const f=fixture(),result=await f.app.compressForUpload(file);assert.equal(result.type,'image/jpeg');assert.equal(result.name,'synthetic.jpg');assert.equal(result.size,10);assert.equal(f.state.canvas.width,1600);assert.equal(f.state.canvas.height,1200);assert.equal(f.state.options.imageOrientation,'from-image');assert.equal(f.state.closed,1);});

test('photo preparation: stalled encoder does not retain the decoded bitmap',async()=>{const f=fixture();f.state.encodingStall=true;void f.app.compressForUpload(file);for(let i=0;i<5;i++)await Promise.resolve();assert.equal(f.state.closed,1);assert.equal(f.state.draws,1);});
