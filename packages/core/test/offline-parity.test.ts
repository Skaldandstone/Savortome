import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestCare, type CareChoices } from '../src/care.js';
const bundle=readFileSync(new URL('../../../apps/web/public/care-offline.js',import.meta.url),'utf8');
class Element {
  children:Element[]=[];textContent='';value='';checked=false;listeners:Record<string,()=>void>={};
  constructor(public tag:string){}
  append(...children:Element[]){this.children.push(...children);}
  replaceChildren(){this.children=[];this.textContent='';}
  addEventListener(name:string,listener:()=>void){this.listeners[name]=listener;}
}
function render(choices:CareChoices){
  const roots=Object.fromEntries(['choices','results','restrictions','disclaimer'].map(name=>[name,new Element(name)]));
  runInNewContext(bundle,{document:{querySelector:(selector:string)=>roots[selector.slice(1)],createElement:(tag:string)=>new Element(tag),createTextNode:(text:string)=>Object.assign(new Element('text'),{textContent:text})},Option:class extends Element{constructor(label:string,value:string){super('option');this.textContent=label;this.value=value;}}});
  for(const [index,key] of ['effort','time','temperature','texture','appetite'].entries()){
    const value=choices[key as keyof CareChoices];if(value===undefined)continue;
    const select=roots.choices!.children[index]!.children[0]!;select.value=String(value);select.listeners.change!();
  }
  return roots;
}
test('generated offline catalogue matches current shared ranking across strict choices',()=>{
  for(const choices of [{},{effort:'open'},{effort:'open',temperature:'warm'},{time:'two',texture:'crunchy'},{effort:'microwave',time:'ten',temperature:'warm'},{appetite:'small',texture:'soft'}] as CareChoices[]){
    const roots=render(choices);const actual=roots.results!.children.map(article=>article.children.find(child=>child.tag==='h2')!.textContent);
    assert.deepEqual(actual,suggestCare(choices,{allergens:[],dietaryTags:[]}).map(x=>x.food.title));
    assert.ok(roots.disclaimer!.textContent.length>0);
    if(!actual.length)assert.match(roots.results!.textContent,/restrictions are unchanged/);
  }
});
test('generated worker contains the current audited worker source',()=>{
  const generated=readFileSync(new URL('../../../apps/web/public/sw.js',import.meta.url),'utf8');
  const source=readFileSync(new URL('../../../apps/web/modules/offline/worker.js',import.meta.url),'utf8');
  assert.ok(generated.endsWith(source),'Run node scripts/build-care-offline.mjs after worker edits.');
});
