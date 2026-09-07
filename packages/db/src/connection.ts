import type { PoolConfig } from 'pg';

/** TLS policy shared by the app and operational checks. */
export function connectionOptions(connectionString: string, nodeEnv = process.env.NODE_ENV) {
  let url: URL;
  try {
    url = new URL(connectionString);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error();
  } catch {
    // URL errors otherwise retain the original input, including credentials.
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');
  }
  // pg gives a nonempty query host precedence over the URL authority, and the
  // last duplicate query value wins. Never classify a remote override as local.
  const host = url.searchParams.getAll('host').at(-1) || url.hostname;
  const local = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(host) && nodeEnv !== 'production';
  // pg lets URL SSL fields replace the explicit TLS object. Use the installed
  // system/RDS CA trust instead; callers must never disable certificate checks.
  const requestedNegotiation = url.searchParams.getAll('sslnegotiation').at(-1);
  const sslNegotiation = requestedNegotiation === 'direct' ? 'direct' : requestedNegotiation === 'postgres' ? 'postgres' : undefined;
  if (requestedNegotiation && !sslNegotiation) {
    throw new Error('DATABASE_URL contains an unsupported TLS negotiation mode.');
  }
  for (const name of ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'sslnegotiation']) url.searchParams.delete(name);
  return {
    connectionString: url.toString(),
    ssl: local && sslNegotiation !== 'direct' ? false as const : { rejectUnauthorized: true },
    // Preserve direct negotiation without letting pg replace the TLS object.
    sslnegotiation: sslNegotiation || undefined,
    max: 5,
    connectionTimeoutMillis: 10000,
  } satisfies PoolConfig;
}
