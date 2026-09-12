'use client';

// Catches errors thrown in the root layout itself, which no nested error
// boundary can see. Reports to Sentry (a no-op when it is not initialised)
// and renders a minimal page — this replaces the whole document, so it cannot
// rely on the layout's shell, fonts or providers.
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

// A single-task ECS service briefly runs the old and new task during every
// rolling deploy, so a tab holding the old client bundle can call a server
// action the new task never registered. "Try again" would resubmit against
// the same stale bundle, so the only real fix is a hard reload. sentry-shared
// already keeps this out of Sentry as the expected deploy-timing case it is.
const STALE_SERVER_ACTION = 'Failed to find Server Action';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isStaleServerAction = error.message?.includes(STALE_SERVER_ACTION);

  useEffect(() => {
    if (isStaleServerAction) {
      window.location.reload();
      return;
    }
    Sentry.captureException(error);
  }, [error, isStaleServerAction]);

  if (isStaleServerAction) return null;

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#1b1713',
          color: '#f3ece1',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <main style={{ maxWidth: '32rem', padding: '2rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>The kitchen went dark</h1>
          <p style={{ lineHeight: 1.6, marginBottom: '1.5rem' }}>
            Savortome hit an error it couldn’t recover from, and it has been recorded. Your recipes
            are safe. Try again, and if it keeps happening, write to support@skaldandstone.com.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: '0.6rem 1.2rem',
              borderRadius: '0.5rem',
              border: '1px solid #f3ece1',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
