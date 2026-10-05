import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@clerk/expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isUuid, type OwnedRecipe, type SecondsClient } from "@seconds/core/format";
import { createAccountClient } from "@/lib/client";
import { RecipeCard } from "@/modules/recipe";
import { SavedMealReview } from "@/modules/recipe/SavedMealReview";
import { ShareControl } from "@/modules/sharing";
import { Button, Callout, space, usePalette } from "@/ui";

export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId, sessionId, isLoaded } = useAuth();
  const client = useMemo(() => userId ? createAccountClient(userId) : null, [userId, sessionId]);
  if (!isLoaded) return <Text accessibilityLiveRegion="polite">Loading your sign-in…</Text>;
  if (!client || !sessionId) return <Text>Sign in again to load your saved recipe.</Text>;
  if (typeof id !== "string" || !isUuid(id)) return <Text>This recipe link is not valid. Return to your library to choose a recipe.</Text>;
  return <AccountRecipeScreen key={`${sessionId}:${id}`} id={id} client={client} />;
}

function AccountRecipeScreen({ id, client }: { id: string; client: SecondsClient }) {
  const [recipe, setRecipe] = useState<OwnedRecipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [listBusy, setListBusy] = useState(false);
  const [listUnconfirmed, setListUnconfirmed] = useState(false);
  const [listMessage, setListMessage] = useState("");
  const [mealPending, setMealPending] = useState(false);
  const focused = useRef(false); const generation = useRef(0); const action = useRef(false);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const c = usePalette();

  useFocusEffect(useCallback(() => {
    focused.current = true;
    const visit = ++generation.current;
    action.current = false; setListBusy(false);
    setLoading(true); setError(null); setRecipe(null);
    void (async () => {
      try {
        const next = await client.getRecipe(id);
        if (next.id.toLowerCase() !== id.toLowerCase()) throw new Error("Unconfirmed recipe");
        if (focused.current && generation.current === visit) setRecipe(next);
      } catch {
        if (focused.current && generation.current === visit) setError("We could not load this saved recipe. It may be unavailable, your sign-in may have expired, or the connection may have failed. Try again before using its ingredients.");
      } finally {
        if (focused.current && generation.current === visit) setLoading(false);
      }
    })();
    return () => {
      focused.current = false; ++generation.current;
      if (action.current) {
        setListUnconfirmed(true); setListBusy(false);
        setListMessage("The shopping-list write is unconfirmed. It may still complete. Check your list before trying another addition.");
      }
    };
  }, [id, client, attempt]));

  const addToList = async () => {
    if (!recipe || loading || action.current || added || listUnconfirmed || mealPending || !focused.current) return;
    const visit = generation.current; action.current = true; setListBusy(true); setListMessage("");
    // Treat every dispatched write as uncertain until a response confirms it.
    setListUnconfirmed(true);
    try {
      const result = await client.addRecipesToList([recipe.id]);
      if (!result || !isUuid(result.id) || !Array.isArray(result.items) || result.items.some(item =>
        !item || !isUuid(item.id) || typeof item.canonicalItem !== "string" || !item.canonicalItem.trim() ||
        (item.quantity !== null && (typeof item.quantity !== "number" || !Number.isFinite(item.quantity))) ||
        (item.unit !== null && typeof item.unit !== "string") || typeof item.checked !== "boolean" ||
        !Array.isArray(item.recipeIds) || !item.recipeIds.every(isUuid)
      )) throw new Error("Unconfirmed shopping list");
      if (focused.current && generation.current === visit) {
        setAdded(true); setListUnconfirmed(false);
        setListMessage("Shopping-list request completed. Review your list and amounts; pantry, staple or optional-item settings may leave some ingredients off. No groceries were ordered and pantry stock was not changed.");
      }
    } catch {
      if (focused.current && generation.current === visit) setListMessage("We could not confirm this addition. It may already be on your list. Check the list and its amounts; nothing will retry automatically.");
    } finally {
      if (focused.current && generation.current === visit) { action.current = false; setListBusy(false); }
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: recipe?.title ?? "Recipe" }} />
      <ScrollView
        style={{ backgroundColor: c.bg }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
      >
        {error ? (
          <View><Callout tone="error" title="Couldn't load that recipe">{error}</Callout><Button label="Try loading recipe again" variant="ghost" onPress={() => setAttempt(value => value + 1)} /></View>
        ) : recipe ? (
          <>
            <RecipeCard recipe={recipe} shelvedId={recipe.id} verifiedAt={recipe.verifiedAt} />
            <ShareControl recipeId={recipe.id} initialVisibility={recipe.visibility} />
            <View style={styles.cookAction}>
              <Button
                label="Start cooking"
                onPress={() => router.push(`/recipe/${recipe.id}/cook`)}
              />
            </View>
            <View style={styles.actions}>
              <Button
                label={listBusy ? "Adding ingredients…" : added ? "List ready to review ✓" : listUnconfirmed ? "Check unconfirmed addition" : "Add ingredients to shopping list"}
                variant="ghost"
                disabled={added || listBusy || listUnconfirmed || mealPending}
                busy={listBusy}
                onPress={() => void addToList()}
              />
              <Button
                label="Edit recipe"
                variant="ghost"
                onPress={() => router.push(`/recipe/${recipe.id}/edit`)}
              />
            </View>
            <Callout>Adds ingredients through your existing shopping list. Review the amounts there. It does not order groceries or consume pantry stock. Leaving this recipe may lose local confirmation state; check your list before adding again.</Callout>
          </>
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator accessibilityLabel="Loading recipe" color={c.accent} />
          </View>
        )}
        <SavedMealReview recipeId={id} title={recipe?.title ?? "the selected recipe"} available={recipe !== null && !loading && !listBusy && !listUnconfirmed} client={client} onPending={setMealPending} />
        {listMessage ? <Callout tone={listUnconfirmed ? "warn" : "info"}>{listMessage}</Callout> : null}
        {recipe || listUnconfirmed || added ? <Button label="Review my shopping list" variant="ghost" onPress={() => router.push("/(protected)/(tabs)/list")} /> : null}
        {listUnconfirmed && !listBusy ? <Button label="I checked the list; allow another addition" variant="ghost" onPress={() => {
          const visit = generation.current;
          Alert.alert("Allow another addition?", "Only continue after checking the list and amounts. An earlier request may still finish; adding again could increase quantities. This does not undo that request.", [
            { text: "Keep paused", style: "cancel" },
            { text: "Allow addition", onPress: () => { if (focused.current && generation.current === visit && !action.current) { setListUnconfirmed(false); setListMessage("Another addition is allowed after your review. Nothing has been resent. Check amounts carefully if you add again."); } } },
          ]);
        }} /> : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg },
  loading: { paddingVertical: space.xxl, alignItems: "center" },
  cookAction: { marginTop: space.lg, alignSelf: "stretch" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md, alignSelf: "flex-start" },
});
