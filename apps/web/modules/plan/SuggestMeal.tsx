"use client";

import { useEffect, useState } from "react";
import {
  MEAL_SLOTS,
  MEAL_SLOT_LABEL,
  todayISO,
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
export function SuggestMeal({ recipeId }: { recipeId: string }) {
  const [friends, setFriends] = useState<PersonSummary[] | null>(null);
  const [friendId, setFriendId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [slot, setSlot] = useState<MealSlot>("dinner");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .friends()
      .then((overview) => {
        setFriends(overview.friends);
        setFriendId((prev) => prev || overview.friends[0]?.id || "");
      })
      .catch(() => setFriends([]));
  }, []);

  if (!friends || friends.length === 0) return null;

  return (
    <div className={styles.suggest} data-print="hide">
      <span className={styles.suggestLabel}>Suggest this to a friend's plan</span>
      <div className={styles.suggestRow}>
        <select value={friendId} onChange={(e) => setFriendId(e.target.value)}>
          {friends.map((f) => (
            <option key={f.id} value={f.id}>
              {f.displayName}
            </option>
          ))}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <select value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)}>
          {MEAL_SLOTS.map((s) => (
            <option key={s} value={s}>
              {MEAL_SLOT_LABEL[s]}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={state === "sending" || !friendId}
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
      {error ? <span className={styles.suggestError}>{error}</span> : null}
    </div>
  );
}
