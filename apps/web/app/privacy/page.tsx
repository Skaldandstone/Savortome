import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";

// The root layout picks its shell from runtime configuration, so this page
// cannot be prerendered: a build-time copy freezes whichever shell the builder
// saw and serves it with a year-long cache header.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy | Savortome",
  description: "How the Savortome private beta handles account, recipe, and technical data.",
};

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <h1>Savortome<span className="tm">™</span> privacy notice</h1>
      <p className={styles.updated}>Last updated September 7, 2026</p>
      <p>
        This notice applies to the Savortome website and private beta. It does not replace
        the separate privacy notices for other Skald and Stone products.
      </p>

      <h2>What we handle</h2>
      <ul>
        <li>Account identifiers and sign-in details supplied through Clerk.</li>
        <li>Recipes, pantry items, meal plans, shopping lists, dietary preferences, and other content you choose to save.</li>
        <li>Source links and content you ask Savortome to import.</li>
        <li>Operational records needed to secure, diagnose, and run the service.</li>
      </ul>

      <h2>How the service uses data</h2>
      <p>
        We use this information to provide your account, import and organize recipes, create plans
        and lists, enforce private-beta access, prevent abuse, and troubleshoot the service. We do
        not add advertising analytics in this beta.
      </p>

      <h2>Service providers and requests</h2>
      <p>
        Cloudflare provides DNS, proxying, and network protection. Amazon Web Services hosts the
        current private-beta application and database. Clerk provides authentication. When you ask
        to import a source, the service may contact that source and may use a configured extraction
        provider. Those providers receive only the information needed for that request.
      </p>
      <p>
        The website uses system fonts, so viewing these pages does not require a third-party font
        request. Contact links open your email provider, which handles the message under its own
        privacy practices.
      </p>

      <h2>Storage, caching, and retention</h2>
      <p>
        Account content is stored in the application database. The service worker may cache public
        static assets for offline use, but it is designed not to cache authenticated responses.
        We retain information while it is needed to provide the beta, meet security and legal
        obligations, and resolve disputes. You can ask us to review or delete account information.
      </p>

      <h2>Your choices</h2>
      <p>
        You control what recipes and personal preferences you add. Do not import content you are not
        permitted to use. To ask about access, correction, export, or deletion, email{
        " "
      }<a href="mailto:james@skaldandstone.com?subject=Savortome%20privacy%20request">
        james@skaldandstone.com
      </a>.
      </p>

      <div className={styles.callout}>
        <p>
          Dietary and nutrition features are informational aids. They are not medical advice or a
          guarantee that a recipe is safe for a particular person.
        </p>
      </div>

      <p><Link href="/">Back to Savortome</Link></p>
    </main>
  );
}
