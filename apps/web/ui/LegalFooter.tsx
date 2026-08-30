export function LegalFooter() {
  return (
    <footer data-print="hide" style={{ padding: "20px 24px", borderTop: "1px solid currentColor", fontSize: 14, lineHeight: 1.6 }}>
      <p>© 2026 Skald and Stone LLC</p>
      <details>
        <summary style={{ cursor: "pointer", paddingBlock: 12 }}>About copyright</summary>
        <p>This notice covers original Second Breakfast software and studio content. Imported recipes, source media, and user content belong to their respective owners. Existing software licenses remain unchanged.</p>
      </details>
    </footer>
  );
}
