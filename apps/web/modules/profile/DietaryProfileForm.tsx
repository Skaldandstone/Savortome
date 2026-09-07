"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ALLERGENS,
  ALLERGEN_LABEL,
  DIETARY_TAGS,
  DIETARY_TAG_LABEL,
  type Allergen,
  type DietaryProfile,
  type DietaryTag,
} from "@seconds/core/format";
import { Button, Callout, Panel, PanelHeader } from "@/ui";
import { api } from "@/lib/client";
import styles from "./profile.module.css";

const EMPTY: DietaryProfile = { dietaryTags: [], allergens: [] };

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * Preferences and allergies, in one place. A preference steers a suggestion;
 * an allergy is what a recipe gets checked against before it's sent to a
 * friend, or shown on your own card — so the two live in separate groups
 * rather than one flat list someone could mix up under pressure.
 */
export function DietaryProfileForm() {
  const [profile, setProfile] = useState<DietaryProfile>(EMPTY);
  const [saved, setSaved] = useState<DietaryProfile>(EMPTY);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const loadVersion = useRef(0);
  const hasLoaded = useRef(false);
  const saveInFlight = useRef(false);
  const savedNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadProfile = useCallback(async () => {
    // Retry is available only before editing. A late initial request must not
    // overwrite a newer response, an unmounted form, or someone's edits.
    if (!mounted.current || hasLoaded.current) return;
    const version = ++loadVersion.current;
    setLoadState('loading');
    setError(null);
    try {
      const data = await api.dietaryProfile();
      if (!mounted.current || version !== loadVersion.current || hasLoaded.current) return;
      hasLoaded.current = true;
      setProfile(data);
      setSaved(data);
      setLoadState('ready');
    } catch {
      if (mounted.current && version === loadVersion.current && !hasLoaded.current) setLoadState('failed');
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void loadProfile();
    return () => {
      mounted.current = false;
      loadVersion.current++;
      if (savedNoticeTimer.current !== null) clearTimeout(savedNoticeTimer.current);
    };
  }, [loadProfile]);

  const dirty = JSON.stringify(profile) !== JSON.stringify(saved);

  // Same guard the recipe editor uses for the same reason: an allergy
  // toggled and then lost to an accidental tab close is the one silent data
  // loss this app should never risk.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = async () => {
    if (!mounted.current || loadState !== 'ready' || saveInFlight.current || !dirty) return;
    saveInFlight.current = true;
    const version = loadVersion.current;
    const stillCurrent = () => mounted.current && version === loadVersion.current;
    setSaving(true);
    setJustSaved(false);
    setError(null);
    try {
      const result = await api.setDietaryProfile(profile);
      if (!stillCurrent()) return;
      setProfile(result);
      setSaved(result);
      setJustSaved(true);
      if (savedNoticeTimer.current !== null) clearTimeout(savedNoticeTimer.current);
      savedNoticeTimer.current = setTimeout(() => { if (stillCurrent()) setJustSaved(false); }, 2000);
    } catch (err) {
      if (stillCurrent()) setError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      saveInFlight.current = false;
      if (stillCurrent()) setSaving(false);
    }
  };

  if (loadState !== 'ready') return <Panel>
    <PanelHeader title="Dietary profile" hint="Your saved preferences and allergens." />
    {loadState === 'loading' ? <p className={styles.loadNote} role="status">Loading your saved choices...</p> : <>
      <Callout tone="error" role="alert">Your saved dietary profile could not be loaded. Your saved choices have not been changed. Try again before editing them.</Callout>
      <div className={styles.saveRow}><Button type="button" onClick={() => void loadProfile()}>Try again</Button></div>
    </>}
  </Panel>;

  return (
    <Panel>
      <PanelHeader
        title="Dietary profile"
        hint="Preferences steer suggestions your way. Allergies are checked before a recipe reaches your card or a friend's suggestion — never assume they've caught everything; always read the real ingredients."
      />

      <h3 className={styles.groupTitle}>Preferences</h3>
      <div className={styles.options}>
        {DIETARY_TAGS.map((tag: DietaryTag) => (
          <Button
            key={tag}
            type="button"
            variant="toggle"
            disabled={saving}
            aria-pressed={profile.dietaryTags.includes(tag)}
            onClick={() => { if (!saveInFlight.current) setProfile((p) => ({ ...p, dietaryTags: toggle(p.dietaryTags, tag) })); }}
          >
            {DIETARY_TAG_LABEL[tag]}
          </Button>
        ))}
      </div>

      <h3 className={styles.groupTitle}>Allergies</h3>
      <div className={styles.options}>
        {ALLERGENS.map((allergen: Allergen) => (
          <Button
            key={allergen}
            type="button"
            variant="toggle"
            disabled={saving}
            aria-pressed={profile.allergens.includes(allergen)}
            onClick={() => { if (!saveInFlight.current) setProfile((p) => ({ ...p, allergens: toggle(p.allergens, allergen) })); }}
          >
            {ALLERGEN_LABEL[allergen]}
          </Button>
        ))}
      </div>

      <div className={styles.saveRow}>
        <Button type="button" disabled={!dirty || saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save"}
        </Button>
        {justSaved && !dirty && !saving ? <span className={styles.savedNote} role="status">Saved ✓</span> : null}
      </div>

      {error ? (
        <Callout tone="error" role="alert">
          {error}
        </Callout>
      ) : null}
    </Panel>
  );
}
