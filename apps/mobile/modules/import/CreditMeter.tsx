import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  TIER_ALLOWANCE,
  TIER_LABEL,
  describeCredits,
  formatPackPrice,
  type CreditBalance,
  type CreditPack,
} from "@seconds/core/format";
import { radius, space, type as typeScale, usePalette } from "@/ui";

/**
 * How many AI imports are left.
 *
 * The same count the web app shows, for the same reason: a limit you discover
 * by hitting it feels like a trap, and one you can see is just a number.
 *
 * Buying happens in a browser rather than in the app. Apple takes 15–30% of an
 * in-app purchase against roughly 3% for web checkout, and on a subscription
 * that difference is worth more than any price change — so the phone hands the
 * transaction to the web app rather than to StoreKit.
 */
export function CreditMeter({
  balance,
  resetsOn,
  packs,
  webUrl,
}: {
  balance: CreditBalance;
  resetsOn: string;
  packs: CreditPack[];
  /** The deployed web origin, where checkout lives. */
  webUrl: string;
}) {
  const c = usePalette();
  const empty = balance.total === 0;

  return (
    <View
      style={[
        styles.meter,
        {
          backgroundColor: empty ? c.warnSoft : c.surfaceSunken,
          borderColor: empty ? c.warn : "transparent",
        },
      ]}
    >
      <Text style={[styles.count, { color: c.text }]}>
        {describeCredits(balance)}
        <Text style={[styles.reset, { color: c.textMuted }]}>
          {" "}
          · {TIER_LABEL[balance.tier]}, {TIER_ALLOWANCE[balance.tier]} a month
          {balance.allowanceLeft > 0 || empty ? ` · resets ${resetsOn}` : ""}
        </Text>
      </Text>

      <Text style={[styles.note, { color: c.textMuted }]}>
        Only videos, social posts and blogs without recipe data use a credit. Most recipe
        sites publish their own, and those imports are always free.
      </Text>

      {empty ? (
        <View style={styles.packs}>
          {packs.map((pack) => (
            <TouchableOpacity
              key={pack.id}
              accessibilityRole="button"
              style={[styles.pack, { borderColor: c.border, backgroundColor: c.surface }]}
              onPress={() => void Linking.openURL(`${webUrl}/?buy=${pack.id}`)}
            >
              <Text style={[styles.packLabel, { color: c.text }]}>
                {pack.credits} credits · {formatPackPrice(pack)}
              </Text>
            </TouchableOpacity>
          ))}
          <Text style={[styles.opens, { color: c.textMuted }]}>Opens in your browser</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  meter: {
    marginBottom: space.lg,
    padding: space.md,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  count: { fontSize: typeScale.body, fontWeight: "600" },
  reset: { fontWeight: "400" },
  note: { marginTop: space.xs, fontSize: typeScale.small, lineHeight: 18 },
  packs: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm, marginTop: space.md },
  pack: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  packLabel: { fontSize: typeScale.small, fontWeight: "600" },
  opens: { fontSize: typeScale.micro },
});
