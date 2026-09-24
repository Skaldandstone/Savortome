import { useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  COOK_TIERS,
  COOK_TIER_FOOTNOTE,
  COOK_TIER_LABEL,
  COOK_TIER_QUOTE,
  KITCHEN_SKILLS,
  KITCHEN_SKILL_LABEL,
  KITCHEN_STOCKS,
  KITCHEN_STOCK_HINT,
  KITCHEN_STOCK_LABEL,
  SKILL_LEVELS,
  type CookProfile,
  type CookTier,
  type KitchenSkill,
  type KitchenStock,
  type SkillLevel,
} from "@seconds/core/format";
import {
  ONBOARDING_STEPS,
  completeOnboardingStep,
  emptyOnboardingProgress,
  onboardingStorageScope,
  readOnboardingProgress,
  revisitOnboardingStep,
  type OnboardingProgress,
  type OnboardingStep,
} from "@seconds/core/onboarding";
import { createAccountClient } from "@/lib/client";
import { Button, Callout, Panel, radius, space, type as typeScale, usePalette } from "@/ui";

const STEP_LABEL: Record<OnboardingStep, string> = {
  welcome: "Start with something useful",
  safety: "Food choices and safety",
  cooking: "Cooking at your pace",
};

export function OnboardingJourney() {
  const { userId } = useAuth();
  const router = useRouter();
  const c = usePalette();
  const storageKey = useMemo(() => userId ? `savortome:onboarding:v1:${onboardingStorageScope(userId)}` : null, [userId]);
  const [progress, setProgress] = useState<OnboardingProgress>(emptyOnboardingProgress);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let active = true;
    setReady(false);
    if (!storageKey) return () => { active = false; };
    void AsyncStorage.getItem(storageKey)
      .then(value => { if (active) setProgress(readOnboardingProgress(value)); })
      .catch(() => { if (active) setStatus("Progress could not be loaded. You can still use the guide."); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [storageKey]);

  function store(next: OnboardingProgress, message = "Progress saved on this device.") {
    setProgress(next);
    if (!storageKey) return;
    void AsyncStorage.setItem(storageKey, JSON.stringify(next))
      .then(() => setStatus(message))
      .catch(() => setStatus("This device could not save your progress. You can still continue."));
  }

  function complete(step: OnboardingStep) {
    store(completeOnboardingStep(progress, step));
  }

  if (!ready) return <View style={[styles.loading, { backgroundColor: c.bg }]}><Text accessibilityRole="alert" style={{ color: c.textMuted }}>Opening your getting-started guide…</Text></View>;

  if (progress.finished) return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.content}>
      <Panel><Text accessibilityRole="header" style={[styles.title, { color: c.accent }]}>Your kitchen is ready when you are</Text><Text style={[styles.body, { color: c.text }]}>You can change every choice later. Nothing here grades your cooking or expects a perfect setup.</Text><View style={styles.actions}><Button label="Open my recipe journal" onPress={() => router.replace("/")} /><Button label="Review this guide" variant="ghost" onPress={() => store(revisitOnboardingStep(progress, "welcome"), "Guide reopened.")} /></View></Panel>
    </ScrollView>
  );

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.content}>
      <View accessibilityRole="tablist" accessibilityLabel="Getting started sections" style={styles.stepList}>
        {ONBOARDING_STEPS.map(step => <Pressable key={step} accessibilityRole="tab" accessibilityState={{ selected: progress.current === step }} onPress={() => store(revisitOnboardingStep(progress, step), `${STEP_LABEL[step]} opened.`)} style={[styles.step, { borderColor: c.border, backgroundColor: progress.current === step ? c.accentSoft : c.surface }]}><Text style={{ color: progress.current === step ? c.accent : c.text }}>{progress.completed.includes(step) ? "✓ " : ""}{STEP_LABEL[step]}</Text></Pressable>)}
      </View>
      {progress.current === "welcome" ? <WelcomeStep onChoose={(path) => { complete("welcome"); router.push(path); }} onContinue={() => complete("welcome")} /> : null}
      {progress.current === "safety" ? <SafetyStep onProfile={() => { complete("safety"); router.push("/profile"); }} onContinue={() => complete("safety")} /> : null}
      {progress.current === "cooking" && userId ? <CookingStep userId={userId} onDone={() => complete("cooking")} /> : null}
      {status ? <Text accessibilityRole="alert" style={[styles.status, { color: c.textMuted }]}>{status}</Text> : null}
    </ScrollView>
  );
}

