import { useCallback, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { formatAmount, pantryAttention, pantryPlanningItems, type PantryEntry, type SecondsClient } from "@seconds/core/format";
import { Button, Callout, space, type as typeScale, usePalette } from "@/ui";

/** Read-only, account-pinned snapshot. Never confirms or consumes inventory. */
export function PantryPlanningPicker({ client, disabled, onChoose }: {
  client: SecondsClient; disabled: boolean; onChoose: (item: PantryEntry) => void;
}) {
  const c = usePalette(); const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<PantryEntry[] | null>(null);
  const [busy, setBusy] = useState(false); const [failed, setFailed] = useState(false);
  const focused = useRef(false); const sequence = useRef(0); const reading = useRef(false);
  useFocusEffect(useCallback(() => {
    focused.current = true; ++sequence.current; reading.current = false; setBusy(false); setItems(null); setFailed(false);
    return () => { focused.current = false; ++sequence.current; };
  }, []));
  const load = async () => {
    if (reading.current || disabled || !focused.current) return;
    reading.current = true; const read = ++sequence.current;
    setBusy(true); setFailed(false); setItems(null);
    try { const result = await client.listPantry(); if (focused.current && sequence.current === read) setItems(result); }
    catch { if (focused.current && sequence.current === read) setFailed(true); }
    finally { if (focused.current && sequence.current === read) { reading.current = false; setBusy(false); } }
  };
  const textStyle = { color: c.textMuted, fontSize: typeScale.body, lineHeight: 23 };
  return <View style={{ gap: space.sm }}>
    <Button label={expanded ? "Hide pantry choices" : "Check what your pantry thinks is still there"} variant="ghost" onPress={() => setExpanded(value => !value)} />
    {expanded ? <>
      <Text style={textStyle}>This is a saved snapshot, not a stock check. Items worth checking appear first. Choosing one only fills the meal search; it does not confirm freshness, presence or quantities.</Text>
      <Button label={busy ? "Loading pantry choices…" : items !== null ? "Refresh pantry choices" : "Check my pantry"} variant="ghost" disabled={disabled || busy} onPress={() => void load()} />
      {busy ? <Text accessibilityLiveRegion="polite" style={textStyle}>Checking your saved pantry…</Text> : null}
      {failed ? <Callout tone="error">Pantry choices could not load. Try again; an empty view does not mean your pantry was cleared. You can still type a temporary ingredient above.</Callout> : null}
      {items?.length === 0 ? <Text style={textStyle}>No saved pantry items. Type a temporary ingredient above or add items in your pantry.</Text> : null}
      {items && items.length > 0 ? <>
        <Text style={textStyle}>Showing {Math.min(items.length, 6)} of {items.length} saved items.</Text>
        {pantryPlanningItems(items).map(item => {
          const attention = pantryAttention(item); const amount = formatAmount(item);
          return <View key={item.canonicalItem} style={{ borderTopWidth: 1, borderColor: c.border, paddingTop: space.sm, gap: space.sm }}>
            <Text accessibilityRole="header" style={{ color: c.text, fontSize: typeScale.body, fontWeight: "600" }}>{item.displayName}</Text>
            <Text style={textStyle}>Saved amount: {amount || "not recorded"}. Not verified now.</Text>
            {attention?.shouldResurface ? <Text style={textStyle}>{attention.message}</Text> : null}
            {item.confidence === "needs_review" ? <Text style={textStyle}>This record still needs your review in the pantry.</Text> : null}
            <Button label={`Use ${item.displayName} for meal ideas`} variant="ghost" disabled={disabled || busy || item.canonicalItem.length > 200} onPress={() => onChoose(item)} />
          </View>;
        })}
      </> : null}
      <Button label="Open pantry to check or correct amounts" variant="ghost" onPress={() => router.push("/cook")} />
    </> : null}
  </View>;
}
