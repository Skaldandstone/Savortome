import { useState } from "react";
import { Linking, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import {
  formatAmount,
  pantryAttention,
  storageGuideFor,
  type PantryEntry,
  type PantryEntryUpdate,
  type PantryStorageLocation,
} from "@seconds/core/format";
import { Button, Field, radius, space, type as typeScale, usePalette } from "@/ui";

const STORAGE: Array<{ value: PantryStorageLocation; label: string }> = [
  { value: "unknown", label: "Not set" },
  { value: "countertop", label: "Counter" },
  { value: "pantry", label: "Cupboard" },
  { value: "refrigerator", label: "Fridge" },
  { value: "freezer", label: "Freezer" },
];

export function PantryChips({ items, onAdd, onUpdate, onRemove, onClear }: {
  items: PantryEntry[];
  onAdd: (text: string) => void;
  onUpdate: (entry: PantryEntryUpdate) => void;
  onRemove: (canonicalItem: string) => void;
  onClear: () => void;
}) {
  const c = usePalette();
  const [text, setText] = useState("");
  const submit = () => { if (text.trim()) { onAdd(text); setText(""); } };

  return (
    <View style={styles.wrap}>
      <View style={styles.addRow}>
        <Field value={text} onChangeText={setText} placeholder="2 chicken thighs, rice, tomatoes" accessibilityLabel="Add pantry ingredients" autoCapitalize="none" onSubmitEditing={submit} style={styles.input} />
        <Button label="Add" variant="ghost" onPress={submit} />
      </View>
      {items.length === 0 ? (
        <Text style={[styles.empty, { color: c.textMuted }]}>Nothing here yet. Common seasonings and baking staples are already assumed; add anything else you keep in.</Text>
      ) : items.map(item => {
        const amount = formatAmount(item);
        const attention = pantryAttention(item);
        const guide = storageGuideFor(item.canonicalItem);
        return (
          <View key={item.canonicalItem} style={[styles.item, { backgroundColor: c.surface, borderColor: attention?.shouldResurface ? c.warn : c.border }]}>
            <View style={styles.itemHeading}>
              <View style={styles.itemName}>
                <Text style={[styles.name, { color: c.text }]}>{item.displayName}</Text>
                {amount ? <Text style={[styles.amount, { color: c.textMuted }]}>{amount}</Text> : null}
              </View>
              <Button label={`Remove ${item.displayName}`} accessibilityLabel={`Remove ${item.displayName}`} variant="ghost" onPress={() => onRemove(item.canonicalItem)} />
            </View>
            {attention?.shouldResurface ? <Text accessibilityRole="alert" style={[styles.reminder, { color: c.warn }]}>{attention.message}</Text> : null}
            <View style={styles.usualRow}>
              <Text style={[styles.body, { color: c.text }]}>Usually keep this</Text>
              <Switch accessibilityLabel={`Usually keep ${item.displayName}`} value={item.isUsual ?? false} onValueChange={isUsual => onUpdate({ canonicalItem: item.canonicalItem, isUsual })} />
            </View>
            <Text style={[styles.label, { color: c.textMuted }]}>Stored in</Text>
            <View accessibilityRole="radiogroup" style={styles.storage}>
              {STORAGE.map(option => (
                <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ selected: (item.storageLocation ?? "unknown") === option.value }} accessibilityLabel={`${item.displayName}: ${option.label}`} onPress={() => onUpdate({ canonicalItem: item.canonicalItem, storageLocation: option.value })} style={[styles.storageChoice, { borderColor: c.border, backgroundColor: (item.storageLocation ?? "unknown") === option.value ? c.accentSoft : c.surfaceSunken }]}>
                  <Text style={{ color: c.text, fontSize: typeScale.micro }}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.confirm}><Button label={`Still have ${item.displayName}`} variant="ghost" onPress={() => onUpdate({ canonicalItem: item.canonicalItem, confirmPresent: true })} /></View>
            {guide ? <View style={[styles.guidance, { backgroundColor: c.surfaceSunken }]}><Text style={[styles.body, { color: c.text }]}>{guide.storageAdvice}</Text>{guide.separationAdvice ? <Text style={[styles.body, { color: c.textMuted }]}>{guide.separationAdvice}</Text> : null}<Pressable accessibilityRole="link" accessibilityLabel={`Open ${guide.sourceLabel}`} onPress={() => void Linking.openURL(guide.sourceUrl)}><Text style={[styles.source, { color: c.accent }]}>{guide.sourceLabel}</Text></Pressable><Text style={[styles.source, { color: c.textMuted }]}>Check current package directions too.</Text></View> : null}
          </View>
        );
      })}
      {items.length > 0 ? <><Text style={[styles.boundary, { color: c.textMuted }]}>Dates and counts help you remember what may be around. They are not expiry or food-safety guarantees.</Text><Button label="Clear pantry" variant="ghost" onPress={onClear} /></> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md }, addRow: { flexDirection: "row", alignItems: "center", gap: space.sm }, input: { flex: 1 }, empty: { fontSize: typeScale.small, lineHeight: 19 },
  item: { gap: space.sm, borderWidth: 1, borderRadius: radius.md, padding: space.md }, itemHeading: { flexDirection: "row", alignItems: "flex-start", gap: space.sm }, itemName: { flex: 1 }, name: { fontSize: typeScale.title, fontWeight: "700" }, amount: { marginTop: 2, fontSize: typeScale.small },
  body: { fontSize: typeScale.small, lineHeight: 19 }, label: { fontSize: typeScale.micro, fontWeight: "700" }, reminder: { fontSize: typeScale.small, lineHeight: 19, fontWeight: "600" }, usualRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 }, storage: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, storageChoice: { minHeight: 44, justifyContent: "center", borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 10 }, confirm: { alignSelf: "flex-start" }, guidance: { gap: 5, padding: space.sm, borderRadius: radius.sm }, source: { fontSize: typeScale.micro, lineHeight: 17 }, boundary: { fontSize: typeScale.micro, lineHeight: 17 },
});
