import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";

// The root layout picks its shell from runtime configuration, so this page
// cannot be prerendered: a build-time copy freezes whichever shell the builder
// saw and serves it with a year-long cache header.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Terms | Savortome",
  description: "Terms for using the Savortome private beta.",
};

export default function TermsPage() {
  return (
    <main className={styles.page}>
      <h1>Savortome™ private-beta terms</h1>
      <p className={styles.updated}>Last updated September 7, 2026</p>
      <p>
        Savortome is an invite-only beta operated by Skald and Stone LLC. By using it, you
        agree to these terms and the <Link href="/privacy">privacy notice</Link>.
      </p>

      <h2>Beta access</h2>
      <p>
        Prospective testers request access through the Skald and Stone website. Each request is
        reviewed individually. Access may be limited, suspended, or revoked to protect users and
        the service. The current beta is free, and checkout is disabled.
      </p>

      <h2>Your content and third-party sources</h2>
      <p>
        You retain your rights in content you create. Imported recipes, source media, and other
        third-party material remain subject to their owners&apos; rights and terms. You are responsible
        for using content and links you are permitted to use. You give us permission to process the
        content only as needed to provide and secure Savortome.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Do not misuse the service, attempt unauthorized access, interfere with other accounts,
        evade access controls, upload malicious material, or use Savortome to violate law or
        another person&apos;s rights.
      </p>

      <h2>Food, allergy, and nutrition information</h2>
      <p>
        Ingredient matching, allergy flags, nutrition estimates, substitutions, and cooking guidance
        can be incomplete or wrong. They are not medical, dietary, or food-safety advice. Verify
        ingredients, labels, cross-contact risks, temperatures, and individual needs independently.
      </p>

      <h2>Beta availability</h2>
      <p>
        Features may change, fail, or be withdrawn during testing. Keep independent copies of content
        you cannot afford to lose. To the extent permitted by law, the beta is provided without a
        promise of uninterrupted availability or fitness for a particular purpose.
      </p>

      <h2>Ownership and notices</h2>
      <p>
        Savortome™ is the product name. Original Savortome software and studio
        content are © 2026 Skald and Stone LLC. Existing licenses and third-party notices remain
        unchanged.
      </p>

      <h2>Questions</h2>
      <p>
        Email <a href="mailto:james@skaldandstone.com?subject=Savortome%20terms%20question">
          james@skaldandstone.com
        </a> with questions about these terms.
      </p>

      <p><Link href="/">Back to Savortome</Link></p>
    </main>
  );
}
