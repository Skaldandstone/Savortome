import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatAmount, type PantryIntakeView } from "@seconds/core/format";
import { Button, Callout, radius, space, type as typeScale, usePalette } from "@/ui";

export function PantryReviewQueue({ intakes, onResolve }: {
  intakes: PantryIntakeView[];
  onResolve: (intakeId: string, action: "accept" | "dismiss", acceptedItemIds?: string[]) => Promise<boolean>;
}) {
  if (intakes.length === 0) return null;
  return (
    <View style={styles.queue}>
      <Text accessibilityRole="header" style={styles.title}>Review recent groceries</Text>
      <Text>Nothing enters your pantry until you confirm what actually came home.</Text>
      {intakes.map(intake => <ReviewCard key={intake.id} intake={intake} onResolve={onResolve} />)}
    </View>
  );
}

function ReviewCard({ intake, onResolve }: {
  intake: PantryIntakeView;
  onResolve: (id: string, action: "accept" | "dismiss", selected?: string[]) => Promise<boolean>;
}) {
  const c = usePalette();
  const [selected, setSelected] = useState(() => intake.items.map(item => item.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [confirmDismiss, setConfirmDismiss] = useState(false);
  const [completed, setCompleted] = useState(false);
  const resolve = async (action: "accept" | "dismiss") => {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const saved = await onResolve(intake.id, action, selected);
      if (saved) {
        setCompleted(true);
        setConfirmDismiss(false);
        setStatus(action === "accept" ? "Selected groceries added to your pantry." : "Review dismissed. No items were added to your pantry.");
      } else {
        setError("We could not confirm that the review saved. Your selection is still here. Check your pantry before trying again.");
      }
    } catch {
      setError("We could not confirm that the review saved. Your selection is still here. Check your pantry before trying again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text accessibilityRole="header" style={[styles.cardTitle, { color: c.text }]}>
        {intake.sourceLabel || (intake.source === "receipt" ? "Scanned receipt" : "Grocery order")}
      </Text>
      <Text style={[styles.legend, { color: c.textMuted }]}>Choose what actually came home</Text>
      {intake.items.map(item => {
        const checked = selected.includes(item.id);
        const amount = formatAmount(item);
        const label = `${amount ? `${amount} ` : ""}${item.displayName}`;
        return (
          <Pressable
            key={item.id}
            disabled={busy || completed}
            accessibilityRole="checkbox"
            accessibilityState={{ checked, disabled: busy || completed }}
            accessibilityLabel={label}
            onPress={() => setSelected(current => checked ? current.filter(id => id !== item.id) : [...current, item.id])}
            style={styles.checkRow}
          >
            <Text style={[styles.check, { color: c.accent }]}>{checked ? "☑" : "☐"}</Text>
            <Text style={[styles.itemText, { color: c.text }]}>{label}</Text>
          </Pressable>
        );
      })}
      <Text style={[styles.note, { color: c.textMuted }]}>Confirming replaces an existing displayed quantity. You can correct it afterward.</Text>
      <View style={styles.actions}>
        <Button label={busy ? "Saving review…" : "Add selected items"} disabled={busy || completed || confirmDismiss || selected.length === 0} onPress={() => void resolve("accept")} />
        <Button label="Dismiss" variant="ghost" disabled={busy || completed} onPress={() => { setConfirmDismiss(true); setError(""); }} />
      </View>
      {confirmDismiss ? (
        <View style={{ gap: space.sm }}>
          <Text style={{ color: c.text }}>Dismiss this review without adding any items? You can keep it here to review later.</Text>
          <View style={styles.actions}>
            <Button label="Dismiss this review" disabled={busy} onPress={() => void resolve("dismiss")} />
            <Button label="Keep reviewing" variant="ghost" disabled={busy} onPress={() => { setConfirmDismiss(false); setError(""); }} />
          </View>
        </View>
      ) : null}
      {error ? <Callout tone="error">{error}</Callout> : null}
      {status ? <Callout tone="info">{status}</Callout> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  queue: { gap: space.md, marginBottom: space.lg },
  title: { fontSize: typeScale.title, fontWeight: "700" },
  card: { gap: space.sm, padding: space.md, borderWidth: 1, borderRadius: radius.md },
  cardTitle: { fontSize: typeScale.title, fontWeight: "700" },
  legend: { fontSize: typeScale.small, fontWeight: "600" },
  checkRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: space.sm },
  check: { fontSize: 22 },
  itemText: { flex: 1, fontSize: typeScale.body },
  note: { fontSize: typeScale.micro, lineHeight: 17 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
