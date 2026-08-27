import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  formatAmount,
  type CartProvider,
  type CartProviderId,
  type ShoppingLine,
} from "@seconds/core/format";
import { Button, Callout, Panel, PanelHeader, space, type as typeScale, usePalette } from "@/ui";
import { KrogerConnection } from "./KrogerConnection";
import { useShoppingList } from "./useShoppingList";

type Item = ShoppingLine & { id: string };

function Row({
  item,
  disabled,
  onToggle,
  onRemove,
}: {
  item: Item;
  disabled?: boolean;
  onToggle: (id: string, checked: boolean) => void;
  onRemove: (id: string) => void;
}) {
  const c = usePalette();
  const amount = formatAmount(item);

  return (
    <View style={[styles.row, { borderBottomColor: c.border }]}>
      <Pressable
        style={styles.rowMain}
        disabled={disabled}
        onPress={() => onToggle(item.id, !item.checked)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.checked }}
      >
        <Text style={[styles.box, { color: item.checked ? c.good : c.textMuted }]}>
          {item.checked ? "☑" : "☐"}
        </Text>
        <Text style={[styles.amount, { color: c.textMuted }]}>{amount}</Text>
        <Text
          style={[
            styles.name,
            { color: c.text },
            item.checked && { textDecorationLine: "line-through", opacity: 0.55 },
          ]}
        >
          {item.displayName}
          {item.mayAlreadyHave ? (
            <Text style={{ color: c.textMuted, fontSize: typeScale.small }}>
              {" "}
              · you may already have some
            </Text>
          ) : null}
        </Text>
      </Pressable>
      <Pressable
        disabled={disabled}
        onPress={() => onRemove(item.id)}
        accessibilityLabel={`Remove ${item.displayName}`}
        hitSlop={8}
      >
        <Text style={{ color: c.textMuted, fontSize: typeScale.title }}>×</Text>
      </Pressable>
    </View>
  );
}

function CartSection({
  providers,
  disabled,
  onSend,
}: {
  providers: CartProvider[];
  disabled?: boolean;
  onSend: (provider: CartProviderId) => void;
}) {
  const c = usePalette();
  const withApi = providers.filter((p) => p.kind === "api");
  const handoffs = providers.filter((p) => p.kind === "handoff");

  return (
    <View style={styles.cart}>
      {withApi.length > 0 ? (
        <Panel style={styles.cartGroup}>
          <Text style={[styles.cartHeading, { color: c.textMuted }]}>FILL A CART</Text>
          <View style={styles.cartButtons}>
            {withApi.map((p) => (
              <Button key={p.id} label={p.name} disabled={disabled} onPress={() => onSend(p.id)} />
            ))}
          </View>
        </Panel>
      ) : null}

      <Panel style={styles.cartGroup}>
        <Text style={[styles.cartHeading, { color: c.textMuted }]}>TAKE THE LIST ELSEWHERE</Text>
        <View style={styles.cartButtons}>
          {handoffs.map((p) => (
            <Button
              key={p.id}
              label={p.name}
              variant="ghost"
              disabled={disabled}
              onPress={() => onSend(p.id)}
            />
          ))}
        </View>
        <Text style={[styles.cartNote, { color: c.textMuted }]}>
          DoorDash, Uber Eats, and Safeway have no public cart API, so these copy your list and
          open their store.
        </Text>
      </Panel>
    </View>
  );
}

export function ListScreen() {
  const { list, providers, loading, busy, error, handoff, toggle, remove, clear, sendToCart } =
    useShoppingList();
  const insets = useSafeAreaInsets();
  const c = usePalette();

  const outstanding = list ? list.itemCount - list.checkedCount : 0;
  const items = list?.items ?? [];
  const open = items.filter((i) => !i.checked);
  const done = items.filter((i) => i.checked);

  const send = async (provider: CartProviderId) => {
    const result = await sendToCart(provider);
    if (!result) return;
    if (result.text) await Clipboard.setStringAsync(result.text);
    if (result.url) await Linking.openURL(result.url);
  };

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}
    >
      <Panel>
        <PanelHeader
          title="Shopping list"
          hint="Ingredients merged across recipes, with anything already in your pantry taken off."
        />

        {loading ? (
          <Text style={{ color: c.textMuted }}>Loading…</Text>
        ) : items.length === 0 ? (
          <Text style={{ color: c.textMuted, fontSize: typeScale.small, lineHeight: 19 }}>
            Nothing on the list. Add a recipe, or the missing ingredients from a pantry search.
          </Text>
        ) : (
          <>
            <Text style={[styles.count, { color: c.textMuted }]}>
              {outstanding} to get
              {list && list.checkedCount > 0 ? ` · ${list.checkedCount} in the basket` : ""}
            </Text>

            {open.map((item) => (
              <Row key={item.id} item={item} disabled={busy} onToggle={toggle} onRemove={remove} />
            ))}
            {done.map((item) => (
              <Row key={item.id} item={item} disabled={busy} onToggle={toggle} onRemove={remove} />
            ))}

            <View style={styles.actions}>
              <Button label="Clear list" variant="ghost" disabled={busy} onPress={() => void clear()} />
            </View>
          </>
        )}

        {error ? <Callout tone="error">{error}</Callout> : null}
        {handoff ? (
          <Callout
            tone={handoff.unmatched.length > 0 ? "warn" : "info"}
            title={handoff.note}
          >
            {/* Naming what didn't make it is the whole use of saying some
                didn't: a count leaves the shopper to work out which. */}
            {handoff.unmatched.map((item) => (
              <Text key={item} style={[styles.unmatched, { color: c.textMuted }]}>
                • {item}
              </Text>
            ))}
          </Callout>
        ) : null}
      </Panel>

      {items.length > 0 ? (
        <>
          <CartSection providers={providers} disabled={busy} onSend={(p) => void send(p)} />
          <View style={styles.kroger}>
            <KrogerConnection />
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg + 4, paddingBottom: space.xxl * 3 },
  count: { fontSize: typeScale.small, marginBottom: space.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowMain: { flexDirection: "row", alignItems: "baseline", gap: space.sm, flex: 1 },
  box: { fontSize: typeScale.title },
  amount: { width: 74, fontWeight: "600", fontSize: typeScale.small },
  name: { flex: 1, fontSize: typeScale.body },
  actions: { marginTop: space.md, alignSelf: "flex-start" },
  cart: { marginTop: space.lg, gap: space.md },
  kroger: { marginTop: space.md },
  unmatched: { fontSize: typeScale.small, lineHeight: 19 },
  cartGroup: { padding: space.lg },
  cartHeading: { fontSize: typeScale.micro, letterSpacing: 1, fontWeight: "600", marginBottom: space.sm },
  cartButtons: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  cartNote: { fontSize: typeScale.micro, marginTop: space.sm, lineHeight: 16 },
});
