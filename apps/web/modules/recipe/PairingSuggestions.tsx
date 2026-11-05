"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { signInReturnHref } from "@/lib/action-failure";
import {
  NUTRITION_DISCLAIMER,
  summarizeMeal,
  createClient,
  parseMealTemplateCreate,
  type MealTemplateCreateInput,
  type SecondsClient,
  type PairingCandidate,
  type PairingSlot,
  type PairingSuggestions as Suggestions,
  type RecipeNutrition,
  type TemplateRole,
} from "@seconds/core/format";
import styles from "./PairingSuggestions.module.css";

const SLOT_LABEL: Record<PairingSlot, string> = {
  side: "A side",
  drink: "A drink",
  dessert: "A dessert",
};

const EMPTY: Suggestions = { side: [], drink: [], dessert: [] };
const SLOTS = Object.keys(SLOT_LABEL) as PairingSlot[];

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * "Pairs well with" — a side, a drink, and a dessert pulled from your own
 * library, not generated. Sign-in and read failures are explicit; an empty
 * successful collection renders nothing.
 *
 * When the main dish has nutrition, one candidate per slot can be picked to
 * build a full-meal total: per guest, and for however many are coming.
 */
type PairingProps = {
  recipeId: string | null;
  mainNutrition: RecipeNutrition | null;
  servings: number | null;
};
export function PairingSuggestions({ clerkEnabled = true, ...props }: PairingProps & { clerkEnabled?: boolean }) {
  if (!props.recipeId) return null;
  return clerkEnabled ? <AuthenticatedPairings {...props} /> : <AccountPairings key={props.recipeId} {...props} />;
}
function AuthenticatedPairings(props: PairingProps) {
  const { isLoaded, userId, sessionId } = useAuth();
  if (!isLoaded) return <p role="status">Loading sign-in for your saved meal…</p>;
  if (!userId || !sessionId) return <p><Link href={signInReturnHref(props.recipeId ? `/recipe/${props.recipeId}` : "/")}>Sign in again</Link> to load your companion dishes and save meals.</p>;
  return <AccountPairings key={`${sessionId}:${props.recipeId}`} {...props} sessionId={sessionId} />;
}
function AccountPairings({ recipeId, mainNutrition, servings, sessionId }: PairingProps & { sessionId?: string }) {
  const api: SecondsClient = useMemo(() => createClient({ expectedSessionId: sessionId }), [sessionId]);
  const alive = useRef(true); const action = useRef(false);
  const [pending, setPending] = useState<MealTemplateCreateInput | null>(null);
  const [pairingsLoading, setPairingsLoading] = useState(true);
  const [pairingsFailed, setPairingsFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const [suggestions, setSuggestions] = useState<Suggestions>(EMPTY);
  const [selected, setSelected] = useState<Record<PairingSlot, string | null>>({
    side: null,
    drink: null,
    dessert: null,
  });
  const [guests, setGuests] = useState(servings && servings > 0 ? servings : 4);
  const [mealName, setMealName] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const headingId = useId();

  useEffect(() => {
    if (!recipeId) return;
    let cancelled = false;
    setPairingsLoading(true); setPairingsFailed(false); setSuggestions(EMPTY);
    void (async () => {
      try {
        const next = await api.pairings(recipeId);
        if (cancelled) return;
        setSuggestions(next);
        // Default to the top-ranked candidate that actually has nutrition to
        // contribute, so a full-meal total starts complete rather than
        // quietly missing a course; falling back to the top pick either way
        // means there's always something ready to save as a meal.
        setSelected((prev) => {
          const out = { ...prev };
          for (const slot of SLOTS) {
            out[slot] = next[slot].find((c) => c.nutrition)?.id ?? next[slot][0]?.id ?? null;
          }
          return out;
        });
      } catch {
        if (!cancelled) setPairingsFailed(true);
      } finally {
        if (!cancelled) setPairingsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recipeId, api, loadAttempt]);

  const slots = SLOTS.filter((slot) => suggestions[slot].length > 0);

  const byId = useMemo(() => {
    const map = new Map<string, PairingCandidate>();
    for (const slot of SLOTS) for (const c of suggestions[slot]) map.set(c.id, c);
    return map;
  }, [suggestions]);

  const meal = useMemo(() => {
    if (!mainNutrition) return null;
    const dishes = [mainNutrition];
    for (const slot of SLOTS) {
      const chosen = selected[slot] ? byId.get(selected[slot]!) : null;
      if (chosen?.nutrition) dishes.push(chosen.nutrition);
    }
    return summarizeMeal(dishes, guests);
  }, [mainNutrition, selected, byId, guests]);

  const locked = pending !== null || saveState === "saving" || saveState === "saved";
  if (pairingsLoading) return <p role="status">Loading companion dishes…</p>;
  if (pairingsFailed) return <div className={styles.saveMeal}><p role="alert">Companion dishes could not load. Try again before saving a combination.</p><button type="button" className={styles.saveMealButton} disabled={locked} onClick={() => setLoadAttempt(value => value + 1)}>Try companion dishes again</button></div>;
  if (slots.length === 0 && !pending) return null;

  return (
    <section className={styles.pairings} data-print="hide" aria-labelledby={headingId}>
      <h3 id={headingId} className={styles.heading}>Pairs well with</h3>
      <div className={styles.slots}>
        {slots.map((slot) => (
          <div key={slot} className={styles.slot}>
            <span className={styles.slotLabel}>{SLOT_LABEL[slot]}</span>
            <ul className={styles.list}>
              {suggestions[slot].map((candidate) => (
                <li key={candidate.id} className={styles.item}>
                  <label className={styles.pick}>
                    <input
                      type="checkbox"
                      aria-label={`Include ${candidate.title} as ${SLOT_LABEL[slot].toLowerCase()} in this meal`}
                      checked={selected[slot] === candidate.id}
                      disabled={locked}
                      onChange={() =>
                        setSelected((prev) => ({
                          ...prev,
                          [slot]: prev[slot] === candidate.id ? null : candidate.id,
                        }))
                      }
                    />
                    {mainNutrition && !candidate.nutrition ? (
                      <span className={styles.noNutrition}>no nutrition yet</span>
                    ) : null}
                  </label>
                  <Link className={styles.card} href={`/recipe/${candidate.id}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className={styles.thumb} src={candidate.imageUrl ?? undefined} alt="" />
                    <span className={styles.title}>{candidate.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {meal ? (
        <div className={styles.meal}>
          <div className={styles.mealHeader}>
            <h4 className={styles.mealTitle}>Full meal</h4>
            <span className={styles.badge}>{meal.label}</span>
          </div>
          <label className={styles.guests}>
            Guests
            <input
              type="number"
              min={1}
              value={guests}
              disabled={locked}
              onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
          <dl className={styles.mealGrid}>
            <div>
              <dt>Per guest</dt>
              <dd>
                {meal.perGuest.calories === null ? "—" : `${Math.round(meal.perGuest.calories)} cal`}
              </dd>
            </div>
            <div>
              <dt>Total for {meal.guests}</dt>
              <dd>{meal.total.calories === null ? "—" : `${Math.round(meal.total.calories)} cal`}</dd>
            </div>
            {meal.perGuest.proteinGrams !== null ? (
              <div>
                <dt>Protein / guest</dt>
                <dd>{round1(meal.perGuest.proteinGrams)}g</dd>
              </div>
            ) : null}
          </dl>
          <p className={styles.disclaimer}>{NUTRITION_DISCLAIMER}</p>
        </div>
      ) : null}

      <div className={styles.saveMeal} aria-busy={saveState === "saving"}>
        {saveState !== "saved" ? (
          <input
            type="text"
            className={styles.saveMealName}
            aria-label="Meal name"
            placeholder="Name this meal (e.g. Taco Night)"
            value={mealName}
            maxLength={160}
            disabled={locked}
            onChange={(e) => setMealName(e.target.value)}
          />
        ) : null}
        <button
          type="button"
          className={styles.saveMealButton}
          disabled={saveState === "saving" || saveState === "saved" || !recipeId}
          onClick={async () => {
            if (!recipeId || action.current || saveState === "saved") return;
            let exact: MealTemplateCreateInput;
            try {
              const items: { role: TemplateRole; recipeId: string }[] = [{ role: "main", recipeId }];
              for (const slot of SLOTS) {
                const id = selected[slot];
                if (id) items.push({ role: slot, recipeId: id });
              }
              exact = pending ?? parseMealTemplateCreate({ id: crypto.randomUUID(), name: mealName, items });
            } catch { setSaveError("Review the meal name (up to 160 characters) and selected dishes before saving. This browser must support a secure request identity."); return; }
            action.current = true; setPending(exact);
            setSaveState("saving");
            setSaveError(null);
            try {
              const result = await api.createTemplate(exact.name, exact.items, exact.id);
              if (result.id !== exact.id) throw new Error("Unconfirmed");
              if (alive.current) { setPending(null); setSaveState("saved"); }
            } catch {
              if (alive.current) { setSaveState("failed"); setSaveError("We could not confirm the meal. It may already be saved. Your exact name and dishes stay here for a safe retry, or check saved meals first."); }
            } finally { if (alive.current) action.current = false; }
          }}
        >
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : pending ? "Retry this exact meal" : "Save this meal"}
        </button>
        {saveState === "saved" ? (
          <span className={styles.saveMealNote} role="status">
            Review or share the combination from <Link href="/templates">your meals</Link>.
          </span>
        ) : saveError ? (
          <span className={styles.saveMealNote} role="alert">{saveError}</span>
        ) : null}
        {pending ? <><p className={styles.saveMealNote}>Name and dish changes are paused. <Link href="/templates">Check saved meals</Link>. Leaving this recipe loses local retry state; the earlier write may still complete.</p><button type="button" className={styles.saveMealButton} disabled={saveState === "saving"} onClick={() => {
          if (action.current || !window.confirm("Discard only the local retry request? The meal may already be saved. This does not delete or undo it.")) return;
          setPending(null); setSaveState("idle"); setSaveError("Local retry request discarded. Check saved meals before creating a new combination.");
        }}>Discard local retry request</button></> : null}
      </div>
    </section>
  );
}
