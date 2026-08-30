import { useState } from "react";
import { KitchenWelcome } from '@/modules/woodland/KitchenWelcome';
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Callout, Field, Panel, PanelHeader, radius, space, type as typeScale, usePalette } from "@/ui";
import { MatchList, QueryReadback } from "./MatchList";
import { PantryChips } from "./PantryChips";
import { usePantry, usePantrySearch } from "./usePantry";

const EXAMPLES = ["chicken thighs, rice, an onion", "something quick and vegetarian", "dinner without dairy"];

/**
 * "What can I make?" — the search box, the saved pantry behind it, and the
 * ranked answer. Searching with an empty box uses the saved pantry, so the
 * common case is one tap rather than retyping.
 */
export function CookScreen() {
  const pantry = usePantry();
  const { response, searching, error, search } = usePantrySearch();
  const [query, setQuery] = useState("");
  const [showPantry, setShowPantry] = useState(false);
  const insets = useSafeAreaInsets();
  const c = usePalette();

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}
      keyboardShouldPersistTaps="handled"
    >
      <KitchenWelcome />
      <Panel>
        <PanelHeader
          title="What can I make?"
          hint="List what you have, or just describe what you're after."
        />

        <View style={styles.searchRow}>
          <Field
            value={query}
            onChangeText={setQuery}
            placeholder={
              pantry.items.length > 0 ? "Leave blank to use your pantry" : "chicken, rice, an onion"
            }
            autoCapitalize="none"
            editable={!searching}
            onSubmitEditing={() => void search(query)}
            style={styles.input}
          />
        </View>

        <View style={styles.actions}>
          <Button
            label={searching ? "Looking…" : "Find recipes"}
            disabled={searching}
            onPress={() => void search(query)}
          />
        </View>

        <View style={styles.examples}>
          {EXAMPLES.map((example) => (
            <Pressable
              key={example}
              disabled={searching}
              onPress={() => {
                setQuery(example);
                void search(example);
              }}
              style={[styles.example, { backgroundColor: c.surfaceSunken, borderColor: c.border }]}
            >
              <Text style={{ color: c.textMuted, fontSize: typeScale.micro }}>{example}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.pantryToggle}>
          <Button
            label={showPantry ? "Hide my pantry" : `My pantry (${pantry.items.length})`}
            variant="ghost"
            onPress={() => setShowPantry((v) => !v)}
          />
        </View>

        {showPantry ? (
          <View style={[styles.pantryPanel, { backgroundColor: c.surfaceSunken }]}>
            <PantryChips
              items={pantry.items}
              onAdd={(text) => void pantry.add(text)}
              onRemove={(item) => void pantry.remove(item)}
              onClear={() => void pantry.clear()}
            />
            {pantry.error ? <Callout tone="error">{pantry.error}</Callout> : null}
          </View>
        ) : null}

        {error ? (
          <Callout tone="error" title="Search failed">
            {error}
          </Callout>
        ) : null}

        {response?.note ? <Callout tone="info">{response.note}</Callout> : null}
      </Panel>

      {response ? (
        <View style={styles.results}>
          <QueryReadback
            query={response.query}
            interpreted={response.interpreted}
            usedPantry={response.usedPantry}
          />
          <MatchList results={response.results} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg + 4, paddingBottom: space.xxl * 3 },
  searchRow: { flexDirection: "row" },
  input: { flex: 1 },
  actions: { marginTop: space.md, alignSelf: "flex-start" },
  examples: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.md },
  example: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 4 },
  pantryToggle: { marginTop: space.md, alignSelf: "flex-start" },
  pantryPanel: { marginTop: space.md, padding: space.md + 2, borderRadius: radius.sm },
  results: { marginTop: space.lg },
});
