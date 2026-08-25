import { StyleSheet, Text, View } from "react-native";
import { Callout, radius, space, type as typeScale, usePalette } from "@/ui";
import { ShelfChecklist } from "./ShelfChecklist";
import { StarRating } from "./StarRating";
import { StatusPicker } from "./StatusPicker";
import { useShelfState } from "./useShelfState";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  const c = usePalette();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: c.textMuted }]}>{label.toUpperCase()}</Text>
      {children}
    </View>
  );
}

/**
 * Where a recipe sits in your cooking lifecycle, what you thought of it, and
 * which of your own shelves it belongs on. Hidden until the card has been saved.
 */
export function ShelfControls({ recipeId }: { recipeId: string | null }) {
  const { shelves, state, saving, error, setStatus, toggleShelf, createShelf, rate } =
    useShelfState(recipeId);
  const c = usePalette();

  if (!recipeId) return null;

  const cooked = state?.rating?.timesCooked ?? 0;

  return (
    <View style={[styles.controls, { backgroundColor: c.surfaceSunken }]}>
      <Row label="Shelf">
        <StatusPicker status={state?.status ?? null} disabled={!state} onPress={setStatus} />
      </Row>

      {state?.status === "cooked" || cooked > 0 ? (
        <Row label="Your rating">
          <View style={styles.ratingRow}>
            <StarRating
              stars={state?.rating?.stars ?? 0}
              disabled={!state || saving}
              onRate={(stars) => void rate(stars)}
            />
            {cooked > 0 ? (
              <Text style={[styles.cookCount, { color: c.textMuted }]}>
                cooked {cooked} {cooked === 1 ? "time" : "times"}
              </Text>
            ) : null}
          </View>
        </Row>
      ) : null}

      <Row label="Your shelves">
        <ShelfChecklist
          shelves={shelves}
          shelfIds={state?.shelfIds ?? []}
          disabled={!state || saving}
          onToggle={(shelfId, member) => void toggleShelf(shelfId, member)}
          onCreate={(name) => void createShelf(name)}
        />
      </Row>

      {error ? <Callout tone="error">{error}</Callout> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  controls: {
    marginTop: space.xl + 4,
    padding: space.lg + 2,
    borderRadius: radius.sm,
    gap: space.md + 2,
  },
  row: { gap: space.sm },
  label: { fontSize: typeScale.micro, letterSpacing: 1, fontWeight: "600" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  cookCount: { fontSize: typeScale.small },
});
