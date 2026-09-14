// Native component contracts, not an emulator, screenshot or visual acceptance.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const built = await build({ absWorkingDir:root, bundle:true,write:false,platform:'node',format:'iife',globalName:'native',jsx:'automatic',
  stdin:{resolveDir:root,contents:`export * from './apps/mobile/modules/woodland/Artwork.tsx'; export * from './apps/mobile/modules/care/CareIdeaCard.tsx'; export * from './apps/mobile/modules/woodland/KitchenWelcome.tsx'; export * from './apps/mobile/modules/pantry/PantryChips.tsx'; export * from './apps/mobile/modules/pantry/PantryReviewQueue.tsx'; export {CARE_FOODS as TEST_CARE_FOODS} from './packages/core/src/care.ts'; export {light,dark} from './apps/mobile/ui/theme.ts';`},
  plugins:[{name:'native-boundaries',setup(api){
    const stubs={
      'react':`export const useState = initial => {const slot=state.cursor++;if(!(slot in state.values))state.values[slot]=typeof initial==='function'?initial():initial;return [state.values[slot],value=>{state.values[slot]=typeof value==='function'?value(state.values[slot]):value;}];};`,
      'react/jsx-runtime':`export const jsx = (type,props)=>({type,props});export const jsxs=jsx;export const Fragment='Fragment';`,
      'react-native':`export const Image='Image',Text='Text',View='View',Pressable='Pressable',Switch='Switch';export const Linking={openURL:url=>state.links.push(url)};export const useWindowDimensions=()=>({width:state.width,fontScale:state.fontScale});export const StyleSheet={create:x=>x,absoluteFill:{position:'absolute',top:0,left:0,right:0,bottom:0}};`,
      '@/ui':`export * from '${root.replaceAll('\\','/') + 'apps/mobile/ui/theme.ts'}';export const usePalette=()=>state.palette;export const Button='Button',Field='Field';`,
      '@/ui/ThemeProvider':`export const useDecoration=()=>({reduced:state.reduced,toggle:()=>{state.reduced=!state.reduced;}});export const PaletteScope='PaletteScope';`,
      'expo-router':`export const useRouter=()=>({push:path=>state.navigation.push(path)});`,
    };
    api.onResolve({filter:/.*/},args=>{
      if(Object.hasOwn(stubs,args.path))return {path:args.path,namespace:'fixture'};
      if(args.path.endsWith('.webp'))return {path:args.path,namespace:'asset'};
      if(args.path==='@/modules/woodland/Artwork')return {path:root+'apps/mobile/modules/woodland/Artwork.tsx'};
    });
    api.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:stubs[args.path],loader:'js',resolveDir:root}));
    api.onLoad({filter:/.*/,namespace:'asset'},args=>({contents:JSON.stringify(args.path),loader:'json'}));
  }}],
});
function fixture({beta=true,reduced=false,fontScale=1}={}){
  const state={reduced,fontScale,width:390,cursor:0,values:[],navigation:[],links:[],palette:{surface:'#191e1b',surfaceSunken:'#222620',accentSoft:'#393227',text:'#eddfc5',textMuted:'#c0af92',border:'#766347',accent:'#e1ba7d',warn:'#edc986'}};
  const context={state,process:{env:{EXPO_PUBLIC_WOODLAND_BETA:String(beta)}}};runInNewContext(built.outputFiles[0].text,context);
  state.palette=context.native.dark;
  return {state,api:context.native,render:(component,props)=>{state.cursor=0;return context.native[component](props);}};
}
function nodes(tree){if(!tree || typeof tree!=='object')return [];if(Array.isArray(tree))return tree.flatMap(nodes);return [tree,...nodes(tree.props?.children)];}
function textOf(tree){if(tree==null)return '';if(typeof tree==='string'||typeof tree==='number')return String(tree);if(Array.isArray(tree))return tree.map(textOf).join(' ');return textOf(tree.props?.children);}
test('authored food cells map only to catalogue IDs and missing art collapses cleanly',()=>{
  const f=fixture();assert.ok(f.api.TEST_CARE_FOODS.length>=14);
  const catalogue=new Set(f.api.TEST_CARE_FOODS.map(food=>food.id));
  for(const id of Object.keys(f.api.FOOD_ART_CELLS))if(id!=='journal')assert.ok(catalogue.has(id));
  assert.equal(f.render('FoodIllustration',{foodId:'vegetable_soup'}),null);
  assert.equal(f.render('FoodIllustration',{foodId:'tomato-soup'}),null);
  assert.equal(f.render('FoodIllustration',{foodId:'constructor'}),null);
});
test('reduced decoration and non-beta builds do not mount food art or timber',()=>{
  for(const options of [{reduced:true},{beta:false}]){
    const f=fixture(options);assert.equal(f.render('FoodIllustration',{foodId:'yogurt'}),null);assert.equal(f.render('TimberWash',{}),null);
  }
});
test('food atlas is decorative and a failed asset removes its occupied frame',()=>{
  const f=fixture();const tree=f.render('FoodIllustration',{foodId:'beans',size:100});assert.equal(tree.props.importantForAccessibility,'no-hide-descendants');
  const picture=nodes(tree).find(n=>n.type==='Image');assert.equal(picture.props.style.left,-100);assert.equal(picture.props.style.top,-200);
  picture.props.onError();assert.equal(f.render('FoodIllustration',{foodId:'beans',size:100}),null);
});
test('Future me expands all exact ingredients and steps and labels only its single shopping item',()=>{
  const f=fixture();const food=f.api.TEST_CARE_FOODS.find(x=>x.id==='beans');let writes=0;
  const props={food,label:'Future me',pantryMatches:1,usePantry:true,selected:false,busy:false,onAdd:()=>{writes++;}};
  let tree=f.render('CareIdeaCard',props);const button=nodes(tree).find(n=>n.type==='Pressable');assert.equal(button.props.accessibilityState.expanded,false);
  assert.equal(writes,0);button.props.onPress();tree=f.render('CareIdeaCard',props);const content=textOf(tree);
  for(const step of food.steps)assert.ok(content.includes(step));for(const ingredient of food.ingredients)assert.ok(content.includes(ingredient));
  const add=nodes(tree).find(n=>n.type==='Button');assert.equal(add.props.label,`Add ${food.shoppingItem} to my list`);add.props.onPress();assert.equal(writes,1);
});
test('enlarged care text removes illustration and does not clamp labels or step text',()=>{
  const f=fixture({fontScale:2});const food=f.api.TEST_CARE_FOODS[0];const tree=f.render('CareIdeaCard',{food,label:'Right now',pantryMatches:0,usePantry:false,selected:false,busy:false,onAdd:()=>{}});
  assert.equal(nodes(tree).some(n=>n.type===f.api.FoodIllustration),false);assert.equal(nodes(tree).some(n=>n.props.numberOfLines!==undefined),false);
});
test('paper applies readable ink while reduced decoration retains the selected palette',()=>{
  const full=fixture();const tree=full.render('PaperPanel',{children:'Native ingredient text'});
  assert.equal(nodes(tree).find(n=>n.type==='PaletteScope').props.palette.text,'#302b21');
  const simple=fixture({reduced:true});const quiet=simple.render('PaperPanel',{children:'Native ingredient text'});
  assert.equal(nodes(quiet).some(n=>n.type==='Image'),false);assert.equal(nodes(quiet).find(n=>n.type==='PaletteScope').props.palette,simple.state.palette);
});
test('kitchen entry stays reachable with illustrations off',()=>{
  const f=fixture({reduced:true});const tree=f.render('KitchenWelcome',{});assert.equal(nodes(tree).some(n=>n.type==='Image'),false);
  const care=nodes(tree).find(n=>n.type==='Pressable');assert.ok(textOf(care).includes('Feed me gently'));care.props.onPress();assert.deepEqual(f.state.navigation,['/care']);
});
test('mobile pantry memory keeps correction actions named and guidance qualified',()=>{
  const f=fixture();const updates=[];const removals=[];const props={items:[{canonicalItem:'banana',displayName:'bananas',quantity:6,unit:null,isStaple:false,isUsual:false,storageLocation:'unknown',acquiredAt:'2026-09-01T00:00:00.000Z',lastConfirmedAt:null,updatedAt:'2026-09-01T00:00:00.000Z'}],onAdd(){},onUpdate:value=>updates.push(value),onRemove:value=>removals.push(value),onClear(){}};let tree=f.render('PantryChips',props);
  const content=textOf(tree);assert.match(content,/not expiry or food-safety guarantees/i);assert.match(content,/USDA produce storage guidance/);
  const usual=nodes(tree).find(n=>n.type==='Switch');assert.match(usual.props.accessibilityLabel,/Usually keep bananas/);usual.props.onValueChange(true);
  const fridge=nodes(tree).find(n=>n.type==='Pressable'&&n.props.accessibilityLabel==='bananas: Fridge');assert.equal(fridge.props.accessibilityRole,'radio');fridge.props.onPress();
  const confirm=nodes(tree).find(n=>n.type==='Button'&&n.props.label==='Still have bananas');confirm.props.onPress();
  const promptSwitch=nodes(tree).find(n=>n.type==='Switch'&&/freshness prompts/.test(n.props.accessibilityLabel));promptSwitch.props.onValueChange(false);
  nodes(tree).find(n=>n.type==='Button'&&n.props.label==='Used some').props.onPress();tree=f.render('PantryChips',props);
  nodes(tree).find(n=>n.type==='Field'&&n.props.accessibilityLabel==='Remaining amount of bananas').props.onChangeText('4');tree=f.render('PantryChips',props);
  nodes(tree).find(n=>n.type==='Button'&&n.props.label==='Save amount').props.onPress();
  nodes(tree).find(n=>n.type==='Button'&&n.props.label==='All gone').props.onPress();
  nodes(tree).find(n=>n.type==='Button'&&n.props.label==='Remind me in 3 days').props.onPress();
  nodes(tree).find(n=>n.type==='Button'&&n.props.label==='Hide this suggestion').props.onPress();
  assert.deepEqual(JSON.parse(JSON.stringify(updates)),[{canonicalItem:'banana',isUsual:true},{canonicalItem:'banana',storageLocation:'refrigerator'},{canonicalItem:'banana',confirmPresent:true},{canonicalItem:'banana',resurfaceHidden:true},{canonicalItem:'banana',quantity:4,unit:null,confirmPresent:true},{canonicalItem:'banana',snoozeDays:3},{canonicalItem:'banana',resurfaceHidden:true}]);assert.deepEqual(removals,['banana']);
});
test('mobile grocery review requires an explicit checked selection',async()=>{
  const f=fixture();const calls=[];const tree=f.render('PantryReviewQueue',{intakes:[{id:'intake',source:'receipt',sourceLabel:'Neighborhood market',acquiredAt:null,status:'pending',createdAt:'2026-09-13T00:00:00.000Z',items:[{id:'item',canonicalItem:'banana',displayName:'bananas',quantity:6,unit:null}]}],onResolve:async(...args)=>{calls.push(args);return true;}});
  assert.match(textOf(tree),/Nothing enters your pantry until you confirm/);
  const card=nodes(tree).find(n=>typeof n.type==='function'&&n.type.name==='ReviewCard');f.state.cursor=0;const rendered=card.type(card.props);
  const checkbox=nodes(rendered).find(n=>n.type==='Pressable');assert.equal(checkbox.props.accessibilityRole,'checkbox');assert.equal(checkbox.props.accessibilityState.checked,true);
  const add=nodes(rendered).find(n=>n.type==='Button'&&n.props.label==='Add selected items');add.props.onPress();await new Promise(resolve=>setTimeout(resolve,0));assert.deepEqual(JSON.parse(JSON.stringify(calls)),[['intake','accept',['item']]]);
});
test('mobile keeps its reviewed art while web derivatives follow the current encoding report',async()=>{
  const reviewedMobile={
    'kitchen-scene':'7c27f1c204647d690c0126d637453e179e945640f9f51dbac4c61d638768fb5b',
    'food-atlas':'cb96b0f9d3262f4f593c3b8db2051336758c04eaedcef0f50a049ef1b1d7697c',
    'timber':'b58046618f7c5597cfd04697c356c4a9eff03a5b4848bae2417da45eff9c88a6',
    'parchment':'5546ede20f7a470a059496332108661ef19b98ce1bc40aba69684afe8c9ee837',
  };
  const report=JSON.parse(await readFile(root+'docs/beta/checks/web-concept-encoding.json','utf8'));
  assert.equal(report.quality,82);assert.equal(report.dimensionsPreserved,true);assert.equal(report.records.length,4);
  for(const [name,mobileSha] of Object.entries(reviewedMobile)){
    const [mobile,web,png]=await Promise.all([
      readFile(root+'apps/mobile/assets/woodland/'+name+'.webp'),
      readFile(root+'apps/web/public/woodland/'+name+'.webp'),
      readFile(root+'apps/web/public/woodland/'+name+'.png'),
    ]);
    const record=report.records.find(entry=>entry.target.endsWith('/'+name+'.webp'));
    assert.ok(record);assert.equal(createHash('sha256').update(mobile).digest('hex'),mobileSha);
    assert.equal(createHash('sha256').update(web).digest('hex'),record.targetSha256);
    assert.equal(createHash('sha256').update(png).digest('hex'),record.sourceSha256);
  }
});
const luminance=hex=>hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4).reduce((n,x,i)=>n+x*[0.2126,0.7152,0.0722][i],0);
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
test('both themes meet body and primary-action text contrast before texture',()=>{
  const f=fixture();for(const palette of [f.api.light,f.api.dark]){
    assert.ok(contrast(palette.text,palette.surface)>=4.5);assert.ok(contrast(palette.textMuted,palette.surface)>=4.5);
    assert.ok(contrast(palette.onAccent,palette.accent)>=4.5);assert.ok(contrast(palette.actionText,palette.actionSurface)>=4.5);
  }
});
test('review build defaults to preserved arm64 and allows a distinct x86 emulator artifact',async()=>{
  const script=await readFile(root+'apps/mobile/scripts/build-android-review.ps1','utf8');
  assert.match(script,/ValidateSet\('arm64-v8a', 'x86_64'\)/);
  assert.match(script,/\[string\]\$Architecture = 'arm64-v8a'/);
  assert.match(script,/"-PreactNativeArchitectures=\$Architecture"/);
  assert.match(script,/\$bundleInputs = @\(\$Configuration, \$Architecture,/);
  assert.match(script,/Copy-Item -LiteralPath/);
});
test('Android review source blocks storage and overlay permissions the beta does not use',async()=>{
  const config=JSON.parse(await readFile(root+'apps/mobile/app.json','utf8'));
  assert.equal(config.expo.android.allowBackup,false);
  assert.deepEqual(config.expo.android.blockedPermissions,[
    'android.permission.READ_EXTERNAL_STORAGE',
    'android.permission.WRITE_EXTERNAL_STORAGE',
    'android.permission.SYSTEM_ALERT_WINDOW',
  ]);
  assert.deepEqual(config.expo.android.permissions,['android.permission.CAMERA','android.permission.POST_NOTIFICATIONS']);
  const picker=config.expo.plugins.find(plugin=>Array.isArray(plugin)&&plugin[0]==='expo-image-picker');
  assert.ok(picker);assert.equal(picker[1].microphonePermission,false);
  assert.match(picker[1].cameraPermission,/receipt photo for review/i);
  assert.match(picker[1].photosPermission,/receipt photo for review/i);
});
