import { Pressable, StyleSheet, Text, View } from "react-native";
import { MAX_STARS } from "@seconds/core/format";
import { usePalette } from "@/ui";

const STARS = Array.from({ length: MAX_STARS }, (_, i) => i + 1);

/** Five stars. Zero means cooked but not yet rated. */
export function StarRating({
  stars,
  disabled,
  onRate,
}: {
  stars: number;
  disabled?: boolean;
  onRate: (stars: number) => void;
}) {
  const c = usePalette();

  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Your rating">
      {STARS.map((value) => (
        <Pressable
          key={value}
          onPress={() => onRate(value)}
          disabled={disabled}
          accessibilityRole="radio"
          accessibilityState={{ checked: stars === value, disabled: !!disabled }}
          accessibilityLabel={`${value} ${value === 1 ? "star" : "stars"}`}
          style={styles.control}
        >
          <Text style={[styles.star, { color: value <= stars ? c.accent : c.border }]}>★</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 2 },
  control: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  star: { fontSize: 24, lineHeight: 28 },
});
