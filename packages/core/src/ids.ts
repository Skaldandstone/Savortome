/**
 * Identifiers that arrive from outside.
 *
 * Every id in this app is a UUID, and every one of them can reach a query via
 * a URL someone typed. Postgres rejects a malformed uuid by raising, which
 * turns a hand-edited address into an error page — and, if the message is ever
 * shown, into a leak of the query text and whatever ids were bound to it.
 *
 * Checking the shape first turns all of that into an ordinary empty result.
 */

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Is this the shape Postgres will accept as a uuid? */
export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID.test(value);

/**
 * A uuid, or undefined.
 *
 * For the common case of a query parameter that may or may not be there and
 * may or may not be nonsense: `shelfFor(params.get("shelf"))` is either a real
 * id or nothing, and callers never have to think about the third possibility.
 */
export const uuidOrUndefined = (value: unknown): string | undefined =>
  isUuid(value) ? value : undefined;
