"use client";

import { useCallback, useRef, useState } from "react";
import {
  ApiError,
  IMPORT_STAGE_DELAYS,
  type ImportFailure,
  type ImportRequest,
  type ImportResponse,
} from "@seconds/core/format";
import { api } from "@/lib/client";

export interface ImportController {
  /** Index into IMPORT_STAGES while a request is in flight, null when idle. */
  stage: number | null;
  busy: boolean;
  error: ImportFailure | null;
  result: ImportResponse | null;
  run: (request: ImportRequest) => Promise<void>;
}

/** Owns the request lifecycle so the form components stay presentational. */
export function useImport(): ImportController {
  const [stage, setStage] = useState<number | null>(null);
  const [error, setError] = useState<ImportFailure | null>(null);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const run = useCallback(async (request: ImportRequest) => {
    setError(null);
    setResult(null);
    setStage(0);
    timers.current = IMPORT_STAGE_DELAYS.map((delay, i) => setTimeout(() => setStage(i + 1), delay));

    try {
      setResult(await api.importRecipe(request));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? { message: err.message, trace: err.trace }
          : { message: err instanceof Error ? err.message : "The import failed." },
      );
    } finally {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setStage(null);
    }
  }, []);

  return { stage, busy: stage !== null, error, result, run };
}
