import Link from "next/link";

export function LegalFooter() {
  return (
    <footer className="legal-footer" data-print="hide">
      <p>© 2026 Skald and Stone LLC</p>
      <nav aria-label="Legal and support">
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/accessibility">Accessibility</Link>
        <a href="mailto:james@skaldandstone.com?subject=Savortome%20support">
          Contact
        </a>
      </nav>
      <details>
        <summary>About copyright</summary>
        <p>This notice covers original Savortome™ software and studio content. Imported recipes, source media, and user content belong to their respective owners. Existing software licenses remain unchanged.</p>
      </details>
    </footer>
  );
}