function WelcomeStep({ onChoose, onContinue }: { onChoose: (path: "/recipe/new" | "/plan" | "/care") => void; onContinue: () => void }) {
  const c = usePalette();
  return <Panel><Text style={[styles.eyebrow, { color: c.textMuted }]}>WELCOME TO SAVORTOME</Text><Text accessibilityRole="header" style={[styles.title, { color: c.accent }]}>What would make food easier today?</Text><Text style={[styles.body, { color: c.text }]}>Start with one useful thing. We will explain each choice when it becomes relevant, and you can skip the rest.</Text><View style={styles.choices}><Choice title="Save a recipe" body="Write one down or bring in a link." onPress={() => onChoose("/recipe/new")} /><Choice title="Plan a meal" body="Put one meal on the week and build from there." onPress={() => onChoose("/plan")} /><Choice title="Feed me gently" body="Begin with manageable food ideas. Cooking scores never appear there." onPress={() => onChoose("/care")} /></View><Button label="Continue" onPress={onContinue} /></Panel>;
}

function SafetyStep({ onProfile, onContinue }: { onProfile: () => void; onContinue: () => void }) {
  const c = usePalette();
  return <Panel><Text style={[styles.eyebrow, { color: c.textMuted }]}>FOOD CHOICES AND SAFETY</Text><Text accessibilityRole="header" style={[styles.title, { color: c.accent }]}>Tell us only what helps</Text><Text style={[styles.body, { color: c.text }]}>Preferences shape suggestions. Selected allergens remove conflicts we can detect from ingredient names. Leaving everything blank is fine.</Text><Callout tone="warn">Savortome cannot verify that a food is safe. Check the food, its label, substitutions, and cross-contact information.</Callout><Text style={[styles.body, { color: c.text }]}>We do not ask for or infer a diagnosis, medication, neurotype, health history, or whether you ate a suggestion.</Text><View style={styles.actions}><Button label="Set my food choices" onPress={onProfile} /><Button label="I’ll do this later" variant="ghost" onPress={onContinue} /></View></Panel>;
}

