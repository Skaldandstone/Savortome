import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import * as Clipboard from "expo-clipboard";
import { looksLikeUrl } from "@nomnom/core/format";

/**
 * The real mobile flow is: watch a recipe video, hit share, copy link, open
 * NomNom. Checking the clipboard when the app comes forward turns that into
 * one tap instead of a paste.
 */
export function useClipboardLink(): { suggestion: string | null; dismiss: () => void } {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  const check = useCallback(async () => {
    try {
      const value = (await Clipboard.getStringAsync()).trim();
      setSuggestion(looksLikeUrl(value) ? value : null);
    } catch {
      setSuggestion(null); // clipboard access can be denied; not worth surfacing
    }
  }, []);

  useEffect(() => {
    void check();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void check();
    });
    return () => sub.remove();
  }, [check]);

  return {
    suggestion: suggestion && suggestion !== dismissed ? suggestion : null,
    dismiss: () => setDismissed(suggestion),
  };
}
