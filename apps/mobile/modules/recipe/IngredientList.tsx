import { StyleSheet, Text, View } from "react-native";
import { formatAmount, type Ingredient } from "@seconds/core/format";
import { Button, space, type as typeScale, usePalette } from "@/ui";

export function ServingScaler({
  servings,
  onIncrement,
  onDecrement,
}: {
  servings: number;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  const c = usePalette();
  return (
    <View style={styles.scaler}>
      <Button variant="ghost" label="−" accessibilityLabel="Fewer servings" onPress={onDecrement} />
      <Text style={[styles.scalerLabel, { color: c.text }]}>
        {servings} {servings === 1 ? "serving" : "servings"}
      </Text>
      <Button variant="ghost" label="+" accessibilityLabel="More servings" onPress={onIncrement} />
    </View>
  );
}

export function IngredientList({ ingredients }: { ingredients: Ingredient[] }) {
  const c = usePalette();
  let lastGroup: string | null = null;

  return (
    <View>
      {ingredients.map((ing, i) => {
        // Sub-recipe headings ("For the sauce") appear once, above their first item.
        const heading = ing.group && ing.group !== lastGroup ? ing.group : null;
        lastGroup = ing.group;

        return (
          <View key={`${ing.canonicalItem}-${i}`}>
            {heading ? (
              <Text style={[styles.groupHeading, { color: c.text }]}>{heading}</Text>
            ) : null}
            <View style={[styles.row, { borderBottomColor: c.border }]}>
              <Text style={[styles.amount, { color: c.text }]}>{formatAmount(ing)}</Text>
              <Text style={[styles.item, { color: c.text }]}>
                {ing.item}
                {ing.notes ? <Text style={{ color: c.textMuted }}>, {ing.notes}</Text> : null}
                {ing.optional ? <Text style={{ color: c.textMuted }}> (optional)</Text> : null}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  scaler: { flexDirection: "row", alignItems: "center", gap: space.sm },
  scalerLabel: { fontSize: typeScale.small },
  row: { flexDirection: "row", gap: space.md, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth },
  amount: { width: 92, fontWeight: "600", fontSize: typeScale.body, fontVariant: ["tabular-nums"] },
  item: { flex: 1, fontSize: typeScale.body, lineHeight: 21 },
  groupHeading: { fontWeight: "700", fontSize: typeScale.small, paddingTop: space.md + 2 },
});
