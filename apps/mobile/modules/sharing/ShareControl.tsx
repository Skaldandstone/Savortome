import { useState } from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import {
  VISIBILITIES,
  VISIBILITY_HELP,
  VISIBILITY_LABEL,
  shareUrl,
  type Visibility,
} from "@nomnom/core/format";
import { api } from "@/lib/client";
import { apiBaseUrl } from "@/lib/api";
import { Button, Callout, radius, space, type as typeScale, usePalette } from "@/ui";

/**
 * Who can see this recipe, and the system share sheet to send it.
 *
 * On mobile the share sheet is the whole point — it hands the link to whatever
 * the person already uses to talk to their friends, rather than making them
 * copy a URL and find the app themselves.
 */
export function ShareControl({
  recipeId,
  initialVisibility,
}: {
  recipeId: string;
  initialVisibility: Visibility;
}) {
  const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const c = usePalette();

  const link = shareUrl(recipeId, apiBaseUrl());

  const change = async (next: Visibility) => {
    const previous = visibility;
    setVisibility(next);
    setSaving(true);
    setError(null);
    try {
      const result = await api.setVisibility(recipeId, next);
      if (result.visibility === null) throw new Error("That recipe isn't yours to share.");
      setVisibility(result.visibility);
    } catch (err) {
      setVisibility(previous);
      setError(err instanceof Error ? err.message : "Couldn't change that.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.share, { backgroundColor: c.surfaceSunken }]}>
      <Text style={[styles.label, { color: c.textMuted }]}>SHARING</Text>

      <View style={styles.options}>
        {VISIBILITIES.map((option) => (
          <Button
            key={option}
            label={VISIBILITY_LABEL[option]}
            variant="toggle"
            selected={visibility === option}
            disabled={saving}
            onPress={() => void change(option)}
          />
        ))}
      </View>

      <Text style={[styles.help, { color: c.textMuted }]}>{VISIBILITY_HELP[visibility]}</Text>

      {visibility !== "private" ? (
        <View style={styles.shareAction}>
          <Button
            label="Send link"
            onPress={() => {
              void Share.share({ message: link, url: link });
            }}
          />
        </View>
      ) : null}

      {error ? <Callout tone="error">{error}</Callout> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  share: { marginTop: space.lg, padding: space.md + 2, borderRadius: radius.sm, gap: space.sm },
  label: { fontSize: typeScale.micro, letterSpacing: 1, fontWeight: "600" },
  options: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  help: { fontSize: typeScale.small, lineHeight: 19 },
  shareAction: { alignSelf: "flex-start", marginTop: space.xs },
});
