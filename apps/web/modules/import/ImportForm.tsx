"use client";

import { useState } from "react";
import { Button, FieldRow, TextArea, TextField } from "@/ui";
import { ModeSwitch } from "./ModeSwitch";
import { hintForUrl, type ImportMode, type ImportRequest } from "@seconds/core/format";
import styles from "./import.module.css";

export function ImportForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (request: ImportRequest) => void;
}) {
  const [mode, setMode] = useState<ImportMode>("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");

  const hint = mode === "url" ? hintForUrl(url) : undefined;

  return (
    <>
      <ModeSwitch mode={mode} onChange={setMode} />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (busy) return;
          onSubmit(mode === "url" ? { url } : { text });
        }}
      >
        <FieldRow>
          {mode === "url" ? (
            <TextField
              type="url"
              aria-label="Recipe URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              required
              disabled={busy}
            />
          ) : (
            <TextArea
              aria-label="Recipe text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste a recipe, a screenshot transcription, or a text from your mum."
              required
              disabled={busy}
            />
          )}
          <Button type="submit" disabled={busy}>
            {busy ? "Importing…" : "Import"}
          </Button>
        </FieldRow>
      </form>

      {hint && !busy ? <p className={styles.sourceHint}>{hint}</p> : null}
    </>
  );
}
