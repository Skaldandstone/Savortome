import { createClient } from "@seconds/core/format";

/**
 * Same-origin client. The browser sends Clerk's session cookie automatically,
 * so no token supplier is needed here — that's the mobile app's job.
 */
export const api = createClient();
