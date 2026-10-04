import { BadRequestError } from "./api";
/** Bound the bytes while reading, including requests with no Content-Length. */
export async function boundedJson(request: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > maxBytes) throw new BadRequestError("That upload is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new BadRequestError("Choose a file to review.");
  let size = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > maxBytes) throw new BadRequestError("That upload is too large."); chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch { throw new BadRequestError("That upload could not be read."); }
}
