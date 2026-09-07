import { CARE_DISCLAIMER, CARE_EFFORTS, CARE_EFFORT_LABELS, CARE_TEXTURES, ALLERGENS, ALLERGEN_LABEL, DIETARY_TAGS, DIETARY_TAG_LABEL, suggestCare, type CareChoices, type DietaryProfile } from '@seconds/core/format';

const choices: CareChoices = {};
const profile: DietaryProfile = { allergens: [], dietaryTags: [] };
const root = document.querySelector<HTMLDivElement>('#choices')!;
const results = document.querySelector<HTMLDivElement>('#results')!;
function select(name: keyof CareChoices, title: string, values: readonly string[], labels: readonly string[] = values) {
  const label = document.createElement('label'); label.textContent = title;
  const input = document.createElement('select');
  input.append(new Option('No preference', ''));
  values.forEach((value, index) => input.append(new Option(labels[index] ?? value, value)));
  input.addEventListener('change', () => { Object.assign(choices, { [name]: input.value || undefined }); render(); });
  label.append(input); root.append(label);
}
select('effort', 'Preparation', CARE_EFFORTS, CARE_EFFORTS.map(v => CARE_EFFORT_LABELS[v]));
select('time', 'Time', ['two','ten','twenty'], ['Two minutes','Ten minutes','Twenty minutes']);
select('temperature','Temperature',['cold','warm','any'],['Cold','Warm','Either']);
select('texture','Texture', CARE_TEXTURES);
select('appetite','Appetite',['small','regular','more'],['Barely there','Something familiar','Something more']);
function checks(kind: 'allergens' | 'dietaryTags', title: string, values: readonly string[], labels: Record<string,string>) {
  const field = document.createElement('fieldset'); const legend = document.createElement('legend'); legend.textContent = title; field.append(legend);
  values.forEach(value => {
    const label = document.createElement('label'); const input = document.createElement('input'); input.type = 'checkbox';
    input.addEventListener('change', () => { const set = new Set<string>(profile[kind]); input.checked ? set.add(value) : set.delete(value); Object.assign(profile,{[kind]:Array.from(set)}); render(); });
    label.append(input, document.createTextNode(labels[value] ?? value)); field.append(label);
  }); document.querySelector('#restrictions')!.append(field);
}
checks('allergens','Avoid these allergens',ALLERGENS,ALLERGEN_LABEL);
checks('dietaryTags','Dietary preferences',DIETARY_TAGS,DIETARY_TAG_LABEL);
function render() {
  results.replaceChildren();
  const ideas = suggestCare(choices, profile);
  if (!ideas.length) results.textContent = 'No match for these choices yet. Your restrictions are unchanged. Choose a familiar food you know works for you, or adjust a preparation preference.';
  ideas.forEach(({label,food,kind}) => {
    const article = document.createElement('article'); const small=document.createElement('p'); small.textContent=`${label} · ${food.minutes} min`;
    const title=document.createElement('h2'); title.textContent=food.title;
    article.append(small,title);
    if(kind==='future') { const hint=document.createElement('p'); hint.textContent=`For your next shopping trip: ${food.shoppingItem}. Nothing is saved while offline.`; article.append(hint); }
    else { const steps=document.createElement('ol'); food.steps.forEach(text=>{const li=document.createElement('li');li.textContent=text;steps.append(li);}); article.append(steps); }
    results.append(article);
  });
}
document.querySelector('#disclaimer')!.textContent=CARE_DISCLAIMER;
render();
