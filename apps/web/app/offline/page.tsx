import Link from "next/link";
import { Panel, PanelHeader } from "@/ui";

// The root layout picks its shell from runtime configuration, so this page
// cannot be prerendered: a build-time copy freezes whichever shell the builder
// saw and serves it with a year-long cache header.
export const dynamic = "force-dynamic";

/**
 * Shown when a page is asked for that was never cached.
 *
 * Precached on install, so it's the one page guaranteed to exist offline.
 */
export default function OfflinePage() {
  return (
    <main>
      <Panel>
        <PanelHeader
          title="No signal"
          hint="This page hasn't been opened on this device before, so there's no copy to read."
        />
        <p style={{ marginTop: 0 }}>
          Recipes you&rsquo;ve already opened are still readable — try{" "}
          <Link href="/">your library</Link>. Importing needs a connection, since it
          fetches the page or video you&rsquo;re importing from.
        </p>
      </Panel>
    </main>
  );
}
