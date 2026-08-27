import { useEffect } from "react";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { hintForUrl, type ImportMode, type ImportRequest } from "@seconds/core/format";
import { Button, Field, space, type as typeScale, usePalette } from "@/ui";
import { ClipboardSuggestion } from "./ClipboardSuggestion";
import { ModeSwitch } from "./ModeSwitch";
import { useClipboardLink } from "./useClipboardLink";

export function ImportForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (request: ImportRequest) => void;
}) {
  const c = usePalette();
  const [mode, setMode] = useState<ImportMode>("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const { suggestion, dismiss } = useClipboardLink();

  // A link already in the field beats the same one sitting on the clipboard.
  useEffect(() => {
    if (suggestion && suggestion === url) dismiss();
  }, [suggestion, url, dismiss]);

  const hint = mode === "url" ? hintForUrl(url) : undefined;
  const canSubmit = !busy && (mode === "url" ? url.trim().length > 0 : text.trim().length > 0);

  return (
    <View>
      <ModeSwitch mode={mode} onChange={setMode} />

      {mode === "url" && suggestion && suggestion !== url ? (
        <ClipboardSuggestion
          url={suggestion}
          onUse={() => {
            setUrl(suggestion);
            dismiss();
          }}
          onDismiss={dismiss}
        />
      ) : null}

      {mode === "url" ? (
        <Field
          value={url}
          onChangeText={setUrl}
          placeholder="https://www.youtube.com/watch?v=..."
          autoCapitalize="none"
          autoCorrect={false}
          inputMode="url"
          editable={!busy}
          onSubmitEditing={() => {
            if (canSubmit) onSubmit({ url });
          }}
        />
      ) : (
        <Field
          value={text}
          onChangeText={setText}
          placeholder="Paste a recipe, a screenshot transcription, or a text from a friend."
          multiline
          editable={!busy}
        />
      )}

      {hint && !busy ? <Text style={[styles.hint, { color: c.textMuted }]}>{hint}</Text> : null}

      <View style={styles.submit}>
        <Button
          label={busy ? "Importing…" : "Import"}
          disabled={!canSubmit}
          onPress={() => onSubmit(mode === "url" ? { url } : { text })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: typeScale.small, marginTop: space.md },
  submit: { marginTop: space.md, alignSelf: "flex-start" },
});
