import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/lib/client";
import { StarRating } from "@/modules/shelves";
import { Button, Callout, Field, radius, space, type as typeScale, usePalette } from "@/ui";

/**
 * What happens when the last step is ticked.
 *
 * Cooking something is the strongest signal there is about what a person
 * actually makes — stronger than a star, which is why the counter is bumped
 * here whether or not they rate it. Asking now also catches the one moment
 * they have an opinion; a week later nobody goes back to rate anything.
 */
export function FinishPanel({ recipeId }: { recipeId: string }) {
  const [stars, setStars] = useState(0);
  const [review, setReview] = useState("");
  const [counted, setCounted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const c = usePalette();

  // Marking it cooked isn't a decision worth interrupting anyone for — they
  // just cooked it. Rating is the part that's asked rather than assumed.
  useEffect(() => {
    let cancelled = false;
    void api
      .setStatus(recipeId, "cooked")
      .then(() => {
        if (!cancelled) setCounted(true);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't record that.");
      });
    return () => {
      cancelled = true;
    };
  }, [recipeId]);

  const rate = async (value: number) => {
    setStars(value);
    setError(null);
    try {
      await api.rateRecipe(recipeId, value, review.trim() || null);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that rating.");
    }
  };

  return (
    <View style={[styles.finish, { backgroundColor: c.accentSoft, borderColor: c.accent }]}>
      <Text style={[styles.title, { color: c.text }]}>That&apos;s the lot.</Text>
      <Text style={[styles.body, { color: c.textMuted }]}>
        {counted ? "Marked as cooked and added to your count." : "Recording that you made it…"}
      </Text>

      <View style={styles.rate}>
        <Text style={{ color: c.text, fontSize: typeScale.body }}>How was it?</Text>
        <StarRating stars={stars} onRate={(value) => void rate(value)} />
      </View>

      {stars > 0 ? (
        <Field
          value={review}
          multiline
          style={styles.review}
          placeholder="Anything you'd do differently next time?"
          accessibilityLabel="Review"
          onChangeText={setReview}
          onBlur={() => void rate(stars)}
        />
      ) : null}

      {error ? (
        <Callout tone="error">{error}</Callout>
      ) : saved ? (
        <Text style={[styles.body, { color: c.textMuted }]}>Saved.</Text>
      ) : null}

      <View style={styles.actions}>
        <Button label="Back to the recipe" onPress={() => router.replace(`/recipe/${recipeId}`)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  finish: { gap: space.sm, padding: space.lg, borderWidth: 1, borderRadius: radius.md },
  title: { fontSize: typeScale.display, fontWeight: "700" },
  body: { fontSize: typeScale.body, lineHeight: 21 },
  rate: { gap: space.sm, marginTop: space.xs },
  review: { minHeight: 72 },
  actions: { alignSelf: "flex-start", marginTop: space.xs },
});
