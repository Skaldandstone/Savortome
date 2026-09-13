import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatAmount, type PantryIntakeView } from "@seconds/core/format";
import { Button, radius, space, type as typeScale, usePalette } from "@/ui";

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
  const resolve = async (action: "accept" | "dismiss") => {
    setBusy(true);
    const saved = await onResolve(intake.id, action, selected);
    if (!saved) setBusy(false);
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
            disabled={busy}
            accessibilityRole="checkbox"
            accessibilityState={{ checked, disabled: busy }}
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
        <Button label={busy ? "Saving…" : "Add selected items"} disabled={busy || selected.length === 0} onPress={() => void resolve("accept")} />
        <Button label="Dismiss" variant="ghost" disabled={busy} onPress={() => void resolve("dismiss")} />
      </View>
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
