import { StyleSheet, View } from "react-native";
import { SHELF_ACTION, STATUS_SHELVES, type StatusShelf } from "@seconds/core/format";
import { Button, space } from "@/ui";

/** The three built-in shelves as one exclusive control. */
export function StatusPicker({
  status,
  disabled,
  onPress,
}: {
  status: StatusShelf | null;
  disabled?: boolean;
  onPress: (shelf: StatusShelf) => void;
}) {
  return (
    <View style={styles.row}>
      {STATUS_SHELVES.map((shelf) => (
        <Button
          key={shelf}
          variant="toggle"
          label={SHELF_ACTION[shelf]}
          selected={status === shelf}
          disabled={disabled}
          onPress={() => onPress(shelf)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.xs, flexWrap: "wrap" },
});
