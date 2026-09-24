"use client";

import { useEffect, useState } from "react";
import {
  COOK_TIERS,
  COOK_TIER_FOOTNOTE,
  COOK_TIER_LABEL,
  COOK_TIER_QUOTE,
  KITCHEN_SKILLS,
  KITCHEN_SKILL_HINT,
  KITCHEN_SKILL_LABEL,
  KITCHEN_STOCKS,
  KITCHEN_STOCK_HINT,
  KITCHEN_STOCK_LABEL,
  SKILL_LEVELS,
  type CookProfile,
  type CookTier,
  type KitchenStock,
  type SkillLevel,
} from "@seconds/core/format";
import { Button, Callout, Panel, PanelHeader } from "@/ui";
import styles from "./cooking.module.css";

/**
 * Telling us how you cook, so suggestions can meet you where you are.
 *
 * Only the first question is put in anyone's way, and even that can be
 * ignored: the panel collapses to a single line once a tier is chosen, and
 * the other two questions are offered rather than asked. Somebody who just
 * wants to follow a recipe tonight should not have to fill in a form first.
 *
 * This is a plain first pass at the interface. The shape of the interaction
 * is the part worth keeping; the styling is deliberately ordinary.
 */
export function CookingProfilePanel() {
  const [profile, setProfile] = useState<CookProfile | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/profile/cooking")
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((loaded: CookProfile) => {
        if (!active) return;
        setProfile(loaded);
        setLoadFailed(false);
        // Someone who has never answered sees the question; someone who has
        // sees a summary they can reopen.
        setExpanded(!loaded.tier);
      })
      .catch(() => {
        if (!active) return;
        setLoadFailed(true);
      });
    return () => { active = false; };
  }, [loadAttempt]);

  async function save(update: Partial<Record<"tier" | "stock" | "skills", unknown>>) {
    const localProfile = mergeProfileUpdate(profile ?? {}, update);
    // Keep the person's answer visible while the request is in flight and if
    // the request fails. The nearby failure copy promises exactly that.
    setProfile(localProfile);
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/profile/cooking", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(update),
      });
      if (!response.ok) throw new Error(String(response.status));
      setProfile(await response.json());
    } catch {
      setError("That did not save. Your answer is still here; try again in a moment.");
    } finally {
      setSaving(false);
    }
  }

  if (!profile && loadFailed) return (
    <Panel className={styles.profilePanel}>
      <PanelHeader
        title="How do you cook?"
        hint="So suggestions land somewhere near where you are. Nothing here is a test, and you can change it whenever."
      />
      <Callout tone="warn">
        <div className={styles.loadNotice}>
          <span>Your saved cooking preferences could not load. Your saved choices have not been changed. Try again before editing them.</span>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setLoadFailed(false);
              setError("");
              setLoadAttempt(attempt => attempt + 1);
            }}
          >
            Try again
          </Button>
        </div>
      </Callout>
    </Panel>
  );

  if (!profile) return (
    <Panel className={styles.profilePanel}>
      <PanelHeader
        title="How do you cook?"
        hint="So suggestions land somewhere near where you are. Nothing here is a test, and you can change it whenever."
      />
      <p className={styles.loading} role="status">Loading your cooking preferences…</p>
    </Panel>
  );

  const tier = profile.tier;

  if (tier && !expanded) {
    return (
      <Panel className={styles.profilePanel}>
        <div className={styles.summary}>
          <p className={styles.summaryText}>
            Cooking as <strong>{COOK_TIER_LABEL[tier]}</strong>
            {profile.stock ? <> · {KITCHEN_STOCK_LABEL[profile.stock]}</> : null}
          </p>
          <Button variant="ghost" onClick={() => setExpanded(true)}>Change</Button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel className={styles.profilePanel}>
      <PanelHeader
        title="How do you cook?"
        hint="So suggestions land somewhere near where you are. Nothing here is a test, and you can change it whenever."
      />

      {error ? <Callout tone="warn">{error}</Callout> : null}
      <fieldset className={styles.group}>
        <legend className={styles.legend}>Pick whichever sounds most like you</legend>
        <div className={styles.tiers}>
          {COOK_TIERS.map(candidate => (
            <button
              key={candidate}
              type="button"
              className={styles.tier}
              data-chosen={candidate === tier}
              aria-pressed={candidate === tier}
              disabled={saving}
              onClick={() => void save({ tier: candidate })}
            >
              <span className={styles.tierName}>{COOK_TIER_LABEL[candidate]}</span>
              <span className={styles.tierQuote}>
                &ldquo;{COOK_TIER_QUOTE[candidate].line}&rdquo;
              </span>
              <span className={styles.tierWho}>
                — {COOK_TIER_QUOTE[candidate].character}*
              </span>
              {candidate === tier ? <span className={styles.chosen}>Selected</span> : null}
            </button>
          ))}
        </div>
        <p className={styles.footnote}>*{COOK_TIER_FOOTNOTE}</p>
      </fieldset>

      {/* Offered, never required — and only once the first question is done,
          so the initial visit is one decision rather than three. */}
      {tier ? (
        <>
          <fieldset className={styles.group}>
            <legend className={styles.legend}>
              Anything you are particularly good at, or would rather avoid? <span className={styles.optional}>Optional</span>
            </legend>
            <p className={styles.scaleHint}>1 means “I would rather avoid it”; 5 means “very comfortable.”</p>
            {KITCHEN_SKILLS.map(skill => (
              <div key={skill} className={styles.skill}>
                <div className={styles.skillLabel}>
                  <span>{KITCHEN_SKILL_LABEL[skill]}</span>
                  <span className={styles.hint}>{KITCHEN_SKILL_HINT[skill]}</span>
                </div>
                <div className={styles.levels} role="group" aria-label={KITCHEN_SKILL_LABEL[skill]}>
                  {SKILL_LEVELS.map(level => (
                    <button
                      key={level}
                      type="button"
                      className={styles.level}
                      data-chosen={profile.skills?.[skill] === level}
                      aria-pressed={profile.skills?.[skill] === level}
                      aria-label={`${KITCHEN_SKILL_LABEL[skill]}: ${level} of 5`}
                      disabled={saving}
                      onClick={() => void save({ skills: { [skill]: level as SkillLevel } })}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </fieldset>

          <fieldset className={styles.group}>
            <legend className={styles.legend}>
              What is in your kitchen? <span className={styles.optional}>Optional</span>
            </legend>
            <div className={styles.stocks}>
              {KITCHEN_STOCKS.map(candidate => (
                <button
                  key={candidate}
                  type="button"
                  className={styles.stock}
                  data-chosen={candidate === profile.stock}
                  aria-pressed={candidate === profile.stock}
                  disabled={saving}
                  onClick={() => void save({ stock: candidate as KitchenStock })}
                >
                  <span className={styles.stockName}>{KITCHEN_STOCK_LABEL[candidate]}</span>
                  <span className={styles.hint}>{KITCHEN_STOCK_HINT[candidate]}</span>
                </button>
              ))}
            </div>
            <p className={styles.note}>
              Only ever used to order suggestions. A recipe you do not have the kit
              for is still shown, marked as a challenge, with the missing tool named.
            </p>
          </fieldset>

          <div className={styles.done}>
            <Button onClick={() => setExpanded(false)}>Done for now</Button>
          </div>
        </>
      ) : null}
    </Panel>
  );
}

export function mergeProfileUpdate(
  profile: CookProfile,
  update: Partial<Record<"tier" | "stock" | "skills", unknown>>,
): CookProfile {
  const next = { ...profile };
  if ("tier" in update) next.tier = update.tier as CookTier;
  if ("stock" in update) next.stock = update.stock as KitchenStock;
  if (update.skills && typeof update.skills === "object" && !Array.isArray(update.skills)) {
    next.skills = { ...profile.skills, ...(update.skills as CookProfile["skills"]) };
  }
  return next;
}

export type { CookTier };
