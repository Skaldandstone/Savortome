"use client";

import { useRef, useState } from "react";
import { Callout, Panel, PanelHeader } from "@/ui";
import styles from "./import.module.css";

interface PaprikaImportSummary {
  imported: number;
  skipped: number;
  failed: number;
  overflow: number;
}

/**
 * Brings in a whole Paprika Recipe Manager library at once from its own
 * `.paprikarecipes` export — separate from `ImportForm` above, which always
 * produces exactly one recipe from one link, photo, or paste.
 */
export function PaprikaImport() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<PaprikaImportSummary | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function pickFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setSummary(null);
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/import/paprika", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Couldn't import that file.");
      setSummary(data as PaprikaImportSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't import that file.");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <Panel>
      <PanelHeader
        title="Import your Paprika library"
        hint="In Paprika, use Menu → Export → Export All Recipes, then bring the .paprikarecipes file here. Every recipe comes in free — reading your own export doesn't use an AI import."
      />

      <input
        ref={fileInput}
        type="file"
        accept=".paprikarecipes"
        aria-label="Paprika export file"
        disabled={busy}
        onChange={(e) => void pickFile(e.target.files?.[0])}
      />
      {busy ? <p className={styles.sourceHint} role="status">Importing your library…</p> : null}

      {error ? (
        <Callout tone="error" role="alert">
          {error}
        </Callout>
      ) : null}

      {summary ? (
        <Callout tone={summary.imported > 0 ? "info" : "warn"}>
          {summary.imported} recipe{summary.imported === 1 ? "" : "s"} imported.
          {summary.skipped > 0 ? ` ${summary.skipped} couldn't be read and were skipped.` : ""}
          {summary.failed > 0 ? ` ${summary.failed} failed to save.` : ""}
          {summary.overflow > 0
            ? ` ${summary.overflow} more were left out of this import — bring them in with a second, smaller export.`
            : ""}
        </Callout>
      ) : null}
    </Panel>
  );
}
