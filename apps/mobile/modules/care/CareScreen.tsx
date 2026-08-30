import { useEffect, useRef, useState } from 'react';
import { ImageBackground, Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ALLERGENS, ALLERGEN_LABEL, DIETARY_TAGS, DIETARY_TAG_LABEL, CARE_DISCLAIMER, CARE_FOODS, CARE_EFFORTS, CARE_EFFORT_LABELS, CARE_TEXTURES, parseCareLink, suggestCare, type CareChoices, type CareFood, type DietaryProfile } from '@seconds/core/format';
import { useAuth } from '@clerk/expo';
import { createAccountClient } from '@/lib/client';
import { Button, usePalette } from '@/ui';
import { useDecoration } from '@/ui/ThemeProvider';
import { AuthGate } from '@/modules/account';
import { saveCareIdea } from './saveIdea';
import { normalizeCareIntent } from './nativeLink';

export function CareScreen() {
  return process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ? <AccountCare /> : <CareContent accountId={null} />;
}
function AccountCare() {
  const { userId } = useAuth();
  return <CareContent accountId={userId ?? null} />;
}
function CareContent({ accountId }: { accountId: string | null }) {
  const params = useLocalSearchParams();
  const link = parseCareLink(params);
  const [choices, setChoices] = useState<CareChoices>(link);
  const [profile, setProfile] = useState<DietaryProfile>({ allergens: [], dietaryTags: [] });
  const [profileNote, setProfileNote] = useState('Saved restrictions have not loaded. Temporary choices are available below.');
  const [pantry, setPantry] = useState<string[]>([]);
  const [pantryNote, setPantryNote] = useState('');
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const previousAccount = useRef(accountId);
  const [expanded, setExpanded] = useState(false);
  const [restrictions, setRestrictions] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const profileTouched = useRef(false);
  const activeAccount = useRef(accountId); activeAccount.current = accountId;
  const [signInNeeded, setSignInNeeded] = useState(false);
  const [signIn, setSignIn] = useState(false);
  const c = usePalette(); const insets = useSafeAreaInsets(); const router = useRouter();
  const { reduced, toggle } = useDecoration();
  useEffect(() => { setChoices(parseCareLink(params)); }, [params.effort, params.time, params.temperature, params.texture]);
  useEffect(() => {
    // A repeated identical link must reapply its preparation choices even if this
    // mounted screen's local preferences changed after the previous visit.
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const route = normalizeCareIntent(url);
      if (route !== '/care' && !route.startsWith('/care?')) return;
      setChoices(parseCareLink(Object.fromEntries(new URL(route, 'seconds://local').searchParams)));
      setSelectedId(null); setMessage('');
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    const guestChoices = previousAccount.current === null && accountId && profileTouched.current ? profile : null;
    previousAccount.current = accountId;
    profileTouched.current = false;
    setMessage('');
    setSignInNeeded(false);
    setProfile(guestChoices ?? {allergens:[], dietaryTags:[]});
    setPantry([]);
    setProfileNote('Saved restrictions have not loaded. Temporary choices are available below.');
    if (!accountId) { setProfileNote('Sign in to load saved restrictions, or choose temporary restrictions below.'); return; }
    let active = true;
    careRead(createAccountClient(accountId).dietaryProfile()).then(p => { if (active && !profileTouched.current) { setProfile(guestChoices ? {allergens:[...new Set([...p.allergens,...guestChoices.allergens])], dietaryTags:[...new Set([...p.dietaryTags,...guestChoices.dietaryTags])]} : p); setProfileNote(guestChoices ? 'Saved profile and your temporary restrictions applied.' : 'Saved dietary profile applied. Changes here are temporary.'); } }).catch(() => { if (active && !profileTouched.current) setProfileNote('Saved restrictions are unavailable. Suggestions are not checked against your saved profile. Choose temporary restrictions below.'); });
    return () => { active = false; };
  }, [accountId]);
  useEffect(() => {
    if (!choices.usePantry) { setPantry([]); setPantryNote(''); return; }
    if (!accountId) { setPantry([]); setPantryNote('Sign in to load your pantry. Showing general ideas.'); return; }
    setPantryNote('Looking for your pantry...');
    let active = true;
    careRead(createAccountClient(accountId).listPantry()).then(items => { if (active) { setPantry(items.map(x => x.canonicalItem)); setPantryNote(items.length ? 'Matched ingredients appear below. Check what you still have.' : 'Your pantry is empty. Showing general ideas.'); } }).catch(() => { if (active) { setPantry([]); setPantryNote('Pantry unavailable. Showing general ideas.'); } });
    return () => { active = false; };
  }, [choices.usePantry, accountId]);
  const results = suggestCare(choices, { ...profile, pantry });
  const change = (key: keyof CareChoices, value: string | boolean | undefined) => { setChoices(p => ({ ...p, [key]: value })); setMessage(''); };
  async function add(food: CareFood) {
    if (busy) return;
    setSelectedId(food.id); setBusy(true); setSignInNeeded(false); setMessage('');
    try {
      const result = await saveCareIdea(food, { accountId, currentAccount: () => activeAccount.current, write: items => createAccountClient(accountId!).addItemsToList(items) });
      if (result.status === 'superseded') return;
      setMessage(result.message); setSignInNeeded(result.status === 'sign-in');
      if (result.status === 'saved') setSelectedId(null);
    } finally { setBusy(false); }
  }
  const selectedFood = CARE_FOODS.find(food => food.id === selectedId);
  const heading = (text: string) => <Text accessibilityRole="header" style={[styles.heading, { color: c.text }]}>{text}</Text>;
  const text = (value: string) => <Text style={[styles.body, { color: c.textMuted }]}>{value}</Text>;
  return <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }}>
    <View style={styles.top}><Button variant="ghost" label="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} /><Button variant="ghost" label={reduced ? 'Show illustrations' : 'Less decoration'} onPress={toggle} /></View>
    <View style={[styles.hero, { backgroundColor: c.surface, minHeight: reduced ? 0 : 240 }]}>
      {!reduced && <ImageBackground source={require('../../assets/hearth.png')} style={StyleSheet.absoluteFill} imageStyle={{ borderRadius: 18 }} />}
      <View style={[styles.heroCopy, { backgroundColor: reduced ? c.surface : '#10201be6' }]}>
        <Text style={{ color: reduced ? c.accent : '#dfc292', fontSize: 12, letterSpacing: 1.2 }}>A LITTLE CARE, AT YOUR PACE</Text>
        <Text accessibilityRole="header" style={[styles.title, { color: reduced ? c.text : '#f2e8d5' }]}>Feed me gently</Text>
        <Text style={[styles.body, { color: reduced ? c.textMuted : '#f2e8d5' }]}>Something easy is a good place to start.</Text>
      </View>
    </View>
    <Button label={preferencesOpen ? 'Hide preparation preferences' : 'Adjust effort, time and preferences'} variant="ghost" onPress={() => setPreferencesOpen(!preferencesOpen)} />
    {preferencesOpen && <View>
    {heading('How much preparation?')}<View style={styles.wrap}>{CARE_EFFORTS.map(v => <Button key={v} variant="toggle" label={CARE_EFFORT_LABELS[v]} selected={choices.effort === v} onPress={() => change('effort', choices.effort === v ? undefined : v)} />)}</View>
    {heading('How much time?')}<View style={styles.wrap}>{(['two','ten','twenty'] as const).map((v,i) => <Button key={v} variant="toggle" label={['Two minutes','Ten minutes','Twenty minutes'][i] ?? v} selected={choices.time === v} onPress={() => change('time', choices.time === v ? undefined : v)} />)}</View>
    <Button label={expanded ? 'Fewer preferences' : 'A few more preferences'} variant="ghost" onPress={() => setExpanded(!expanded)} />
    {expanded && <View>{heading('Temperature')}<View style={styles.wrap}>{['cold','warm','any'].map(v => <Button key={v} label={v === 'any' ? 'Either' : v} selected={choices.temperature === v} variant="toggle" onPress={() => change('temperature', v)} />)}</View>{heading('Texture')}<View style={styles.wrap}>{CARE_TEXTURES.map(v => <Button key={v} variant="toggle" label={v === 'any' ? 'No preference' : v} selected={choices.texture === v} onPress={() => change('texture', v)} />)}</View>{heading('Appetite')}<View style={styles.wrap}>{['small','regular','more'].map((v,i) => <Button key={v} variant="toggle" label={['Barely there','Something familiar','Something more'][i] ?? v} selected={choices.appetite === v} onPress={() => change('appetite', choices.appetite === v ? undefined : v)} />)}</View></View>}
    <View style={styles.top}><Text style={{ color:c.text, flex:1 }}>Use my saved pantry</Text><Switch accessibilityLabel="Use my saved pantry" value={!!choices.usePantry} onValueChange={value => change('usePantry', value)} /></View>
    {!!pantryNote && text(pantryNote)}
    </View>}
    {choices.usePantry && text('Matches use ingredient names, not quantities or preparation. Check the required form and package directions.')}
    <Button label={restrictions ? 'Hide dietary choices' : 'Dietary choices and allergens'} variant="ghost" onPress={() => setRestrictions(!restrictions)} />
    {restrictions && <View>{heading('Avoid these allergens')}<View style={styles.wrap}>{ALLERGENS.map(v => <Button key={v} label={ALLERGEN_LABEL[v]} variant="toggle" selected={profile.allergens.includes(v)} onPress={() => { profileTouched.current = true; setProfileNote('Temporary choices applied. Your saved profile is unchanged.'); setProfile(p => ({ ...p, allergens: p.allergens.includes(v) ? p.allergens.filter(x => x !== v) : [...p.allergens, v] })); }} />)}</View>{heading('Dietary preferences')}<View style={styles.wrap}>{DIETARY_TAGS.map(v => <Button key={v} label={DIETARY_TAG_LABEL[v]} variant="toggle" selected={profile.dietaryTags.includes(v)} onPress={() => { profileTouched.current = true; setProfileNote('Temporary choices applied. Your saved profile is unchanged.'); setProfile(p => ({ ...p, dietaryTags: p.dietaryTags.includes(v) ? p.dietaryTags.filter(x => x !== v) : [...p.dietaryTags, v] })); }} />)}</View></View>}
    {text(profileNote)}
    {selectedFood && <View style={[styles.selection,{borderColor:c.border}]}>{text(`Selected idea: ${selectedFood.title}. Your choice stays here through sign-in. Check the current restrictions before adding it.`)}</View>}
    {results.length === 0 && <View style={[styles.card,{backgroundColor:c.surface,borderColor:c.border}]}>{heading('No match for these choices yet')}{text('Your restrictions are unchanged. Try another preparation preference, or choose a familiar food you know works for you.')}</View>}
    {results.map(({ kind,label,food,pantryMatches }) => <View key={food.id} style={[styles.card,{backgroundColor:c.surface,borderColor:selectedId===food.id ? c.accent : c.border}]}>
      <Text style={{color:c.accent,fontWeight:'600'}}>{label} · {food.minutes} min</Text>{heading(food.title)}{text(food.description)}
      {text(`Ingredients: ${food.ingredients.join(', ')}.`)}
      {choices.usePantry && pantryMatches > 0 && text(`${pantryMatches} ingredients matched. Other ingredients may still be needed.`)}
      {kind !== 'future' && food.steps.map((step,i) => <Text key={step} style={[styles.body,{color:c.text}]}>{i+1}. {step}</Text>)}
      <Button label={busy && selectedId === food.id ? `Adding ${food.shoppingItem}...` : `Add ${food.shoppingItem} to my list`} disabled={busy} onPress={() => void add(food)} />
    </View>)}
    {!!message && <View accessibilityLiveRegion="polite">{text(message)}{signInNeeded && <Button variant="ghost" label="Sign in and return" onPress={() => setSignIn(true)} />}</View>}
    {signIn && <View><Button variant="ghost" label="Back to my choices" onPress={() => setSignIn(false)} /><AuthGate><View>{text('Signed in. Return to your choices and add the named item when ready.')}<Button label="Return to my choices" onPress={() => setSignIn(false)} /></View></AuthGate></View>}
    {text(CARE_DISCLAIMER)}
    {!!link.return_to && <Button variant="ghost" label="Back to Wispling" onPress={() => { void Linking.openURL(link.return_to!).catch(() => setMessage('Wispling could not open. You can return whenever you like.')); }} />}
    {text('No perfect meals required.')}
  </ScrollView>;
}
const styles = StyleSheet.create({ top:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:10,marginBottom:16}, hero:{borderRadius:18,overflow:'hidden',minHeight:290,justifyContent:'flex-end',marginBottom:20}, heroCopy:{padding:22}, title:{fontFamily:'serif',fontSize:37,lineHeight:44,marginVertical:10}, heading:{fontFamily:'serif',fontSize:24,marginTop:18,marginBottom:10}, body:{fontSize:15,lineHeight:23,marginBottom:12},wrap:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:18},card:{padding:22,borderWidth:1,borderRadius:16,marginVertical:12},selection:{padding:16,borderWidth:1,borderRadius:12,marginTop:16} });

function careRead<T>(request: Promise<T>): Promise<T> {
  return new Promise((resolve,reject) => {
    const timer=setTimeout(()=>reject(new Error('Saved settings timed out')),8000);
    request.then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
  });
}
