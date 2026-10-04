"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { orderedTemplateItems, templateFoodNoteName, TEMPLATE_ROLE_LABEL, type MealTemplate, type SecondsClient } from "@seconds/core/format";
import { Button, Callout, Panel, PanelHeader } from "@/ui";
import styles from "./today.module.css";
import { CombinationPlanReview } from "./CombinationPlanReview";
import { TemplateRenameControl } from "../templates/TemplateRenameControl";

export function FamiliarMeals({ client, disabled, onDraft, onPending }: {
  client: SecondsClient; disabled: boolean; onDraft: (title: string) => boolean | Promise<boolean>; onPending: (id: string, pending: boolean) => void;
}) {
  const [meals, setMeals] = useState<MealTemplate[] | null>(null);
  const [busy, setBusy] = useState(false); const [failed, setFailed] = useState(false);
  const [preparing, setPreparing] = useState(false); const [message, setMessage] = useState("");
  const [shown, setShown] = useState(6);
  const [planPending, setPlanPending] = useState<Record<string, boolean>>({});
  const locked = disabled || Object.values(planPending).some(Boolean);
  const alive = useRef(true); const sequence = useRef(0); const action = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; ++sequence.current; }; }, []);
  const load = async () => {
    if (action.current || locked) return;
    action.current = true; const read = ++sequence.current;
    setBusy(true); setFailed(false); setMeals(null); setShown(6); setMessage("");
    try { const result = await client.myTemplates(); if (alive.current && sequence.current === read) setMeals(result.templates); }
    catch { if (alive.current && sequence.current === read) setFailed(true); }
    finally { if (alive.current && sequence.current === read) { action.current = false; setBusy(false); } }
  };
  const draft = async (meal: MealTemplate) => {
    const title = templateFoodNoteName(meal.name);
    if (!title || action.current || locked) return;
    action.current = true; setPreparing(true); setMessage("");
    try { if (await onDraft(title) && alive.current) setMessage("Meal name copied to the optional food note below. Review its date and portion, then save only if you want a record. Nothing has been saved."); }
    catch { if (alive.current) setMessage("The draft could not open. Your saved meal has not changed."); }
    finally { if (alive.current) { action.current = false; setPreparing(false); } }
  };
  return <Panel><PanelHeader title="A meal you already saved" hint="Something familiar can be enough. These are your saved combinations, not recommendations based on current dietary settings or pantry stock." />
    <details className={styles.capture}><summary>Browse my saved meals</summary>
      <p>Open a dish to review its ingredients and steps. Saved meals are not checked here for allergen conflicts or changes in your dietary profile; they do not verify allergy safety.</p>
      <Button variant="ghost" disabled={locked || busy || preparing} onClick={() => void load()}>{busy ? "Loading saved meals…" : meals !== null ? "Refresh saved meals" : "Load my saved meals"}</Button>
      {busy ? <p role="status">Loading your combinations…</p> : null}
      {failed ? <Callout tone="error" role="alert">Saved meals could not load. Try again before deciding this list is empty.</Callout> : null}
      {meals?.length === 0 ? <p>No saved combinations yet. A recipe's companion-dishes section lets you save one. <Link href="/templates">Open saved meals</Link>.</p> : null}
      {meals ? meals.slice(0, shown).map(meal => <article className={styles.idea} key={meal.id}>
        <h3>{meal.name}</h3>
        {meal.items.length ? <ul>{orderedTemplateItems(meal.items).map((item, index) => <li key={`${item.role}:${item.recipeId}:${index}`}>{TEMPLATE_ROLE_LABEL[item.role]}: {locked || preparing ? <span>{item.title}</span> : <Link href={`/recipe/${item.recipeId}`}>{item.title}</Link>}</li>)}</ul> : <p>No dishes remain in this combination. You can still review its name.</p>}
        <Button variant="ghost" disabled={locked || busy || preparing || !templateFoodNoteName(meal.name)} onClick={() => void draft(meal)}>Use {meal.name} as a food-note draft</Button>
        <TemplateRenameControl templateId={meal.id} name={meal.name} client={client} disabled={locked || busy || preparing}
          onPending={pending => {
            const key = `rename:${meal.id}`;
            setPlanPending(current => ({ ...current, [key]: pending })); onPending(key, pending);
          }}
          onConfirmed={name => setMeals(current => current?.map(saved => saved.id === meal.id ? { ...saved, name } : saved) ?? current)}
          onReview={() => {
            if (!alive.current || action.current) return;
            const key = `rename:${meal.id}`;
            setPlanPending(current => ({ ...current, [key]: false })); onPending(key, false);
            ++sequence.current; setMeals(null); setFailed(false); setShown(6);
            setMessage("Local rename retry discarded. Reload saved meals to review the name. The earlier request is not cancelled and may still finish; recheck before another change.");
          }} />
        <CombinationPlanReview meal={meal} client={client} disabled={locked || busy || preparing} onPending={pending => { setPlanPending(current => ({ ...current, [meal.id]: pending })); onPending(meal.id, pending); }} />
        {!templateFoodNoteName(meal.name) ? <p>This name is too long or cannot be copied. Enter a short food name in the note below instead; nothing is truncated.</p> : null}
      </article>) : null}
      {meals && meals.length > shown ? <Button variant="ghost" disabled={locked || busy || preparing} onClick={() => setShown(value => value + 6)}>Show more saved meals</Button> : null}
      <p>Copying a name does not record eating, add to your plan, change inventory or infer a portion. {locked || busy || preparing ? <span>Manage saved combinations after reviewing pending actions.</span> : <Link href="/templates">Manage saved combinations</Link>}</p>
    </details>
    {message ? <Callout tone="info" role="status">{message}</Callout> : null}
  </Panel>;
}
