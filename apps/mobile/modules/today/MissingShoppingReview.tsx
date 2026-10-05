import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { mealShoppingNames, type SecondsClient } from "@seconds/core/format";
import { Button, Callout, space, type as typeScale, usePalette } from "@/ui";

export function MissingShoppingReview({ missing, client, onPending }: { missing: string[]; client: SecondsClient; onPending: (pending: boolean) => void }) {
  const c = usePalette(); const router = useRouter();
  const [names] = useState(() => mealShoppingNames(missing));
  const [selected, setSelected] = useState(names); const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState<string[] | null>(null); const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(""); const [done, setDone] = useState(false);
  const alive = useRef(true); const action = useRef(false);
  const visit = useRef(0); const focused = useRef(false);
  useFocusEffect(useCallback(() => { focused.current = true; action.current = false; setBusy(false); return () => { focused.current = false; ++visit.current; }; }, []));
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  if (!names.length) return null;
  const save = async () => {
    if (!alive.current || !focused.current || action.current || done || !selected.length) return;
    action.current = true; setBusy(true); setMessage("");
    const exact = pending ?? [...selected]; setPending(exact); onPending(true);
    const version = ++visit.current;
    try {
      await client.addItemsToList(exact.map(canonicalItem => ({ canonicalItem, displayName: canonicalItem })));
      if (alive.current && focused.current && visit.current === version) { setDone(true); setPending(null); onPending(false); setMessage("Selected names added. Existing amounts and check marks were kept. Pantry and meal plans were not changed."); }
    } catch { if (alive.current && focused.current && visit.current === version) setMessage("We could not confirm the update. It may already have saved. Your exact selection is kept; retry it or check your list before changing anything."); }
    finally { if (alive.current && focused.current && visit.current === version) { action.current = false; setBusy(false); } }
  };
  const discardRetry = () => {
    if (action.current || !pending || !alive.current || !focused.current) return;
    const version = visit.current;
    Alert.alert("Discard local retry state?", "The earlier update may already have saved. This does not undo it.", [
      { text: "Keep selection", style: "cancel" },
      { text: "Discard", onPress: () => {
        if (!alive.current || !focused.current || visit.current !== version || action.current) return;
        setPending(null); onPending(false);
        setMessage("Local retry state discarded. Check your list before adding anything again.");
      } },
    ]);
  };
  const text = { color: c.textMuted, fontSize: typeScale.body, lineHeight: 23 };
  return <View style={{ gap: space.sm }}><Button label={expanded ? "Hide missing-item review" : "Review missing items for my list"} variant="ghost" onPress={() => setExpanded(value => !value)} />
    {expanded ? <><Text style={text}>Choose names to add. Quantities are not inferred. Staples and optional ingredients are not included; check the full recipe too. This does not order groceries.</Text>
      {names.map(name => <Button key={name} label={name} variant="toggle" selected={selected.includes(name)} disabled={busy || pending !== null || done} onPress={() => setSelected(current => current.includes(name) ? current.filter(item => item !== name) : [...current, name])} />)}
      <Button label={busy ? "Updating list…" : pending ? `Retry the same ${pending.length} names` : `Add ${selected.length} selected names to my list`} disabled={busy || done || !selected.length} onPress={() => void save()} />
      <Button label="Check my shopping list" variant="ghost" onPress={() => router.push("/(protected)/(tabs)/list")} />
      {pending ? <><Text style={text}>The result is unconfirmed. Changing ideas is paused to keep your selection. Leaving Today may lose this local retry state; check your list when you return.</Text><Button label="Discard local retry state" variant="ghost" disabled={busy} onPress={discardRetry} /></> : null}
      {message ? <Callout tone={done ? "info" : "error"}>{message}</Callout> : null}
    </> : null}
  </View>;
}
