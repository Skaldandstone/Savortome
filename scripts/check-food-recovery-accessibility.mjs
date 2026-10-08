// Actual native Button/Callout/theme semantics and calculated token contrast.
// No rendered layout, OS screen-reader or physical-device acceptance.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';
const mocks={
 'react/jsx-runtime':`export const jsx=(type,props)=>({type,props});export const jsxs=jsx;`,
 'react-native':`export const Pressable='Pressable',Text='Text',View='View',StyleSheet={create:value=>value};`,
 './ThemeProvider':`export const usePalette=()=>state.palette;`,
};
const bundle=await build({stdin:{resolveDir:process.cwd(),contents:`export {Button} from './apps/mobile/ui/Button.tsx';export {Callout} from './apps/mobile/ui/Callout.tsx';export {light,dark} from './apps/mobile/ui/theme.ts';`},bundle:true,write:false,format:'iife',globalName:'app',jsx:'automatic',plugins:[{name:'native-render-boundaries',setup(api){api.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:undefined);api.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js'}));}}]});
function fixture(woodland=false){const state={palette:null};const context={state,process:{env:{EXPO_PUBLIC_WOODLAND_BETA:String(woodland)}}};runInNewContext(bundle.outputFiles[0].text,context);state.palette=context.app.light;return{state,app:context.app};}
const plain=value=>JSON.parse(JSON.stringify(value));
const flatten=styles=>Object.assign({},...styles.flat(Infinity).filter(Boolean));
function luminance(hex){const rgb=hex.slice(1).match(/../g).map(value=>parseInt(value,16)/255).map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4);return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;}
const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+0.05)/(Math.min(luminance(a),luminance(b))+0.05);
test('busy button exposes busy and disabled state while preserving its visible accessible name',()=>{const {app}=fixture();const button=app.Button({label:'Checking device recovery…',busy:true,onPress:()=>{}});assert.equal(button.type,'Pressable');assert.equal(button.props.disabled,true);assert.equal(button.props.accessibilityRole,'button');assert.equal(button.props.accessibilityLabel,'Checking device recovery…');assert.deepEqual(plain(button.props.accessibilityState),{disabled:true,busy:true});});
test('idle and selected buttons preserve labels, override labels and selected semantics',()=>{const {app}=fixture();const button=app.Button({label:'Keep draft',accessibilityLabel:'Keep this food draft on this device',selected:true,onPress:()=>{}});assert.equal(button.props.disabled,false);assert.equal(button.props.accessibilityLabel,'Keep this food draft on this device');assert.deepEqual(plain(button.props.accessibilityState),{disabled:false,selected:true,busy:false});});
test('source button retains 44 point minimum, wrapping text and no font-scaling cap',()=>{const {app}=fixture();const button=app.Button({label:'Discard device recovery and reload account notes',onPress:()=>{}});const style=flatten(button.props.style({pressed:false}));assert.equal(style.minHeight,44);assert.equal(style.maxWidth,'100%');const label=button.props.children;assert.equal(label.type,'Text');assert.equal(label.props.numberOfLines,undefined);assert.notEqual(label.props.allowFontScaling,false);assert.equal(label.props.maxFontSizeMultiplier,undefined);});
test('errors announce assertively; warning/status callouts retain polite announcements',()=>{const {app}=fixture();for(const tone of ['error','warn','info']){const callout=app.Callout({tone,children:'Synthetic recovery status'});assert.equal(callout.props.accessibilityLiveRegion,tone==='error'?'assertive':'polite');assert.equal(callout.props.accessibilityRole,tone==='error'?'alert':undefined);assert.equal(callout.props.children[1].props.children,'Synthetic recovery status');}});
for(const woodland of [false,true]) for(const theme of ['light','dark']) test(`${woodland?'woodland':'legacy'} ${theme}: recovery body/action/status token contrast`,()=>{
 const {app,state}=fixture(woodland);const c=state.palette=app[theme];
 const pairs=[['body',c.text,c.bg],['secondary body',c.textMuted,c.bg],['secondary panel',c.textMuted,c.surface],['primary action',c.onAccent,c.accent],['warning',c.warn,c.warnSoft],['error',c.error,c.errorSoft],['status',c.textMuted,c.surfaceSunken]];
 for(const [name,foreground,background]of pairs)assert.ok(contrast(foreground,background)>=4.5,`${name}: ${contrast(foreground,background).toFixed(2)}:1`);
 const button=app.Button({label:'Restore kept food note',onPress:()=>{}});assert.equal(flatten(button.props.children.props.style).color,c.onAccent);
});
