import { useEffect, useRef, useState } from "react";
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
  onUpdate: (entry: PantryEntryUpdate) => void | Promise<boolean>;
  onRemove: (canonicalItem: string) => void;
  onClear: () => void;
}) {
  const c = usePalette();
  const [text, setText] = useState("");
  const [editingAmount, setEditingAmount] = useState<string | null>(null);
  const [remainingAmount, setRemainingAmount] = useState("");
  const [amountBusy, setAmountBusy] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const mounted = useRef(true);
  const currentItems = useRef(items); currentItems.current = items;
  const editor = useRef<{ item: PantryEntry; input: PantryEntryUpdate | null } | null>(null);
  const flight = useRef<object | null>(null);
  const renderedEditor = editor.current;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; editor.current = null; }; }, []);
  const submit = () => { if (mounted.current && !flight.current && text.trim()) { onAdd(text); setText(""); } };
  const startAmountEdit = (item: PantryEntry) => {
    if (!mounted.current || flight.current || editor.current?.input) return;
    const current = currentItems.current.find(value => value.canonicalItem === item.canonicalItem);
    if (!current || current.unit !== item.unit || current.quantity !== item.quantity || current.updatedAt !== item.updatedAt) return;
    editor.current = { item: { ...current }, input: null };
    setEditingAmount(item.canonicalItem); setAmountError(null);
    setRemainingAmount(item.quantity === null ? "" : String(item.quantity));
  };
  const saveAmount = async (item: PantryEntry) => {
    const edit = editor.current;
    if (!mounted.current || flight.current || !edit || edit !== renderedEditor || edit.item.canonicalItem !== item.canonicalItem) return;
    const quantity = Number(remainingAmount);
    if (!edit.input && (!remainingAmount.trim() || !Number.isFinite(quantity) || quantity <= 0)) return;
    const current = currentItems.current.find(value => value.canonicalItem === edit.item.canonicalItem);
    if (!current || current.unit !== edit.item.unit || (!edit.input && (current.quantity !== edit.item.quantity || current.updatedAt !== edit.item.updatedAt))) {
      setAmountError("This pantry item changed. Your amount is still here; cancel and reopen the editor to review the latest quantity and unit before saving."); return;
    }
    edit.input ??= { canonicalItem: edit.item.canonicalItem, quantity, unit: edit.item.unit, confirmPresent: true };
    const token = {}; flight.current = token; setAmountBusy(true); setAmountError(null);
    try {
      const confirmed = await onUpdate({ ...edit.input });
      if (!mounted.current || editor.current !== edit || flight.current !== token) return;
      if (confirmed !== true) throw new Error("Unconfirmed amount");
      editor.current = null; setEditingAmount(null); setRemainingAmount("");
    } catch {
      if (mounted.current && editor.current === edit) setAmountError("We could not confirm the amount saved. Your correction is kept unchanged for a deliberate retry. It may already have saved; check grocery reviews before cancelling and entering a different amount.");
    } finally {
      if (flight.current === token) { flight.current = null; if (mounted.current) setAmountBusy(false); }
    }
  };
  const cancelAmount = () => {
    if (!mounted.current || flight.current || editor.current !== renderedEditor) return;
    editor.current = null; setEditingAmount(null); setRemainingAmount(""); setAmountError(null);
  };
  const update = (value: PantryEntryUpdate) => { if (mounted.current && !flight.current) void onUpdate(value); };
  const remove = (item: string) => { if (mounted.current && !flight.current) onRemove(item); };

  return (
    <View style={styles.wrap}>
      {editor.current && !items.some(item => item.canonicalItem === editor.current?.item.canonicalItem) ? <View style={styles.amountEditor}>
        <Text accessibilityRole="alert" style={{ color: c.text }}>The edited item no longer appears in the latest pantry. Your local correction ({remainingAmount} {editor.current.item.unit ?? ""}) is kept and may already have saved. Cancel this local edit before correcting another item; cancellation cannot undo an earlier request.</Text>
        <Button label="Cancel amount change" variant="ghost" disabled={amountBusy} onPress={cancelAmount} />
      </View> : null}
      <View style={styles.addRow}>
        <Field value={text} editable={!amountBusy} onChangeText={value => { if (mounted.current && !flight.current) setText(value); }} placeholder="2 chicken thighs, rice, tomatoes" accessibilityLabel="Add pantry ingredients" autoCapitalize="none" onSubmitEditing={submit} style={styles.input} />
        <Button label="Add" variant="ghost" disabled={amountBusy} onPress={submit} />
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
              <Button label={`Remove ${item.displayName}`} accessibilityLabel={`Remove ${item.displayName}`} variant="ghost" disabled={amountBusy} onPress={() => remove(item.canonicalItem)} />
            </View>
            {attention?.shouldResurface ? <><Text accessibilityRole="alert" style={[styles.reminder, { color: c.warn }]}>{attention.message}</Text><View style={styles.promptActions}><Button label="Yes, still here" variant="ghost" disabled={amountBusy} onPress={() => update({ canonicalItem: item.canonicalItem, confirmPresent: true })} /><Button label="Used some" variant="ghost" disabled={amountBusy || !!editor.current?.input} onPress={() => startAmountEdit(item)} /><Button label="All gone" variant="ghost" disabled={amountBusy} onPress={() => remove(item.canonicalItem)} />{([3, 7, 14] as const).map(days => <Button key={days} label={`Remind me in ${days} days`} variant="ghost" disabled={amountBusy} onPress={() => update({ canonicalItem: item.canonicalItem, snoozeDays: days })} />)}<Text>Hides this in-app suggestion until then. No push notification is scheduled.</Text><Button label="Hide this suggestion" variant="ghost" disabled={amountBusy} onPress={() => update({ canonicalItem: item.canonicalItem, resurfaceHidden: true })} /></View></> : null}
            {editingAmount === item.canonicalItem ? <View style={[styles.amountEditor, { backgroundColor: c.surfaceSunken, borderColor: c.border }]}><Text style={[styles.label, { color: c.text }]}>How many {item.unit ? `${item.unit} ` : ""}remain?</Text><Field value={remainingAmount} editable={!amountBusy && !editor.current?.input} onChangeText={value => { if (mounted.current && editor.current === renderedEditor && !flight.current && !editor.current?.input) setRemainingAmount(value); }} keyboardType="decimal-pad" accessibilityLabel={`Remaining amount of ${item.displayName}`} style={styles.amountInput} /><View style={styles.promptActions}><Button label={amountBusy ? "Saving amount..." : "Save amount"} busy={amountBusy} disabled={amountBusy || !remainingAmount.trim() || !Number.isFinite(Number(remainingAmount)) || Number(remainingAmount) <= 0} onPress={() => void saveAmount(item)} /><Button label="Cancel amount change" variant="ghost" disabled={amountBusy} onPress={cancelAmount} /></View>{amountError ? <Text accessibilityRole="alert" style={{ color: c.error }}>{amountError}</Text> : null}</View> : null}
            <View style={styles.usualRow}>
              <Text style={[styles.body, { color: c.text }]}>Usually keep this</Text>
              <Switch accessibilityLabel={`Usually keep ${item.displayName}`} value={item.isUsual ?? false} disabled={amountBusy} onValueChange={isUsual => update({ canonicalItem: item.canonicalItem, isUsual })} />
            </View>
            <View style={styles.usualRow}>
              <Text style={[styles.body, { color: c.text }]}>Show freshness prompts</Text>
              <Switch accessibilityLabel={`Show freshness prompts for ${item.displayName}`} value={!(item.resurfaceHidden ?? false)} disabled={amountBusy} onValueChange={value => update({ canonicalItem: item.canonicalItem, resurfaceHidden: !value })} />
            </View>
            <Text style={[styles.label, { color: c.textMuted }]}>Stored in</Text>
            <View accessibilityRole="radiogroup" style={styles.storage}>
              {STORAGE.map(option => (
                <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ disabled: amountBusy, selected: (item.storageLocation ?? "unknown") === option.value }} accessibilityLabel={`${item.displayName}: ${option.label}`} disabled={amountBusy} onPress={() => update({ canonicalItem: item.canonicalItem, storageLocation: option.value })} style={[styles.storageChoice, { borderColor: c.border, backgroundColor: (item.storageLocation ?? "unknown") === option.value ? c.accentSoft : c.surfaceSunken }]}>
                  <Text style={{ color: c.text, fontSize: typeScale.micro }}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.confirm}><Button label={`Still have ${item.displayName}`} variant="ghost" disabled={amountBusy} onPress={() => update({ canonicalItem: item.canonicalItem, confirmPresent: true })} /></View>
            {guide ? <View style={[styles.guidance, { backgroundColor: c.surfaceSunken }]}><Text style={[styles.body, { color: c.text }]}>{guide.storageAdvice}</Text>{guide.separationAdvice ? <Text style={[styles.body, { color: c.textMuted }]}>{guide.separationAdvice}</Text> : null}<Pressable accessibilityRole="link" accessibilityLabel={`Open ${guide.sourceLabel}`} onPress={() => void Linking.openURL(guide.sourceUrl)}><Text style={[styles.source, { color: c.accent }]}>{guide.sourceLabel}</Text></Pressable><Text style={[styles.source, { color: c.textMuted }]}>Check current package directions too.</Text></View> : null}
          </View>
        );
      })}
      {items.length > 0 ? <><Text style={[styles.boundary, { color: c.textMuted }]}>Dates and counts help you remember what may be around. They are not expiry or food-safety guarantees.</Text><Button label="Clear pantry" variant="ghost" disabled={amountBusy} onPress={() => { if (mounted.current && !flight.current) onClear(); }} /></> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md }, addRow: { flexDirection: "row", alignItems: "center", gap: space.sm }, input: { flex: 1 }, empty: { fontSize: typeScale.small, lineHeight: 19 },
  item: { gap: space.sm, borderWidth: 1, borderRadius: radius.md, padding: space.md }, itemHeading: { flexDirection: "row", alignItems: "flex-start", gap: space.sm }, itemName: { flex: 1 }, name: { fontSize: typeScale.title, fontWeight: "700" }, amount: { marginTop: 2, fontSize: typeScale.small },
  body: { fontSize: typeScale.small, lineHeight: 19 }, label: { fontSize: typeScale.micro, fontWeight: "700" }, reminder: { fontSize: typeScale.small, lineHeight: 19, fontWeight: "600" }, promptActions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm }, amountEditor: { gap: space.sm, borderWidth: 1, borderRadius: radius.sm, padding: space.sm }, amountInput: { minHeight: 44 }, usualRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 }, storage: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, storageChoice: { minHeight: 44, justifyContent: "center", borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 10 }, confirm: { alignSelf: "flex-start" }, guidance: { gap: 5, padding: space.sm, borderRadius: radius.sm }, source: { fontSize: typeScale.micro, lineHeight: 17 }, boundary: { fontSize: typeScale.micro, lineHeight: 17 },
});