export function CookingStep({ userId, onDone }: { userId: string; onDone: () => void }) {
  const c = usePalette();
  const client = useMemo(() => createAccountClient(userId), [userId]);
  const [profile, setProfile] = useState<CookProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const requestVersion = useRef(0);

  useEffect(() => { let active = true; const version = ++requestVersion.current; setProfile(null); setLoading(true); setSaving(false); setError(""); void client.cookingProfile().then(value => { if (active && requestVersion.current === version) setProfile(value); }).catch(() => { if (active && requestVersion.current === version) setError("Your saved cooking preferences could not load. Your saved choices have not been changed."); }).finally(() => { if (active && requestVersion.current === version) setLoading(false); }); return () => { active = false; requestVersion.current += 1; }; }, [client, loadAttempt]);
  async function save(update: { tier?: CookTier; stock?: KitchenStock; skills?: Partial<Record<KitchenSkill, SkillLevel>> }) {
    if (!profile) return;
    const version = requestVersion.current;
    const next = { ...profile, ...update, skills: update.skills ? { ...profile.skills, ...update.skills } : profile.skills };
    setProfile(next); setSaving(true); setError("");
    try { const saved = await client.setCookingProfile(update); if (requestVersion.current === version) setProfile(saved); }
    catch { if (requestVersion.current === version) setError("That did not save. Your choice is still visible; try again when the connection returns."); }
    finally { if (requestVersion.current === version) setSaving(false); }
  }

  if (loading) return <Panel><Text style={[styles.eyebrow, { color: c.textMuted }]}>COOKING AT YOUR PACE</Text><Text accessibilityRole="header" style={[styles.title, { color: c.accent }]}>Suggestions can meet you where you are</Text><Text accessibilityRole="alert" style={[styles.status, { color: c.textMuted }]}>Loading your cooking preferences…</Text></Panel>;

  if (!profile) return <Panel><Text style={[styles.eyebrow, { color: c.textMuted }]}>COOKING AT YOUR PACE</Text><Text accessibilityRole="header" style={[styles.title, { color: c.accent }]}>Suggestions can meet you where you are</Text><Callout tone="warn">{error}</Callout><Text style={[styles.body, { color: c.textMuted }]}>You can try again, or skip this and keep using Savortome.</Text><View style={styles.actions}><Button label="Try again" onPress={() => setLoadAttempt(attempt => attempt + 1)} /><Button label="Done for now" variant="ghost" onPress={onDone} /></View></Panel>;

  return <Panel><Text style={[styles.eyebrow, { color: c.textMuted }]}>COOKING AT YOUR PACE</Text><Text accessibilityRole="header" style={[styles.title, { color: c.accent }]}>Suggestions can meet you where you are</Text><Text style={[styles.body, { color: c.text }]}>Choose one starting point. It reorders ideas and explains optional Challenges; it never hides a recipe.</Text>{error ? <Callout tone="warn">{error}</Callout> : null}<View accessibilityRole="radiogroup" style={styles.choices}>{COOK_TIERS.map(tier => <Choice key={tier} title={COOK_TIER_LABEL[tier]} body={`“${COOK_TIER_QUOTE[tier].line}” — ${COOK_TIER_QUOTE[tier].character}*`} selected={profile.tier === tier} disabled={saving} onPress={() => void save({ tier })} />)}</View><Text style={[styles.boundary, { color: c.textMuted }]}>*{COOK_TIER_FOOTNOTE}</Text>{profile.tier ? <><Text accessibilityRole="header" style={[styles.subheading, { color: c.text }]}>Optional details</Text><Text style={[styles.body, { color: c.textMuted }]}>Rate only what feels useful. 1 means you would rather avoid it; 5 means very comfortable.</Text>{KITCHEN_SKILLS.map(skill => <View key={skill} style={styles.ratingRow}><Text style={[styles.body, { color: c.text }]}>{KITCHEN_SKILL_LABEL[skill]}</Text><View accessibilityRole="radiogroup" accessibilityLabel={KITCHEN_SKILL_LABEL[skill]} style={styles.ratings}>{SKILL_LEVELS.map(level => <Button key={level} label={String(level)} accessibilityLabel={`${KITCHEN_SKILL_LABEL[skill]}: ${level} of 5`} variant="toggle" selected={profile.skills?.[skill] === level} disabled={saving} onPress={() => void save({ skills: { [skill]: level } })} />)}</View></View>)}<Text style={[styles.subheading, { color: c.text }]}>What is in your kitchen?</Text><View style={styles.choices}>{KITCHEN_STOCKS.map(stock => <Choice key={stock} title={KITCHEN_STOCK_LABEL[stock]} body={KITCHEN_STOCK_HINT[stock]} selected={profile.stock === stock} disabled={saving} onPress={() => void save({ stock })} />)}</View></> : null}<Button label="Done for now" onPress={onDone} /><Text style={[styles.boundary, { color: c.textMuted }]}>Feed me gently stays separate from cooking tiers, equipment, and Challenges.</Text></Panel>;
}

function Choice({ title, body, selected, disabled, onPress }: { title: string; body: string; selected?: boolean; disabled?: boolean; onPress: () => void }) {
  const c = usePalette();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${body}`} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={[styles.choice, { borderColor: selected ? c.accent : c.border, backgroundColor: selected ? c.accentSoft : c.surfaceSunken, opacity: disabled ? .55 : 1 }]}><Text style={[styles.choiceTitle, { color: c.text }]}>{title}{selected ? " · Selected" : ""}</Text><Text style={[styles.choiceBody, { color: c.textMuted }]}>{body}</Text></Pressable>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.lg },
  content: { padding: space.lg, gap: space.md, paddingBottom: 64 },
  stepList: { gap: 6 }, step: { minHeight: 44, borderWidth: 1, borderRadius: radius.sm, padding: 12, justifyContent: "center" },
  eyebrow: { fontSize: typeScale.micro, fontWeight: "700", letterSpacing: 1.1, marginBottom: 6 },
  title: { fontFamily: "serif", fontSize: 27, lineHeight: 34, marginBottom: space.sm },
  subheading: { fontFamily: "serif", fontSize: typeScale.title, marginTop: space.md },
  body: { fontSize: typeScale.body, lineHeight: 24, marginBottom: space.md },
  choices: { gap: space.sm, marginBottom: space.lg },
  choice: { minHeight: 64, borderWidth: 1, borderRadius: radius.sm, padding: space.md, justifyContent: "center" },
  choiceTitle: { fontSize: typeScale.body, fontWeight: "700" }, choiceBody: { fontSize: typeScale.small, lineHeight: 20, marginTop: 4 },
  actions: { gap: space.sm, marginTop: space.sm }, status: { fontSize: typeScale.small, lineHeight: 20 },
  ratingRow: { gap: 6, marginBottom: space.md }, ratings: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  boundary: { fontSize: typeScale.micro, lineHeight: 18, marginTop: space.md },
});
