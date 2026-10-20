// Actual native component; synthetic permissions, files, recorder and API only.
// No device, microphone, camera, provider request or retained personal media.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
const mocks = {
  react: `export const useState=v=>{const i=state.cursor++;if(!(i in state.values))state.values[i]=v;return [state.values[i],v=>state.values[i]=typeof v==='function'?v(state.values[i]):v];};export const useRef=v=>{const i=state.cursor++;return state.values[i]??=( {current:v} );};export const useCallback=(fn,deps)=>{const i=state.cursor++;if(!state.deps[i]||deps.some((v,n)=>v!==state.deps[i][n])){state.deps[i]=deps;state.values[i]=fn;}return state.values[i];};export const useEffect=(fn,deps)=>{const i=state.cursor++;if(!state.deps[i]||deps.some((v,n)=>v!==state.deps[i][n])){state.cleanups[i]?.();state.deps[i]=deps;state.effects.push(()=>state.cleanups[i]=fn());}};`,
  'react/jsx-runtime': `export const Fragment='Fragment';export const jsx=(type,props)=>({type,props});export const jsxs=jsx;`,
  'react-native': `export const Text='Text',View='View',Image='Image',StyleSheet={create:v=>v};export const AppState={get currentState(){return state.appState;},addEventListener:(_,fn)=>{state.listeners.add(fn);return {remove:()=>state.listeners.delete(fn)};}};`,
  'expo-router': `import {useEffect} from 'react';export const useFocusEffect=fn=>useEffect(()=>{state.focus.add(fn);const cleanup=fn();state.focusCleanups.set(fn,cleanup);return ()=>{state.focus.delete(fn);state.focusCleanups.get(fn)?.();state.focusCleanups.delete(fn);};},[fn]);`,
  'expo-image-picker': `export const requestCameraPermissionsAsync=()=>state.cameraPermission();export const launchCameraAsync=()=>state.picker();export const launchImageLibraryAsync=()=>state.picker();`,
  'expo-audio': `export const RecordingPresets={HIGH_QUALITY:{}};export const useAudioRecorder=()=>state.recorder;export const requestRecordingPermissionsAsync=()=>state.micPermission();export const setAudioModeAsync=mode=>{state.modes.push(mode);return state.audioMode(mode);};`,
  'expo-file-system': `export const Paths={cache:{uri:'file:///cache/'}};export class File{constructor(uri){this.uri=uri;}get exists(){return state.files.has(this.uri);}get size(){return state.fileSize;}delete(){state.deleted.push(this.uri);state.files.delete(this.uri);}base64(){return state.readFile();}};`,
  '@seconds/core/format': `export class ApiError extends Error{constructor(status){super('private provider diagnostic');this.status=status;}};export const isPhotoMediaType=v=>['image/jpeg','image/png','image/webp'].includes(v);`,
  '@/ui': `export const Button='Button',Panel='Panel',PanelHeader='PanelHeader',Callout='Callout',space={sm:8,md:16},usePalette=()=>({text:'#fff',textMuted:'#ccc'});`,
};
const bundle = await build({bundle:true,write:false,format:'iife',globalName:'app',jsx:'automatic',stdin:{resolveDir:process.cwd(),contents:`export {FoodNoteCapture} from './apps/mobile/modules/today/FoodNoteCapture.tsx';`},plugins:[{name:'capture-boundaries',setup(api){api.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:undefined);api.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js'}));}}]});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function fixture(){
  const state={cursor:0,values:[],deps:[],effects:[],cleanups:[],focus:new Set(),focusCleanups:new Map(),listeners:new Set(),timers:new Set(),appState:'active',files:new Set(['file:///cache/photo.jpg','file:///cache/voice.m4a']),deleted:[],fileSize:100,modes:[],uploads:[],drafts:[],busy:[],statusCalls:[],recordCalls:0,
    cameraPermission:async()=>({granted:true}),micPermission:async()=>({granted:true}),audioMode:async()=>{},readFile:async()=>'synthetic',confirm:async()=>true,picker:async()=>({canceled:false,assets:[{uri:'file:///cache/photo.jpg',mimeType:'image/jpeg',base64:'synthetic'}]}),prepare:async()=>{},stop:async()=>{},send:async()=>({draft:{title:'Review me'}})};
  state.recorder={uri:'file:///cache/voice.m4a',prepareToRecordAsync:()=>state.prepare(),record:()=>{state.recordCalls++;},stop:()=>state.stop()};
  const props={client:{foodNoteCaptureStatus:()=>{const d=deferred();state.statusCalls.push(d);return d.promise;},foodNoteDraft:async(...args)=>{state.uploads.push(args);return state.send(...args);}},onDraft:(...args)=>state.drafts.push(args),onBusy:v=>state.busy.push(v),confirmReplace:()=>state.confirm()};
  const context={state,URL,setTimeout:fn=>{state.timers.add(fn);return fn;},clearTimeout:fn=>state.timers.delete(fn)};runInNewContext(bundle.outputFiles[0].text,context);
  const render=(effects=true)=>{state.cursor=0;const tree=context.app.FoodNoteCapture(props);if(effects)state.effects.splice(0).forEach(fn=>fn());return tree;};
  const blur=()=>{for(const cleanup of state.focusCleanups.values())cleanup?.();};
  const focus=()=>{for(const fn of state.focus)state.focusCleanups.set(fn,fn());};
  const background=()=>{state.appState='background';for(const fn of state.listeners)fn('background');};
  return {state,props,render,renderWithoutEffects:()=>render(false),blur,focus,background};
}
function nodes(t){return Array.isArray(t)?t.flatMap(nodes):t&&typeof t==='object'?[t,...nodes(t.props?.children)]:[];}
function text(t){return Array.isArray(t)?t.map(text).join(' '):t&&typeof t==='object'?[t.props?.title,t.props?.hint,text(t.props?.children)].filter(Boolean).join(' '):String(t??'');}
const button=(t,label)=>nodes(t).find(n=>n.type==='Button'&&n.props.label===label);
async function ready(){const f=fixture();button(f.render(),'Use an optional photo or voice note').props.onPress();f.state.statusCalls[0].resolve({photo:true,voice:true});await flush();return f;}
async function press(f,label){const b=button(f.render(),label);assert.ok(b,`Missing ${label}`);assert.ok(!b.props.disabled,`Disabled ${label}`);b.props.onPress();await flush();}
test('failed availability is retryable, hides diagnostics and is distinct from disabled',async()=>{const f=fixture();button(f.render(),'Use an optional photo or voice note').props.onPress();f.state.statusCalls[0].reject(Error('secret diagnostic'));await flush();assert.match(text(f.render()),/could not load/);assert.doesNotMatch(text(f.render()),/secret diagnostic|not enabled/);await press(f,'Check capture availability again');f.state.statusCalls[1].resolve({photo:false,voice:false});await flush();assert.match(text(f.render()),/not enabled/);assert.equal(button(f.render(),'Take a food photo'),undefined);});
test('old availability cannot replace the result after leaving and returning',async()=>{const f=fixture();f.render();f.blur();f.focus();f.state.statusCalls[1].resolve({photo:false,voice:false});await flush();f.state.statusCalls[0].resolve({photo:true,voice:true});await flush();button(f.render(),'Use an optional photo or voice note').props.onPress();assert.equal(button(f.render(),'Take a food photo'),undefined);});
test('cancelled replacement consent retains the selected photo without uploading or replacing text',async()=>{const f=await ready();await press(f,'Choose a food photo');f.state.confirm=async()=>false;await press(f,'Send photo for editable draft');assert.equal(f.state.uploads.length,0);assert.equal(f.state.drafts.length,0);assert.ok(button(f.render(),'Send photo for editable draft'));assert.equal(f.state.busy.at(-1),false);});
test('camera denial provides an alternative and releases busy state',async()=>{const f=await ready();f.state.cameraPermission=async()=>({granted:false});await press(f,'Take a food photo');assert.match(text(f.render()),/Camera access was not granted/);assert.equal(f.state.uploads.length,0);assert.equal(button(f.render(),'Choose a food photo').props.disabled,false);});
test('picker app-state changes do not invalidate a consented photo',async()=>{const f=await ready();f.state.picker=async()=>{f.background();return {canceled:false,assets:[{uri:'file:///cache/photo.jpg',mimeType:'image/jpeg',base64:'synthetic'}]};};await press(f,'Choose a food photo');assert.equal(f.state.uploads.length,0);f.state.appState='active';await press(f,'Send photo for editable draft');assert.equal(f.state.drafts.length,1);assert.ok(f.state.deleted.includes('file:///cache/photo.jpg'));});
test('late picker result after blur never uploads and cleans only cache copy',async()=>{const f=await ready();const p=deferred();f.state.picker=()=>p.promise;button(f.render(),'Choose a food photo').props.onPress();await flush();f.blur();p.resolve({canceled:false,assets:[{uri:'file:///cache/photo.jpg',mimeType:'image/jpeg',base64:'synthetic'}]});await flush();assert.equal(f.state.uploads.length,0);assert.ok(f.state.deleted.includes('file:///cache/photo.jpg'));});
test('unsupported media is rejected without deleting original library file',async()=>{const f=await ready();f.state.files.add('file:///photos/original.heic');f.state.picker=async()=>({canceled:false,assets:[{uri:'file:///photos/original.heic',mimeType:'image/heic',base64:'synthetic'}]});await press(f,'Choose a food photo');assert.equal(f.state.uploads.length,0);assert.ok(f.state.files.has('file:///photos/original.heic'));assert.match(text(f.render()),/JPEG, PNG or WebP/);});
test('late provider draft after blur cannot populate another screen',async()=>{const f=await ready();const p=deferred();f.state.send=()=>p.promise;await press(f,'Choose a food photo');await press(f,'Send photo for editable draft');assert.equal(f.state.uploads.length,1);f.blur();p.resolve({draft:{title:'Late'}});await flush();assert.equal(f.state.drafts.length,0);});
test('microphone denial never records or sends and exposes no raw diagnostics',async()=>{const f=await ready();f.state.micPermission=async()=>({granted:false});await press(f,'Record a voice note');assert.equal(f.state.recordCalls,0);assert.equal(f.state.uploads.length,0);assert.match(text(f.render()),/Microphone access was not granted/);});
test('failed recorder preparation restores playback mode and frees controls',async()=>{const f=await ready();f.state.prepare=async()=>{throw Error('private recorder path');};await press(f,'Record a voice note');assert.equal(f.state.modes.at(-1)?.allowsRecording,false);assert.equal(f.state.busy.at(-1),false);assert.doesNotMatch(text(f.render()),/private recorder path/);assert.equal(f.state.uploads.length,0);});
test('background discards recording, clears timer and never uploads',async()=>{const f=await ready();await press(f,'Record a voice note');assert.equal(f.state.recordCalls,1);assert.equal(f.state.timers.size,1);f.background();await flush();assert.equal(f.state.timers.size,0);assert.equal(f.state.uploads.length,0);assert.ok(f.state.deleted.includes('file:///cache/voice.m4a'));assert.equal(button(f.render(),'Send recording for editable draft'),undefined);});
test('background during pending manual stop prevents keeping its late file',async()=>{const f=await ready();await press(f,'Record a voice note');const p=deferred();f.state.stop=()=>p.promise;await press(f,'Stop recording');f.background();p.resolve();await flush();assert.equal(button(f.render(),'Send recording for editable draft'),undefined);assert.ok(f.state.deleted.includes('file:///cache/voice.m4a'));});
test('voice recording requires explicit send, failed send discards media without saving',async()=>{const f=await ready();await press(f,'Record a voice note');await press(f,'Stop recording');assert.equal(f.state.uploads.length,0);f.state.send=async()=>{throw Error('private provider response');};await press(f,'Send recording for editable draft');assert.equal(f.state.uploads.length,1);assert.equal(f.state.drafts.length,0);assert.ok(f.state.deleted.includes('file:///cache/voice.m4a'));assert.match(text(f.render()),/Voice draft unavailable/);assert.doesNotMatch(text(f.render()),/private provider response/);assert.equal(button(f.render(),'Send recording for editable draft'),undefined);});
test('recording time limit stops for review without automatically sending',async()=>{const f=await ready();await press(f,'Record a voice note');[...f.state.timers][0]();await flush();assert.equal(f.state.timers.size,0);assert.equal(f.state.uploads.length,0);assert.ok(button(f.render(),'Send recording for editable draft'));assert.equal(f.state.modes.at(-1).allowsRecording,false);});
test('leaving during recorder preparation does not start recording later',async()=>{const f=await ready();const p=deferred();f.state.prepare=()=>p.promise;await press(f,'Record a voice note');f.blur();p.resolve();await flush();assert.equal(f.state.recordCalls,0);assert.equal(f.state.uploads.length,0);assert.equal(f.state.modes.at(-1).allowsRecording,false);});
test('leaving during file read prevents upload and discards temporary voice file',async()=>{const f=await ready();await press(f,'Record a voice note');await press(f,'Stop recording');const p=deferred();f.state.readFile=()=>p.promise;await press(f,'Send recording for editable draft');f.blur();p.resolve('synthetic');await flush();assert.equal(f.state.uploads.length,0);assert.equal(f.state.drafts.length,0);assert.ok(f.state.deleted.includes('file:///cache/voice.m4a'));});

test('temporary voice cleanup refuses original, sibling, traversal and encoded-separator paths',async()=>{for(const uri of ['file:///photos/original.m4a','file:///cache-sibling/voice.m4a','file:///cache/../photos/original.m4a','file:///cache/nested%2fvoice.m4a','file:///cache/voice.m4a?private=synthetic']){const f=await ready();f.state.recorder.uri=uri;f.state.files.add(uri);await press(f,'Record a voice note');f.background();await flush();assert.ok(f.state.files.has(uri),uri);assert.ok(!f.state.deleted.includes(uri),uri);assert.equal(f.state.uploads.length,0);}});
test('failed native stop discards recording and restores playback without offering media',async()=>{const f=await ready();await press(f,'Record a voice note');f.state.stop=async()=>{throw Error('private native stop details');};await press(f,'Stop recording');await flush();assert.equal(button(f.render(),'Send recording for editable draft'),undefined);assert.ok(f.state.deleted.includes('file:///cache/voice.m4a'));assert.equal(f.state.modes.at(-1).allowsRecording,false);assert.equal(f.state.busy.at(-1),false);assert.doesNotMatch(text(f.render()),/private native stop/);});
test('discard while playback restoration is pending cannot retain the stopped recording',async()=>{const f=await ready();await press(f,'Record a voice note');const gate=deferred();f.state.audioMode=()=>gate.promise;await press(f,'Stop recording');assert.ok(button(f.render(),'Send recording for editable draft'));await press(f,'Discard recording');gate.resolve();await flush();assert.equal(button(f.render(),'Send recording for editable draft'),undefined);assert.ok(f.state.deleted.includes('file:///cache/voice.m4a'));assert.equal(f.state.uploads.length,0);});

test('photo selection previews locally and never sends or replaces a draft by itself', async () => {
  const f = await ready();
  f.state.confirm = () => { throw Error('Choosing a photo must not replace text'); };
  await press(f, 'Choose a food photo');
  const image = nodes(f.render()).find(node => node.type === 'Image');
  assert.equal(image.props.source.uri, 'file:///cache/photo.jpg');
  assert.match(image.props.accessibilityLabel, /not sent/);
  assert.match(text(f.render()), /has not been sent/);
  assert.equal(f.state.uploads.length, 0);
  assert.equal(f.state.drafts.length, 0);
  assert.ok(f.state.files.has('file:///cache/photo.jpg'));
  assert.ok(button(f.render(), 'Send photo for editable draft'));
});

test('camera selection also requires a separate deliberate send', async () => {
  const f = await ready();
  await press(f, 'Take a food photo');
  assert.equal(f.state.uploads.length, 0);
  await press(f, 'Send photo for editable draft');
  assert.equal(f.state.uploads.length, 1);
  assert.equal(f.state.uploads[0][0], 'photo');
  assert.equal(f.state.drafts.length, 1);
  assert.ok(f.state.deleted.includes('file:///cache/photo.jpg'));
  assert.equal(button(f.render(), 'Send photo for editable draft'), undefined);
});

test('duplicate send presses are locked before a rerender', async () => {
  const f = await ready();
  await press(f, 'Choose a food photo');
  const pending = deferred(); f.state.send = () => pending.promise;
  const send = button(f.render(), 'Send photo for editable draft').props.onPress;
  send(); send(); await flush();
  assert.equal(f.state.uploads.length, 1);
  pending.resolve({ draft: { title: 'Synthetic review' } }); await flush();
  assert.equal(f.state.drafts.length, 1);
});

test('failed photo request discards media without automatic retry or raw diagnostic exposure', async () => {
  const f = await ready();
  await press(f, 'Choose a food photo');
  f.state.send = async () => { throw Error('private file path and provider detail'); };
  await press(f, 'Send photo for editable draft');
  assert.equal(f.state.uploads.length, 1);
  assert.equal(f.state.drafts.length, 0);
  assert.equal(button(f.render(), 'Send photo for editable draft'), undefined);
  assert.ok(f.state.deleted.includes('file:///cache/photo.jpg'));
  assert.doesNotMatch(text(f.render()), /private file path|provider detail/);
  assert.equal(f.state.busy.at(-1), false);
});

test('discard clears a selected cache copy without any request', async () => {
  const f = await ready();
  await press(f, 'Choose a food photo');
  const staleSend = button(f.render(), 'Send photo for editable draft').props.onPress;
  await press(f, 'Discard photo'); staleSend(); await flush();
  assert.equal(button(f.render(), 'Send photo for editable draft'), undefined);
  assert.equal(nodes(f.render()).some(node => node.type === 'Image'), false);
  assert.ok(f.state.deleted.includes('file:///cache/photo.jpg'));
  assert.equal(f.state.uploads.length, 0);
});

test('discard never deletes the original selected library photo', async () => {
  const f = await ready(); const uri = 'file:///photos/original.jpg';
  f.state.files.add(uri);
  f.state.picker = async () => ({ canceled: false, assets: [{ uri, mimeType: 'image/jpeg', base64: 'synthetic' }] });
  await press(f, 'Choose a food photo'); await press(f, 'Discard photo');
  assert.ok(f.state.files.has(uri));
  assert.ok(!f.state.deleted.includes(uri));
  assert.equal(f.state.uploads.length, 0);
});

for (const leave of ['background', 'blur', 'hide']) {
  test(`${leave} clears the selected photo and invalidates its retained send action`, async () => {
    const f = await ready(); await press(f, 'Choose a food photo');
    const staleSend = button(f.render(), 'Send photo for editable draft').props.onPress;
    if (leave === 'hide') await press(f, 'Hide photo and voice options');
    else f[leave]();
    staleSend(); await flush();
    assert.ok(f.state.deleted.includes('file:///cache/photo.jpg'));
    assert.equal(f.state.uploads.length, 0);
    if (leave !== 'blur') assert.equal(button(f.render(), 'Send photo for editable draft'), undefined);
  });
}

test('invalid replacement selection cannot leave the previous photo sendable', async () => {
  const f = await ready(); await press(f, 'Choose a food photo');
  const staleSend = button(f.render(), 'Send photo for editable draft').props.onPress;
  f.state.picker = async () => ({ canceled: false, assets: [{ uri: 'file:///cache/invalid.heic', mimeType: 'image/heic', base64: 'synthetic' }] });
  await press(f, 'Choose a food photo'); staleSend(); await flush();
  assert.equal(button(f.render(), 'Send photo for editable draft'), undefined);
  assert.equal(f.state.uploads.length, 0);
  assert.ok(f.state.deleted.includes('file:///cache/photo.jpg'));
});

test('cancelled replacement picker clears the previous temporary selection without a request', async () => {
  const f = await ready(); await press(f, 'Choose a food photo');
  f.state.picker = async () => ({ canceled: true, assets: [] });
  await press(f, 'Choose a food photo');
  assert.equal(button(f.render(), 'Send photo for editable draft'), undefined);
  assert.equal(f.state.uploads.length, 0);
});

test('client replacement withholds the preview and blocks retained send before effect cleanup', async () => {
  const f = await ready(); await press(f, 'Choose a food photo');
  const staleSend = button(f.render(), 'Send photo for editable draft').props.onPress;
  f.props.client = { ...f.props.client };
  const tree = f.renderWithoutEffects();
  assert.equal(nodes(tree).some(node => node.type === 'Image'), false);
  assert.equal(button(tree, 'Send photo for editable draft'), undefined);
  staleSend(); await flush();
  assert.equal(f.state.uploads.length, 0);
  f.render();
  assert.ok(f.state.deleted.includes('file:///cache/photo.jpg'));
});

test('disabling capture blocks a retained send action before effect cleanup', async () => {
  const f = await ready(); await press(f, 'Choose a food photo');
  const staleSend = button(f.render(), 'Send photo for editable draft').props.onPress;
  f.props.disabled = true; f.renderWithoutEffects(); staleSend(); await flush();
  assert.equal(f.state.uploads.length, 0);
});

test('client replacement while replacement consent is pending cannot send old media', async () => {
  const f = await ready(); await press(f, 'Choose a food photo');
  const gate = deferred(); f.state.confirm = () => gate.promise;
  await press(f, 'Send photo for editable draft');
  f.props.client = { ...f.props.client }; f.renderWithoutEffects();
  gate.resolve(true); await flush();
  assert.equal(f.state.uploads.length, 0);
  f.render();
  assert.ok(f.state.deleted.includes('file:///cache/photo.jpg'));
});

test('background during pending replacement consent discards rather than sending later', async () => {
  const f = await ready(); await press(f, 'Choose a food photo');
  const gate = deferred(); f.state.confirm = () => gate.promise;
  await press(f, 'Send photo for editable draft');
  f.background(); gate.resolve(true); await flush();
  assert.equal(f.state.uploads.length, 0);
  assert.ok(f.state.deleted.includes('file:///cache/photo.jpg'));
  assert.equal(f.state.busy.at(-1), false);
});

test('late picker result from a replaced client cannot stage a new preview', async () => {
  const f = await ready(); const gate = deferred(); f.state.picker = () => gate.promise;
  await press(f, 'Choose a food photo');
  f.props.client = { ...f.props.client }; f.renderWithoutEffects();
  gate.resolve({ canceled: false, assets: [{ uri: 'file:///cache/photo.jpg', mimeType: 'image/jpeg', base64: 'synthetic' }] });
  await flush();
  assert.equal(f.state.uploads.length, 0);
  assert.equal(button(f.render(), 'Send photo for editable draft'), undefined);
  assert.ok(f.state.deleted.includes('file:///cache/photo.jpg'));
});

test('a remote picker URI is never mounted as an image network request', async () => {
  const f = await ready();
  f.state.picker = async () => ({ canceled: false, assets: [{ uri: 'https://example.invalid/private.jpg', mimeType: 'image/jpeg', base64: 'synthetic' }] });
  await press(f, 'Choose a food photo');
  assert.equal(nodes(f.render()).some(node => node.type === 'Image'), false);
  assert.equal(f.state.uploads.length, 0);
});

test('pending photo request never continues to claim the photo has not been sent', async () => {
  const f = await ready(); await press(f, 'Choose a food photo');
  const gate = deferred(); f.state.send = () => gate.promise;
  await press(f, 'Send photo for editable draft');
  assert.match(text(f.render()), /Photo sent for an editable draft/);
  assert.doesNotMatch(text(f.render()), /has not been sent/);
  assert.match(text(f.render()), /cannot recall/);
  assert.equal(nodes(f.render()).find(node => node.type === 'Image').props.accessibilityLabel, 'Selected food photo');
  gate.resolve({ draft: { title: 'Synthetic review' } }); await flush();
});

test('retained handler for the previous selection cannot send the replacement photo', async () => {
  const f = await ready(); await press(f, 'Choose a food photo');
  const staleSend = button(f.render(), 'Send photo for editable draft').props.onPress;
  f.state.picker = async () => ({ canceled: false, assets: [{ uri: 'file:///cache/second.jpg', mimeType: 'image/jpeg', base64: 'second-synthetic' }] });
  await press(f, 'Choose a food photo'); staleSend(); await flush();
  assert.equal(f.state.uploads.length, 0);
  await press(f, 'Send photo for editable draft');
  assert.equal(f.state.uploads.length, 1);
  assert.equal(f.state.uploads[0][1], 'second-synthetic');
});

for (const replace of ['background', 'client']) {
  test(`late provider result after ${replace} cannot populate a food draft`, async () => {
    const f = await ready(); await press(f, 'Choose a food photo');
    const gate = deferred(); f.state.send = () => gate.promise;
    await press(f, 'Send photo for editable draft');
    if (replace === 'background') f.background();
    else { f.props.client = { ...f.props.client }; f.renderWithoutEffects(); }
    gate.resolve({ draft: { title: 'Late private suggestion' } }); await flush();
    assert.equal(f.state.drafts.length, 0);
    f.render();
    assert.equal(button(f.render(), 'Send photo for editable draft'), undefined);
  });
}
