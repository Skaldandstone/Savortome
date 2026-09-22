import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";

// The root layout picks its shell from runtime configuration, so this page
// cannot be prerendered: a build-time copy freezes whichever shell the builder
// saw and serves it with a year-long cache header.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Accessibility | Savortome",
  description: "Savortome accessibility goals, current verification, and feedback contact.",
};

export default function AccessibilityPage() {
  return (
    <main className={styles.page}>
      <h1>Savortome<span className="tm">™</span> accessibility</h1>
      <p className={styles.updated}>Last updated September 22, 2026</p>
      <p>
        We are building Savortome toward WCAG 2.2 Level AA for its web surfaces and platform
        accessibility guidance for native releases. Accessibility is part of the definition of done
        for new features, not a one-time certification.
      </p>

      <h2>Current beta work</h2>
      <p>
        Automated checks cover semantics, contrast, keyboard focus, reduced motion, and responsive
        layouts on representative pages. Manual assistive-technology and physical-device acceptance
        remain required before a broader release. Automated results do not prove that every person
        or assistive technology will have a barrier-free experience.
      </p>

      <h2>Support for attention and memory</h2>
      <p>
        Cooking mode shows one step at a time, keeps ingredient amounts with the step, and lets you
        pause and return. Recipe editing keeps an unfinished draft in the current browser tab. Bulk
        actions such as clearing a week, pantry, or shopping list ask before removing everything.
        These supports are available to anyone and do not require disclosing a diagnosis.
      </p>

      <h2>Display and motion</h2>
      <p>
        Savortome follows reduced-motion preferences and provides reduced decoration and theme
        controls from the display menu. Core actions use text labels alongside visual styling so
        color or illustration is not the only way to understand a control.
      </p>

      <h2>Ask for help or report a barrier</h2>
      <p>
        Email <a href="mailto:james@skaldandstone.com?subject=Savortome%20accessibility%20feedback">
          james@skaldandstone.com
        </a>. If you are comfortable, include the page, what you were trying to do, and the browser,
        device, or assistive technology involved. We will review the report and work toward a
        practical fix or accessible alternative.
      </p>

      <p><Link href="/">Back to Savortome</Link></p>
    </main>
  );
}
