"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { createClient, foodLogDate, localFoodDate, parseFoodLogInput, planIngredientName, type FoodLogInput, type FoodLogEntry, type FoodLogSource, type PantryEntry, type PlanTogetherIdea, type PlanTogetherOptions } from "@seconds/core/format";
import { actionFailure, signInReturnHref } from "@/lib/action-failure";
import { Button, Callout, FieldRow, Panel, PanelHeader, TextField } from "@/ui";
import styles from "./today.module.css";
import { MissingShoppingReview } from "./MissingShoppingReview";
import { PlanIdeaReview } from "./PlanIdeaReview";
import { PantryPlanningPicker } from "./PantryPlanningPicker";

const base64Of = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader(); reader.onerror = () => reject(new Error("File could not be read."));
  reader.onload = () => resolve(String(reader.result).split(",")[1] ?? ""); reader.readAsDataURL(blob);
});

export function TodayScreen({ clerkEnabled = true }: { clerkEnabled?: boolean }) {
  return clerkEnabled ? <AuthenticatedTodayScreen /> : <AccountTodayScreen />;
}
function AuthenticatedTodayScreen() {
  const { userId, sessionId, isLoaded } = useAuth();
  if (!isLoaded) return <p role="status">Loading your sign-in…</p>;
  if (!sessionId || !userId) return <Callout tone="info"><Link href={signInReturnHref("/today")}>Sign in again to load your food notes.</Link></Callout>;
  return <AccountTodayScreen key={sessionId ?? "signed-out"} userId={userId} sessionId={sessionId} />;
}
function AccountTodayScreen({ userId, sessionId }: { userId?: string | null; sessionId?: string | null }) {
  const api = useMemo(() => createClient({ expectedSessionId: sessionId ?? undefined }), [sessionId]);
  const owner = useRef(userId); const accountEpoch = useRef(0); if (owner.current !== userId) { owner.current = userId; ++accountEpoch.current; }
  const request = useRef(0);
  const alive = useRef(true);
  const [date, setDate] = useState(() => localFoodDate());
  const [notes, setNotes] = useState<FoodLogEntry[]>([]);
  const [dayNotes, setDayNotes] = useState<FoodLogEntry[]>([]);
  const [dayState, setDayState] = useState<"loading" | "ready" | "failed">("loading");
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showInvitation, setShowInvitation] = useState(true);
  const [ideas, setIdeas] = useState<PlanTogetherIdea[] | null>(null);
  const [ideasBusy, setIdeasBusy] = useState(false);
  const [ideasError, setIdeasError] = useState<string | null>(null);
  const [maxMinutes, setMaxMinutes] = useState<PlanTogetherOptions["maxMinutes"]>();
  const [pantryOnly, setPantryOnly] = useState(false);
  const [useIngredient, setUseIngredient] = useState("");
  const [skipIngredient, setSkipIngredient] = useState("");
  const [ingredientSummary, setIngredientSummary] = useState("");
  const [selectedPantry, setSelectedPantry] = useState<PantryEntry | null>(null);
  const ideasAction = useRef(false);
  const [shoppingPending, setShoppingPending] = useState<Record<string, boolean>>({});
  const hasShoppingPending = Object.values(shoppingPending).some(Boolean);
  const [title, setTitle] = useState("");
  const [portion, setPortion] = useState("");
  const [source, setSource] = useState<FoodLogSource>("text");
  const [uncertainty, setUncertainty] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [capture, setCapture] = useState<{ photo: boolean; voice: boolean } | null>(null);
  const [captureError, setCaptureError] = useState(false);
  const [captureVisit, setCaptureVisit] = useState(0);
  const draftId = useRef<string | null>(null);
  const pendingSave = useRef<FoodLogInput | null>(null);
  const action = useRef(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceGeneration = useRef(0);
  const voiceOpening = useRef(false);
  const [recording, setRecording] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const stopCapture = useCallback((discard = false) => {
    if (discard) {
      ++voiceGeneration.current;
      if (voiceOpening.current && !action.current) setBusy(false);
      voiceOpening.current = false; setVoiceBlob(null);
    }
    if (stopTimer.current) clearTimeout(stopTimer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    setRecording(false);
  }, []);
  const load = useCallback(async () => {
    const account = owner.current; const epoch = accountEpoch.current; const version = ++request.current;
    setLoading(true); setLoadError(null);
    try {
      const pending = pendingSave.current;
      const result = await api.listFoodNotes();
      const savedDay = pending ? await api.listFoodNotes(pending.date) : [];
      if (alive.current && accountEpoch.current === epoch && owner.current === account && request.current === version) {
        setNotes(result); setLoaded(true);
        if (pending && pendingSave.current === pending && savedDay.some(note => note.id === pending.id && note.date === pending.date && note.title === pending.title && note.portion === pending.portion && note.source === pending.source)) {
          pendingSave.current = null; setUnconfirmed(false); draftId.current = pending.id;
          setError(""); setNeedsSignIn(false);
          setStatus("Reload confirmed your note was saved. You can edit this draft; discarding it will not remove the saved note.");
        }
      }
    } catch {
      if (alive.current && accountEpoch.current === epoch && owner.current === account && request.current === version) setLoadError("Your food notes could not load. Nothing has been deleted. Try loading them again before saving another note.");
    } finally { if (alive.current && accountEpoch.current === epoch && owner.current === account && request.current === version) setLoading(false); }
  }, [api]);
  useEffect(() => {
    ++accountEpoch.current; alive.current = true;
    pendingSave.current = null; action.current = false; setUnconfirmed(false);
    stopCapture(true); setVoiceBlob(null); setCapture(null); setCaptureError(false);
    setNotes([]); setLoaded(false); setTitle(""); setPortion(""); setSource("text"); setUncertainty(""); draftId.current = null;
    setIdeas(null); setIdeasError(null); setIdeasBusy(false); setBusy(false); setError(""); setStatus(""); setNeedsSignIn(false); setShowInvitation(true);
    void load();
    return () => { alive.current = false; ++accountEpoch.current; ++request.current; stopCapture(true); };
  }, [userId, load, stopCapture]);
  useEffect(() => {
    let active = true;
    const account = owner.current; const epoch = accountEpoch.current;
    setCapture(null); setCaptureError(false);
    void api.foodNoteCaptureStatus().then(result => {
      if (active && alive.current && accountEpoch.current === epoch && owner.current === account) setCapture(result);
    }).catch(() => {
      if (active && alive.current && accountEpoch.current === epoch && owner.current === account) setCaptureError(true);
    });
    return () => { active = false; };
  }, [api, userId, captureVisit]);
  useEffect(() => {
    const hide = () => { if (document.visibilityState !== "visible") stopCapture(true); };
    const leave = () => stopCapture(true);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", leave);
    return () => { document.removeEventListener("visibilitychange", hide); window.removeEventListener("pagehide", leave); };
  }, [stopCapture]);
  useEffect(() => {
    let cancelled = false;
    const account = owner.current; const epoch = accountEpoch.current;
    setDayNotes([]); setDayState("loading");
    try { foodLogDate(date); } catch { setDayState("failed"); return; }
    void api.listFoodNotes(date).then(result => {
      if (!cancelled && alive.current && owner.current === account && accountEpoch.current === epoch) { setDayNotes(result); setDayState("ready"); }
    }).catch(() => { if (!cancelled && alive.current && accountEpoch.current === epoch) setDayState("failed"); });
    return () => { cancelled = true; };
  }, [date, notes, userId]);
  const failure = (cause: unknown, fallback: string) => {
    const result = actionFailure(cause, fallback); setError(result.message); setNeedsSignIn(result.signInRequired);
  };
  const generate = async (kind: "photo" | "voice", blob: Blob) => {
    if (action.current || pendingSave.current || voiceOpening.current || recorder.current?.state === "recording") return;
    action.current = true;
    const account = owner.current; const epoch = accountEpoch.current;
    setBusy(true); setError(""); setStatus(""); setNeedsSignIn(false);
    try {
      const max = kind === "photo" ? 8_000_000 : 5_000_000;
      if (!blob.size || blob.size > max) throw new Error("That file is empty or too large. Use a smaller file or type a note.");
      const mediaType = blob.type.split(";")[0]!;
      const data = await base64Of(blob);
      if (!alive.current || accountEpoch.current !== epoch || owner.current !== account) return;
      const { draft } = await api.foodNoteDraft(kind, data, mediaType);
      if (!alive.current || accountEpoch.current !== epoch || owner.current !== account) return;
      setTitle(draft.title); setPortion(draft.portion ?? ""); setSource(kind); setUncertainty(draft.uncertainty); draftId.current = null;
      setStatus("Draft ready. Check the food name and portion before saving. Nothing has been saved yet.");
    } catch (cause) { if (alive.current && accountEpoch.current === epoch && owner.current === account) failure(cause, "Could not prepare a draft. Type a food note instead."); }
    finally { if (alive.current && accountEpoch.current === epoch && owner.current === account) { action.current = false; setBusy(false); if (kind === "voice") setVoiceBlob(null); } }
  };
  const startVoice = async () => {
    if (voiceOpening.current || recorder.current?.state === "recording" || busy || action.current || pendingSave.current) return;
    voiceOpening.current = true;
    const voiceRun = ++voiceGeneration.current;
    setBusy(true);
    setError(""); setVoiceBlob(null);
    const account = owner.current; const epoch = accountEpoch.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("Recording is not supported here. Type a food note or use your keyboard's dictation.");
      stopTimer.current = setTimeout(() => {
        if (voiceGeneration.current !== voiceRun || !voiceOpening.current) return;
        stopCapture(true);
        if (alive.current && accountEpoch.current === epoch && owner.current === account) setError("Microphone access did not finish. Try again or type a note. Any late microphone grant will be closed.");
      }, 12000);
      const tracks = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current || accountEpoch.current !== epoch || owner.current !== account || voiceGeneration.current !== voiceRun || document.hidden) { tracks.getTracks().forEach(track => track.stop()); return; }
      if (stopTimer.current) clearTimeout(stopTimer.current);
      const mimeType = ["audio/webm", "audio/mp4"].find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) { tracks.getTracks().forEach(track => track.stop()); throw new Error("This browser's audio format is unsupported. Type a note instead."); }
      stream.current = tracks;
      const captureRecorder = new MediaRecorder(tracks, { mimeType }); recorder.current = captureRecorder;
      const chunks: Blob[] = []; let size = 0;
      captureRecorder.ondataavailable = event => { size += event.data.size; if (size <= 5_000_000) chunks.push(event.data); else stopCapture(); };
      captureRecorder.onstop = () => {
        tracks.getTracks().forEach(track => track.stop());
        if (recorder.current === captureRecorder) { recorder.current = null; stream.current = null; }
        if (alive.current && accountEpoch.current === epoch && owner.current === account && voiceGeneration.current === voiceRun) { setRecording(false); if (size > 0 && size <= 5_000_000) setVoiceBlob(new Blob(chunks, { type: mimeType })); else setError("That recording was empty or too large. Try a shorter note."); }
      };
      captureRecorder.onerror = () => { if (voiceGeneration.current !== voiceRun) return; stopCapture(true); if (owner.current === account && alive.current && accountEpoch.current === epoch) setError("Recording stopped unexpectedly. You can type the note instead."); };
      captureRecorder.start(1000); setRecording(true);
      stopTimer.current = setTimeout(() => stopCapture(), 45_000);
    } catch (cause) { if (voiceGeneration.current === voiceRun) { stopCapture(true); if (owner.current === account && alive.current && accountEpoch.current === epoch) failure(cause, "Microphone unavailable. Type a note instead."); } }
    finally { if (owner.current === account && alive.current && accountEpoch.current === epoch && voiceGeneration.current === voiceRun) { voiceOpening.current = false; setBusy(false); } }
  };
  const save = async () => {
    if (action.current || voiceOpening.current || recorder.current?.state === "recording" || !loaded) return;
    let input: FoodLogInput;
    try {
      draftId.current ??= crypto.randomUUID();
      input = pendingSave.current ?? parseFoodLogInput({ id: draftId.current, date, title, portion: portion.trim() || null, source });
    } catch (cause) { failure(cause, "Review the food name and date before saving."); return; }
    action.current = true; ++request.current; setLoading(false);
    pendingSave.current = input; setUnconfirmed(true);
    const account = owner.current; const epoch = accountEpoch.current;
    setBusy(true); setError(""); setStatus(""); setNeedsSignIn(false);
    try {
      const entry = await api.saveFoodNote(input);
      if (!alive.current || accountEpoch.current !== epoch || owner.current !== account) return;
      setNotes(current => [entry, ...current.filter(note => note.id !== entry.id)]); setStatus("Food note saved. Your pantry was not changed.");
      pendingSave.current = null; setUnconfirmed(false);
      setTitle(""); setPortion(""); setUncertainty(""); setSource("text"); draftId.current = null;
    } catch (cause) { if (alive.current && accountEpoch.current === epoch && owner.current === account) failure(cause, "We could not confirm the note saved. Your draft is still here. Reload notes before retrying."); }
    finally { if (alive.current && accountEpoch.current === epoch && owner.current === account) { action.current = false; setBusy(false); } }
  };
  const remove = async (id: string) => {
    if (action.current || pendingSave.current || voiceOpening.current || recorder.current?.state === "recording") return;
    action.current = true; ++request.current; setLoading(false);
    const account = owner.current; const epoch = accountEpoch.current; setBusy(true); setError("");
    try {
      await api.deleteFoodNote(id);
      if (!alive.current || accountEpoch.current !== epoch || owner.current !== account) return;
      setNotes(current => current.filter(note => note.id !== id)); setConfirmDelete(null); setStatus("Food note removed. Pantry and plans were not changed.");
    } catch (cause) { if (alive.current && accountEpoch.current === epoch && owner.current === account) failure(cause, "Could not confirm removal. Reload notes to check."); }
    finally { if (alive.current && accountEpoch.current === epoch && owner.current === account) { action.current = false; setBusy(false); } }
  };
  const showIdeas = async () => {
    if (ideasAction.current || hasShoppingPending) return;
    const ingredientOptions = { useIngredient: selectedPantry ? undefined : useIngredient.trim() || undefined, skipIngredient: skipIngredient.trim() || undefined, pantryItem: selectedPantry?.canonicalItem };
    let normalizedIngredients;
    try { normalizedIngredients = { useIngredient: selectedPantry?.canonicalItem ?? planIngredientName(useIngredient), skipIngredient: planIngredientName(skipIngredient) }; }
    catch { setIdeas(null); setIdeasError("Enter one ingredient name per field, up to 100 characters, without commas, semicolons or alternatives."); return; }
    ideasAction.current = true; setIdeas(null);
    const account = owner.current; const epoch = accountEpoch.current; setIdeasBusy(true); setIdeasError(null);
    try {
      const response = await api.planTogether({ strictDietary: true, maxMinutes, pantryOnly, ...ingredientOptions });
      if (alive.current && accountEpoch.current === epoch && owner.current === account) {
        setIdeas(response.ideas);
        setIngredientSummary(`Ingredient names used for matching: use ${normalizedIngredients.useIngredient ?? "any"}; skip ${normalizedIngredients.skipIngredient ?? "none"}.`);
      }
    } catch { if (alive.current && accountEpoch.current === epoch && owner.current === account) setIdeasError("Meal ideas or saved dietary settings could not load, or the selected pantry item changed. Reload pantry choices and try again, or use Feed me gently with temporary choices."); }
    finally { if (alive.current && accountEpoch.current === epoch && owner.current === account) { ideasAction.current = false; setIdeasBusy(false); } }
  };
  const todayNotes = dayNotes;
  const recent = notes.filter((note, index) => notes.findIndex(other => other.title === note.title && other.portion === note.portion) === index).slice(0, 3);
  return <div className={`${styles.page} ${styles.stack}`}>
    {showInvitation ? <Panel><PanelHeader title="Want to plan something to eat together?" hint="We can start with what your pantry thinks is still there. You can correct it, choose something else, or leave this for later." />
      <fieldset className={styles.limits} disabled={ideasBusy || hasShoppingPending}><legend>Optional limits for these ideas</legend>
        <label>Time available <select value={maxMinutes ?? ""} onChange={event => { setMaxMinutes(event.target.value ? Number(event.target.value) as PlanTogetherOptions["maxMinutes"] : undefined); setIdeas(null); setIdeasError(null); }}>
          <option value="">No time limit</option>{([10, 20, 30, 60] as const).map(minutes => <option key={minutes} value={minutes}>Up to {minutes} minutes</option>)}
        </select></label>
        <label>Use this ingredient (optional)<TextField value={useIngredient} maxLength={100} placeholder="For example, bananas" onChange={event => { setSelectedPantry(null); setUseIngredient(event.target.value); setIdeas(null); setIdeasError(null); }} /></label>
        <label>Skip this ingredient today (optional)<TextField value={skipIngredient} maxLength={100} placeholder="For example, mushrooms" onChange={event => { setSkipIngredient(event.target.value); setIdeas(null); setIdeasError(null); }} /></label>
        <label className={styles.pantryToggle}><input type="checkbox" checked={pantryOnly} onChange={event => { setPantryOnly(event.target.checked); setIdeas(null); setIdeasError(null); }} /> No shopping today: match pantry names only</label>
      </fieldset>
      {selectedPantry ? <p role="status">Selected from your saved pantry: {selectedPantry.displayName}. Check it, then choose Show me some ideas. <Button variant="ghost" disabled={ideasBusy || hasShoppingPending} onClick={() => { setSelectedPantry(null); setIdeas(null); setIdeasError(null); }}>Clear pantry choice</Button></p> : null}
      <PantryPlanningPicker client={api} disabled={ideasBusy || hasShoppingPending} onChoose={item => { setSelectedPantry(item); setUseIngredient(""); setIdeas(null); setIdeasError(null); }} />
      <p>These ingredient choices apply only to this search. They do not change your pantry or dietary profile. Matching checks whether a recipe lists a normalized ingredient name, including optional ingredients. It does not confirm amounts, preparation or hidden ingredients; an optional ingredient may not be used. Skipping a name does not verify allergy safety; use your dietary profile for allergens and check labels.</p>
      <p>Time uses the saved total; check the steps for waiting time. Unknown times are excluded when you choose a limit. No-shopping matches check every listed ingredient, including staples and optional items. Names do not confirm quantities or preparation. We check up to 40 saved recipe candidates; no match does not mean your whole library was checked.</p>
      <FieldRow><Button disabled={ideasBusy || hasShoppingPending} onClick={() => void showIdeas()}>{ideasBusy ? "Finding ideas…" : "Show me some ideas"}</Button><Button variant="ghost" disabled={hasShoppingPending} onClick={() => setShowInvitation(false)}>Not now</Button><Link href="/care">Feed me gently</Link></FieldRow>
      {ideasError ? <Callout tone="error" role="alert">{ideasError}</Callout> : null}
      {ideas !== null ? <p role="status">{ingredientSummary}</p> : null}
      {ideas?.length === 0 ? <p>No suitable saved recipes matched. <Link href="/discover">Browse starter recipes</Link> or <Link href="/care">choose something simple</Link>. Restrictions weren’t loosened.</p> : null}
      {ideas?.map(idea => <article className={styles.idea} key={idea.recipeId}><h3><Link href={`/recipe/${idea.recipeId}`}>{idea.title}</Link></h3><p>{idea.totalMinutes === null ? "Total time not recorded" : `${idea.totalMinutes} minutes total`}</p><p>{idea.reason}</p><p>Pantry names matched: {idea.have.join(", ") || "none"}. Still needed: {idea.missing.join(", ") || "no additional names identified"}.</p><MissingShoppingReview missing={idea.missing} client={api} onPending={pending => setShoppingPending(current => ({ ...current, [idea.recipeId]: pending }))} /><PlanIdeaReview recipeId={idea.recipeId} title={idea.title} client={api} onPending={pending => setShoppingPending(current => ({ ...current, [`plan:${idea.recipeId}`]: pending }))} /></article>)}
      {ideas?.length ? <p>Suggestions require the saved dietary tags to be explicitly present and exclude detected allergen conflicts. Tags can be wrong or incomplete. Matches use ingredient names, not quantities or preparation. Check what is actually available and your package labels. Suggestions do not verify allergy safety.</p> : null}
    </Panel> : <Button variant="ghost" onClick={() => setShowInvitation(true)}>Show the meal-planning invitation</Button>}
    <Panel><PanelHeader title="An optional food note" hint="A small memory aid, not a score. Record what you want to remember. No calorie goals, streaks, reminders or automatic pantry updates." />
      {loading ? <p role="status">Loading your notes…</p> : null}
      {loadError ? <Callout tone="error" role="alert">{loadError}</Callout> : null}
      <Button variant="ghost" disabled={busy || loading} onClick={() => void load()}>Reload food notes</Button>
      <form className={styles.stack} onSubmit={event => { event.preventDefault(); void save(); }}>
        <label>Date<TextField type="date" value={date} disabled={busy || recording || unconfirmed} onChange={event => setDate(event.target.value)} /></label>
        <label>Food name<TextField value={title} maxLength={160} disabled={busy || recording || unconfirmed} onChange={event => { setTitle(event.target.value); setSource("text"); }} /></label>
        <label>Portion, if you know it (optional)<TextField value={portion} maxLength={120} disabled={busy || recording || unconfirmed} onChange={event => setPortion(event.target.value)} placeholder="For example, one bowl; leave blank if unsure" /></label>
        {uncertainty ? <Callout tone="warn">{uncertainty} Photo portions are unknown; add one only if you know it.</Callout> : null}
        {unconfirmed && !busy ? <Callout tone="warn">The save was not confirmed. This draft stays unchanged for a retry with the same reference. Reload first to check whether it already saved.</Callout> : null}
        <Button type="submit" disabled={busy || recording || !loaded || !title.trim()}>{busy ? "Working…" : unconfirmed ? "Retry the same food note" : draftId.current ? "Save reviewed edits" : "Save food note"}</Button>
        <FieldRow><Button type="button" variant="ghost" disabled={busy || recording || !title} onClick={() => {
          if (action.current || (pendingSave.current && !window.confirm("The note may already have saved. Discard this local draft only? Reload notes before adding it again."))) return;
          pendingSave.current = null; setUnconfirmed(false); setTitle(""); setPortion(""); setSource("text"); setUncertainty(""); draftId.current = null; setError(""); setStatus("Local draft discarded. Saved notes were not removed.");
        }}>Discard draft</Button></FieldRow>
      </form>
      <details className={styles.capture}><summary>Use a photo or voice note instead</summary>
        {!capture && !captureError ? <p role="status">Checking photo and voice availability… Text entry is ready above.</p> : null}
        {captureError ? <Callout tone="info" role="status">Could not check photo and voice availability. Your typed draft is unchanged.
          <Button type="button" variant="ghost" onClick={() => setCaptureVisit(value => value + 1)}>Check capture availability again</Button>
        </Callout> : null}
        <p>Only when you choose to send it, the file goes to OpenAI to prepare an editable draft. Savortome does not save the original file or raw transcript. Provider processing and retention are governed by our configured OpenAI service. A photo cannot establish hidden ingredients, portions, nutrients or allergy safety.</p>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose a food photo for an editable draft" disabled={busy || recording || unconfirmed || !capture?.photo} onChange={event => {
          const file = event.target.files?.[0]; event.target.value = "";
          if (file && title.trim() && !window.confirm("Replace the current unsaved food draft with a photo suggestion?")) return;
          if (file) void generate("photo", file);
        }} />
        {capture && !capture.photo ? <p>Photo suggestions aren’t enabled in this build. You can type a note.</p> : null}
        {capture?.voice ? <div className={styles.stack}>
          <p>Record up to 45 seconds. Recording stops and is discarded when you leave this screen or hide the app. Nothing is sent until you select Send for editable draft.</p>
          <FieldRow><Button variant="ghost" disabled={busy || unconfirmed || !loaded} onClick={() => recording ? stopCapture() : void startVoice()}>{recording ? "Stop recording" : "Record a voice note"}</Button>
            {voiceBlob ? <><Button disabled={busy || unconfirmed} onClick={() => {
              if (title.trim() && !window.confirm("Replace the current unsaved food draft with a voice suggestion?")) return;
              void generate("voice", voiceBlob);
            }}>Send for editable draft</Button><Button variant="ghost" disabled={busy} onClick={() => setVoiceBlob(null)}>Discard recording</Button></> : null}</FieldRow>
          {recording ? <p role="status">Recording. Stop whenever you want.</p> : voiceBlob ? <p role="status">Recording ready; not sent yet.</p> : null}
        </div> : capture ? <p>Voice transcription isn’t enabled in this build. Your keyboard’s dictation can still enter text.</p> : null}
      </details>
      {status ? <Callout tone="info" role="status">{status}</Callout> : null}
      {error ? <Callout tone="error" role="alert">{error} {needsSignIn ? <Link href={signInReturnHref("/today")}>Sign in again</Link> : null}</Callout> : null}
    </Panel>
    <Panel><PanelHeader title="Your recent notes for this day" hint="Shows up to 30 notes for the selected date. These record what you told us, not what remains in your pantry." />
      {dayState === "loading" ? <p role="status">Loading this day's notes…</p> : null}
      {dayState === "failed" ? <Callout tone="error" role="alert">This day's notes could not load. Check the date or reload your notes; an empty display does not mean they were deleted.</Callout> : null}
      {dayState === "ready" && !todayNotes.length ? <p>No notes for this day. Leaving this empty is fine.</p> : null}
      {todayNotes.map(note => <article className={styles.idea} key={note.id}><h3>{note.title}</h3><p>{note.portion ?? "Portion not recorded"}</p>
        <FieldRow><Button variant="ghost" aria-label={`Edit food note for ${note.title}`} disabled={busy || recording || unconfirmed} onClick={() => {
          if (action.current || pendingSave.current) return;
          if (title.trim() && !window.confirm("Replace your current unsaved draft with this note?")) return;
          setTitle(note.title); setPortion(note.portion ?? ""); setDate(note.date); setSource(note.source); draftId.current = note.id; setUncertainty(""); setStatus("Editing an existing note. Save to confirm your changes.");
        }}>Edit note</Button><Button variant="ghost" aria-label={`Remove food note for ${note.title}`} disabled={busy || recording || unconfirmed} onClick={() => setConfirmDelete(note.id)}>Remove note</Button></FieldRow>
        {confirmDelete === note.id ? <div role="group" aria-label={`Confirm removing ${note.title}`}><p>Remove this food note?</p><FieldRow><Button variant="danger" disabled={busy} onClick={() => void remove(note.id)}>Confirm removal</Button><Button variant="ghost" disabled={busy} onClick={() => setConfirmDelete(null)}>Keep note</Button></FieldRow></div> : null}
      </article>)}
    </Panel>
    {loaded && recent.length ? <Panel><PanelHeader title="Something familiar" hint="Copy a previous food note into a new draft if you want. It only records another meal when you explicitly save it." />
      {recent.map(note => <Button key={note.id} variant="ghost" disabled={busy || recording || unconfirmed} onClick={() => {
        if (action.current || pendingSave.current) return;
        if (title.trim() && !window.confirm("Replace your current unsaved food draft?")) return;
        setTitle(note.title); setPortion(note.portion ?? ""); setSource("repeat"); setUncertainty(""); draftId.current = null; setStatus("New repeat draft ready. Nothing saved yet.");
      }}>Use {note.title} as a new draft</Button>)}
    </Panel> : null}
  </div>;
}
