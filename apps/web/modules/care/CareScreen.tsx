'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, ALLERGENS, ALLERGEN_LABEL, DIETARY_TAGS, DIETARY_TAG_LABEL, CARE_DISCLAIMER, CARE_EFFORTS, CARE_EFFORT_LABELS, CARE_TEXTURES, parseCareLink, suggestCare, type CareChoices, type CareLink, type CareFood, type DietaryProfile } from '@seconds/core/format';
import { useAuth } from '@clerk/nextjs';
import { api } from '@/lib/client';
import styles from './care.module.css';
import { FoodIllustration } from '@/modules/woodland/FoodIllustration';
import { KitchenIcon } from '@/modules/woodland/KitchenIcon';
import { careReturnRecord, careSignInHref, localCareChoices, restoreCareReturn } from './care-state';

type CareProps = { link: CareLink; standalone?: boolean };
export function CareScreen(props: CareProps) {
  const key = JSON.stringify(parseCareLink(props.link));
  return process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? <AccountCare key={key} {...props} /> : <CareContent key={key} {...props} accountId={null} />;
}
function AccountCare(props: CareProps) {
  const { userId } = useAuth();
  return <CareContent {...props} accountId={userId ?? null} />;
}
function CareContent({ link, standalone = false, accountId }: CareProps & { accountId: string | null }) {
  const [choices, setChoices] = useState<CareChoices>(() => localCareChoices(link));
  const [handoff, setHandoff] = useState(() => parseCareLink(link));
  const [profile, setProfile] = useState<DietaryProfile>({ allergens: [], dietaryTags: [] });
  const [profileState, setProfileState] = useState('Saved restrictions have not loaded. You can choose temporary restrictions below.');
  const [pantry, setPantry] = useState<string[]>([]);
  const [pantryState, setPantryState] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [signInNeeded, setSignInNeeded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const profileTouched = useRef(false);
  const activeAccount = useRef(accountId); activeAccount.current = accountId;
  useEffect(() => {
    // Preparation choices and the selected idea stay in this tab only.
    // Dietary and health information are never persisted in this return record.
    try {
      const raw = sessionStorage.getItem('seconds-care-return');
      sessionStorage.removeItem('seconds-care-return');
      const saved = restoreCareReturn(raw);
      if (saved) { setChoices(saved.choices); setSelectedId(saved.selectedId); setHandoff(saved.link); }
    } catch { /* Storage may be disabled. The screen still works. */ }
  }, []);
  useEffect(() => {
    profileTouched.current = false;
    setMessage('');
    setProfile({ allergens: [], dietaryTags: [] });
    setPantry([]);
    setProfileState('Saved restrictions have not loaded. Temporary choices are available below.');
    if (standalone) return;
    if (!accountId) { setProfileState('Sign in to use your saved dietary profile. You can choose temporary restrictions below; your saved profile is not applied.'); return; }
    let active = true;
    careRequest(api.dietaryProfile()).then(p => { if (active && !profileTouched.current) { setProfile(p); setProfileState('Your saved dietary profile is applied. Changes here are temporary.'); } }).catch(() => { if (active && !profileTouched.current) setProfileState('Saved restrictions are unavailable. Choose temporary restrictions below; suggestions are not checked against your saved profile.'); });
    return () => { active = false; };
  }, [standalone, accountId]);

  useEffect(() => {
    if (!choices.usePantry) { setPantry([]); setPantryState(''); return; }
    let active = true;
    setPantryState('Looking for your pantry...');
    if (standalone) { setPantryState('Your saved pantry is unavailable offline. Showing general ideas.'); return; }
    if (!accountId) { setPantry([]); setPantryState('Sign in to use your saved pantry. Showing general ideas for now.'); return; }
    careRequest(api.listPantry()).then(items => { if (active) { setPantry(items.map(x => x.canonicalItem)); setPantryState(items.length ? 'Matching ingredients are listed below. Check what you still have.' : 'Your pantry is empty. Showing general ideas.'); } }).catch(() => { if (active) { setPantry([]); setPantryState('Your saved pantry is unavailable. Showing general ideas.'); } });
    return () => { active = false; };
  }, [choices.usePantry, standalone, accountId]);

  const results = useMemo(() => suggestCare(choices, { ...profile, pantry }), [choices, profile, pantry]);
  const setChoice = (name: keyof CareChoices, value: string | boolean | undefined) => { setChoices(old => ({ ...old, [name]: value })); setMessage(''); setSignInNeeded(false); };
  async function add(item: CareFood) {
    setSelectedId(item.id); setMessage(''); setSignInNeeded(false);
    if (standalone || !navigator.onLine) { setMessage('You are offline. Keep this idea here and add it when you reconnect. Nothing has been saved.'); return; }
    if (!accountId) { setSignInNeeded(true); setMessage('Sign in to save this idea. Nothing has been added yet.'); return; }
    setBusy(true);
    // A lost response must leave an honest unconfirmed state, not a stuck button.
    // This does not cancel or retry the write; it may already have committed.
    try { await careRequest(api.addItemsToList([{ canonicalItem: item.shoppingItem, displayName: item.shoppingItem }]), 12000); if(activeAccount.current !== accountId) return; setMessage(`${item.shoppingItem} added to your shopping list.`); }
    catch (error) {
      if (activeAccount.current !== accountId) return;
      const authError = (error instanceof ApiError && error.status === 401) || (error instanceof Error && /sign in|401|Clerk is not configured/i.test(error.message));
      setSignInNeeded(authError); setMessage(authError ? 'Sign in to save this idea. Your choice will stay here; nothing has been added yet.' : 'We could not confirm the list update. Your choice is still here. Check your list before trying again.');
    } finally { setBusy(false); }
  }
  function saveReturn() {
    try { sessionStorage.setItem('seconds-care-return', JSON.stringify(careReturnRecord(handoff, choices, selectedId))); } catch { /* best effort, no private profile persistence */ }
  }

  const feedback = message ? <div className={styles.feedback} role="status"><p>{message}</p>{signInNeeded && <a href={careSignInHref(handoff)} onClick={saveReturn}>Sign in and return</a>}</div> : null;

  return <main className={styles.care}>
    <header className={styles.intro}>
      <h1><KitchenIcon name="sprig" />Feed me gently<KitchenIcon name="sprig" /></h1>
      <p>Something easy is a good place to start.</p>
    </header>
    <section className={styles.choices} aria-label="Optional food choices">
      <label className={styles.quickChoice}><KitchenIcon name="sprig" /><span>Preparation<select aria-label="How much preparation?" value={choices.effort ?? ''} onChange={e => setChoice('effort', e.target.value || undefined)}><option value="">No preference</option>{CARE_EFFORTS.map(v => <option key={v} value={v}>{CARE_EFFORT_LABELS[v]}</option>)}</select></span></label>
      <label className={styles.quickChoice}><KitchenIcon name="clock" /><span>Time<select aria-label="How much time?" value={choices.time ?? ''} onChange={e => setChoice('time', e.target.value || undefined)}><option value="">Up to twenty minutes</option><option value="two">Two minutes</option><option value="ten">Ten minutes</option><option value="twenty">Twenty minutes</option></select></span></label>
    </section>
    <details className={styles.moreChoices}><summary>A few more preferences<KitchenIcon name="plus" /></summary><div className={styles.additionalChoices}>
      <label>Temperature<select value={choices.temperature ?? 'any'} onChange={e => setChoice('temperature', e.target.value)}><option value="any">Either</option><option value="cold">Cold</option><option value="warm">Warm</option></select></label>
      <label>Texture<select value={choices.texture ?? 'any'} onChange={e => setChoice('texture', e.target.value)}>{CARE_TEXTURES.map(v => <option key={v} value={v}>{v === 'any' ? 'No preference' : v}</option>)}</select></label>
      <label>Appetite<select value={choices.appetite ?? ''} onChange={e => setChoice('appetite', e.target.value || undefined)}><option value="">No preference</option><option value="small">Barely there</option><option value="regular">Something familiar</option><option value="more">Something more</option></select></label>
      <label className={styles.check}><input type="checkbox" checked={!!choices.usePantry} onChange={e => setChoice('usePantry', e.target.checked)} />Use my saved pantry</label>
    </div></details>
    {pantryState && <p className={styles.note} role="status">{pantryState}</p>}
    {choices.usePantry && <p className={styles.note}>Matches use ingredient names, not quantities or preparation. Check the required form and package directions.</p>}
    <details className={styles.restrictions} onChange={() => { profileTouched.current = true; setProfileState('Temporary choices applied. Changes here do not update your saved profile.'); }}><summary>Dietary choices and allergens{profile.allergens.length + profile.dietaryTags.length > 0 ? ` (${profile.allergens.length + profile.dietaryTags.length} applied)` : ''}<KitchenIcon name="plus" /></summary>
      <p>{profileState}</p><fieldset><legend>Avoid these allergens</legend><div className={styles.checks}>{ALLERGENS.map(v => <label className={styles.check} key={v}><input type="checkbox" checked={profile.allergens.includes(v)} onChange={e => setProfile(p => ({ ...p, allergens: e.target.checked ? [...p.allergens, v] : p.allergens.filter(x => x !== v) }))} />{ALLERGEN_LABEL[v]}</label>)}</div></fieldset>
      <fieldset><legend>Dietary preferences</legend><div className={styles.checks}>{DIETARY_TAGS.map(v => <label className={styles.check} key={v}><input type="checkbox" checked={profile.dietaryTags.includes(v)} onChange={e => setProfile(p => ({ ...p, dietaryTags: e.target.checked ? [...p.dietaryTags, v] : p.dietaryTags.filter(x => x !== v) }))} />{DIETARY_TAG_LABEL[v]}</label>)}</div></fieldset>
    </details>
    <p className={styles.note}>{profileState}</p>
    <h2 className={styles.sectionTitle}>What feels right for you?</h2>
    {selectedId && <p className={styles.note} role="status">{results.some(result => result.food.id === selectedId) ? 'Your selected idea is marked below. Selecting it does not save it to your list.' : 'Your earlier selection is kept in this tab, but is not shown because these choices or restrictions changed the suggestions.'}</p>}
    <section className={styles.results} aria-label="Food suggestions" aria-live="polite">
      {results.length === 0 && <div className={styles.empty}><h2>No match for these choices yet</h2><p>We have kept your restrictions. You can change a preparation preference, or choose a familiar food you know works for you.</p></div>}
      {results.map(({ kind, label, food, pantryMatches }) => <details className={styles.card} key={food.id} data-kind={kind} data-selected={selectedId === food.id}>
        <summary className={styles.cardSummary}>
          <FoodIllustration foodId={food.id} className={styles.foodArt} />
          <span className={styles.cardHeading}><span className={styles.slot}>{label}</span><span className={styles.foodTitle}>{food.title}</span><span className={styles.time}><KitchenIcon name="clock" />{food.minutes} min</span>{selectedId === food.id && <span className={styles.selected}>Selected idea</span>}</span>
          <KitchenIcon name="arrow" className={styles.chevron} />
        </summary>
        <div className={styles.cardBody}>
          <h3>{food.title}</h3><p>{food.description}</p>
          <p><strong>Ingredients:</strong> {food.ingredients.join(', ')}.</p>
          {choices.usePantry && pantryMatches > 0 && <p className={styles.note}>{pantryMatches} ingredient{pantryMatches === 1 ? '' : 's'} matched in your pantry. Other ingredients may still be needed.</p>}
          {kind !== 'future' ? <ol>{food.steps.map(step => <li key={step}>{step}</li>)}</ol> : <><p>A small thing to have on hand, whenever you next shop.</p><ol>{food.steps.map(step => <li key={step}>{step}</li>)}</ol></>}
          <p className={styles.note}>The list action adds {food.shoppingItem} only. Check any other ingredients you need.</p>
          <button className={styles.action} aria-label={`Add ${food.shoppingItem} to my list for ${food.title}`} disabled={busy} onClick={() => void add(food)}>{busy && selectedId === food.id ? 'Adding...' : `Add ${food.shoppingItem} to my list`}</button>
          {selectedId === food.id && feedback}
        </div>
      </details>)}
    </section>
    {!results.some(result => result.food.id === selectedId) && feedback}
    <aside className={styles.kindness}><KitchenIcon name="sprig" /><p>A little is welcome.<br />No perfect meals required.</p></aside>
    <p className={styles.disclaimer}>{CARE_DISCLAIMER} Illustrations are examples, not ingredient or packaging checks.</p>
    <footer className={styles.footer}>{handoff.return_to && <a href={handoff.return_to}>Back to Wispling</a>}<a href="/cook">Back to cooking</a></footer>
  </main>;
}

function careRequest<T>(request: Promise<T>, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve,reject) => {
    const timer=setTimeout(()=>reject(new Error('Care request timed out')),timeoutMs);
    request.then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
  });
}
