"use client";

import { useEffect, useState } from "react";
import {
  ALLERGEN_LABEL,
  MEAL_SLOTS,
  MEAL_SLOT_LABEL,
  flagsForRecipe,
  todayISO,
  type Allergen,
  type MealSlot,
  type PersonSummary,
} from "@seconds/core/format";
import { api } from "@/lib/client";
import styles from "./plan.module.css";

/**
 * Propose this recipe for a friend's plan. Nothing lands on their calendar
 * until they accept it — this only ever creates a suggestion, the same async
 * co-op shape as everything else here: your move, then theirs, whenever they
 * next look.
 */
export function SuggestMeal({
  recipeId,
  ingredients,
}: {
  recipeId: string;
  ingredients: readonly { canonicalItem: string; optional: boolean }[];
}) {
  const [friends, setFriends] = useState<PersonSummary[] | null>(null);
  const [friendId, setFriendId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [slot, setSlot] = useState<MealSlot>("dinner");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  // "loading"/"error" are both "unknown," not "none" — a friend's allergens
  // failing to load must never silently read the same as them having none.
  const [friendAllergens, setFriendAllergens] = useState<Allergen[] | "loading" | "error">("loading");
  const [friendsError, setFriendsError] = useState(false);
  const [friendsAttempt, setFriendsAttempt] = useState(0);
  const [allergenAttempt, setAllergenAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setFriends(null);
    setFriendsError(false);
    void api
      .friends()
      .then((overview) => {
        if (!active) return;
        setFriends(overview.friends);
        setFriendId((prev) => prev || overview.friends[0]?.id || "");
      })
      .catch(() => { if (active) setFriendsError(true); });
    return () => { active = false; };
  }, [friendsAttempt]);

  useEffect(() => {
    if (!friendId) return;
    // Reset before the new fetch starts, not after — otherwise the previous
    // friend's allergens (or lack of them) stay on screen and can be acted
    // on during the gap, which is exactly backwards for a safety warning.
    setFriendAllergens("loading");
    let cancelled = false;
    void api
      .friendAllergens(friendId)
      .then((result) => {
        if (!cancelled) setFriendAllergens(result?.allergens ?? []);
      })
      .catch(() => {
        if (!cancelled) setFriendAllergens("error");
      });
    return () => {
      cancelled = true;
    };
  }, [allergenAttempt, friendId]);

  if (friendsError) return (
    <div className={styles.suggest} data-print="hide">
      <span className={styles.suggestLabel}>Suggest this to a friend's plan</span>
      <span className={styles.suggestError} role="alert">People could not load. No suggestion was sent.</span>
      <button type="button" className={styles.suggestRetry} onClick={() => setFriendsAttempt((attempt) => attempt + 1)}>Try again</button>
    </div>
  );

  if (friends === null) return <div className={styles.suggest} data-print="hide" role="status">Loading people you can suggest this to…</div>;
  if (friends.length === 0) return null;

  const allergensKnown = Array.isArray(friendAllergens);
  const conflicts = allergensKnown ? flagsForRecipe(ingredients, friendAllergens) : [];
  const conflictAllergens = [...new Set(conflicts.map((f) => f.allergen))];
  const selectedFriendName = friends.find((friend) => friend.id === friendId)?.displayName;

  return (
    <div className={styles.suggest} data-print="hide" aria-busy={state === "sending"}>
      <span className={styles.suggestLabel}>Suggest this to a friend's plan</span>
      <div className={styles.suggestRow}>
        <select
          aria-label="Friend to suggest this meal to"
          value={friendId}
          onChange={(e) => setFriendId(e.target.value)}
        >
          {friends.map((f) => (
            <option key={f.id} value={f.id}>
              {f.displayName}
            </option>
          ))}
        </select>
        <input
          aria-label="Suggested meal date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <select
          aria-label="Suggested meal slot"
          value={slot}
          onChange={(e) => setSlot(e.target.value as MealSlot)}
        >
          {MEAL_SLOTS.map((s) => (
            <option key={s} value={s}>
              {MEAL_SLOT_LABEL[s]}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={state === "sending" || !friendId || !allergensKnown}
          onClick={async () => {
            setState("sending");
            setError(null);
            try {
              await api.suggestForFriend(friendId, recipeId, date, slot);
              setState("sent");
            } catch (err) {
              setState("failed");
              setError(err instanceof Error ? err.message : "Couldn't send that.");
            }
          }}
        >
          {state === "sending" ? "Sending…" : state === "sent" ? "Sent ✓" : "Suggest"}
        </button>
      </div>
      {friendAllergens === "loading" ? (
        <span className={styles.suggestError} role="status">Checking their allergies…</span>
      ) : friendAllergens === "error" ? (
        <span className={styles.suggestError} role="alert">
          Couldn't check {selectedFriendName ? `${selectedFriendName}’s` : "this person's"} saved allergy flags. Suggest stays unavailable.{" "}
          <button type="button" className={styles.suggestRetry} onClick={() => setAllergenAttempt((attempt) => attempt + 1)}>Check again</button>
        </span>
      ) : conflictAllergens.length > 0 ? (
        <span className={styles.suggestError} role="alert">
          They've flagged {conflictAllergens.map((a) => ALLERGEN_LABEL[a]).join(", ")} — this recipe
          may contain it. Guessed from ingredient names, not verified.
        </span>
      ) : null}
      {error ? <span className={styles.suggestError} role="alert">{error}</span> : null}
    </div>
  );
}
