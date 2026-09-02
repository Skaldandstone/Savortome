import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RecipeDraft } from "@seconds/core/format";
import { api } from "@/lib/client";
import { Button, Callout, Panel, PanelHeader, space, type as typeScale, usePalette } from "@/ui";
import { Basics, Details } from "./DetailFields";
import { IngredientRows } from "./IngredientRows";
import { StepRows } from "./StepRows";
import { useDraft } from "./useDraft";

/**
 * Writing a recipe, and fixing one.
 *
 * The same form does both. A recipe typed by hand and a recipe pulled out of a
 * video are the same thing once they're on the screen, and the moment you
 * correct an imported card it stops being a guess — so saving an edit is also
 * what marks it as checked by a person.
 */
export function RecipeEditorScreen({
  initial,
  recipeId = null,
}: {
  initial: RecipeDraft;
  /** Null when writing a new recipe. */
  recipeId?: string | null;
}) {
  const { draft, set, ingredients, steps } = useDraft(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const c = usePalette();

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const savedId = recipeId ?? (await api.createRecipe(draft)).recipeId;
      if (recipeId) await api.updateRecipe(recipeId, draft);
      router.replace(`/recipe/${savedId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!recipeId) return;
    setSaving(true);
    try {
      await api.deleteRecipe(recipeId);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete that.");
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: recipeId ? "Edit recipe" : "Write a recipe" }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={{ backgroundColor: c.bg }}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl * 2 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Panel>
            <PanelHeader
              title={recipeId ? "Edit recipe" : "Write a recipe"}
              hint={
                recipeId
                  ? "Saving marks this card as checked, so it stops asking to be reviewed."
                  : "Only the name, one ingredient, and one step are required."
              }
            />
            <Basics draft={draft} set={set} />
          </Panel>

          <Panel>
            <PanelHeader
              title="Ingredients"
              hint="One per line. End a line with a colon to start a section."
            />
            <IngredientRows
              ingredients={draft.ingredients}
              onReplace={ingredients.replace}
              onAdd={ingredients.add}
              onAddHeading={ingredients.addHeading}
              onRemove={ingredients.remove}
              onMove={ingredients.move}
            />
          </Panel>

          <Panel>
            <PanelHeader title="Method" />
            <StepRows
              steps={draft.steps}
              onReplace={steps.replace}
              onAdd={steps.add}
              onRemove={steps.remove}
              onMove={steps.move}
            />
          </Panel>

          <Panel>
            <PanelHeader
              title="Details"
              hint="All optional, and all of it makes the recipe easier to find later."
            />
            <Details draft={draft} set={set} />
          </Panel>

          {error ? (
            <Callout tone="error" title="Couldn't save that">
              {error}
            </Callout>
          ) : null}

          <View style={styles.actions}>
            <Button
              label={saving ? "Saving…" : recipeId ? "Save changes" : "Save recipe"}
              disabled={saving}
              onPress={() => void save()}
            />
            <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
          </View>

          {recipeId ? (
            <View style={styles.danger}>
              {confirmingDelete ? (
                <>
                  <Text style={{ color: c.textMuted, fontSize: typeScale.small }}>
                    Delete this recipe for good?
                  </Text>
                  <View style={styles.dangerButtons}>
                    <Button label="Yes, delete it" variant="danger" onPress={() => void remove()} />
                    <Button
                      label="Keep it"
                      variant="ghost"
                      onPress={() => setConfirmingDelete(false)}
                    />
                  </View>
                </>
              ) : (
                <Button
                  label="Delete recipe"
                  variant="danger"
                  onPress={() => setConfirmingDelete(true)}
                />
              )}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.lg + 4, gap: space.lg },
  actions: { flexDirection: "row", alignItems: "center", gap: space.md },
  danger: { gap: space.sm, alignItems: "flex-start" },
  dangerButtons: { flexDirection: "row", gap: space.sm },
});
