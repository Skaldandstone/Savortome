import { ApiError } from "@seconds/core/format";

export interface ActionFailure {
  message: string;
  signInRequired: boolean;
}

/** Turn request failures into plain, recoverable UI copy without exposing server details. */
export function actionFailure(error: unknown, fallback: string): ActionFailure {
  if (error instanceof ApiError && error.status === 401) {
    return {
      message: "Your sign-in may have ended. Sign in again, then retry this action.",
      signInRequired: true,
    };
  }
  return {
    message: error instanceof Error ? error.message : fallback,
    signInRequired: false,
  };
}

/** Clerk receives only an app-local return path, never an arbitrary destination. */
export function signInReturnHref(path: string): string {
  const safe = /^\/(?!\/)[^\r\n]*$/.test(path) ? path : "/";
  return `/sign-in?redirect_url=${encodeURIComponent(safe)}`;
}
