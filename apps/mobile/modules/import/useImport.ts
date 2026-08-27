import { useCallback, useRef, useState } from "react";
import {
  ApiError,
  IMPORT_STAGE_DELAYS,
  type ImportFailure,
  type ImportRequest,
  type ImportResponse,
} from "@seconds/core/format";
import { api } from "@/lib/client";
import { apiBaseUrl } from "@/lib/api";

export interface ImportController {
  /** Index into IMPORT_STAGES while a request is in flight, null when idle. */
  stage: number | null;
  busy: boolean;
  error: ImportFailure | null;
  result: ImportResponse | null;
  run: (request: ImportRequest) => Promise<void>;
}

/** Same lifecycle as the web hook, pointed at the server over the network. */
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
      if (err instanceof ApiError) {
        setError({ message: err.message, trace: err.trace });
      } else {
        // A transport failure on mobile is almost always the wrong host, so say so.
        setError({
          message:
            err instanceof Error
              ? `${err.message} (is the Second Breakfast server running at ${apiBaseUrl()}?)`
              : "The import failed.",
        });
      }
    } finally {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setStage(null);
    }
  }, []);

  return { stage, busy: stage !== null, error, result, run };
}
