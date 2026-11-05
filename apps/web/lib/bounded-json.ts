import { BadRequestError } from "./api";
/** Bound the bytes while reading, including requests with no Content-Length. */
export async function boundedJson(request: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > maxBytes) throw new BadRequestError("That upload is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new BadRequestError("Choose a file to review.");
  let size = 0; const chunks: Uint8Array[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new BadRequestError("That upload took too long. Please try again.")), 15000);
  });
  try {
    while (true) {
      const { value, done } = await Promise.race([reader.read(), timeout]); if (done) break;
      size += value.byteLength; if (size > maxBytes) throw new BadRequestError("That upload is too large."); chunks.push(value);
    }
  } catch (cause) {
    // Transport failures must not surface raw upload-reader diagnostics.
    if (cause instanceof BadRequestError) throw cause;
    throw new BadRequestError("That upload was interrupted. Please try again.");
  } finally {
    if (timer) clearTimeout(timer);
    // Do not wait on a stalled transport's cancellation to return a safe error.
    void reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch { throw new BadRequestError("That upload could not be read."); }
}
