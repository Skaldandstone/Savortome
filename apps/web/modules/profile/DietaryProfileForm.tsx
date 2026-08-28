"use client";

import { useEffect, useState } from "react";
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
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .dietaryProfile()
      .then((data) => {
        setProfile(data);
        setSaved(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const dirty = JSON.stringify(profile) !== JSON.stringify(saved);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await api.setDietaryProfile(profile);
      setProfile(result);
      setSaved(result);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

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
            aria-pressed={profile.dietaryTags.includes(tag)}
            onClick={() => setProfile((p) => ({ ...p, dietaryTags: toggle(p.dietaryTags, tag) }))}
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
            aria-pressed={profile.allergens.includes(allergen)}
            onClick={() => setProfile((p) => ({ ...p, allergens: toggle(p.allergens, allergen) }))}
          >
            {ALLERGEN_LABEL[allergen]}
          </Button>
        ))}
      </div>

      <div className={styles.saveRow}>
        <Button type="button" disabled={!dirty || saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save"}
        </Button>
        {justSaved ? <span className={styles.savedNote}>Saved ✓</span> : null}
      </div>

      {error ? (
        <Callout tone="error" role="alert">
          {error}
        </Callout>
      ) : null}
    </Panel>
  );
}
