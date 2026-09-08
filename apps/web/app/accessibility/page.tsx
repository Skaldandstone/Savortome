import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Accessibility | Second Breakfast",
  description: "Second Breakfast accessibility goals, current verification, and feedback contact.",
};

export default function AccessibilityPage() {
  return (
    <main className={styles.page}>
      <h1>Second Breakfast accessibility</h1>
      <p className={styles.updated}>Last updated September 7, 2026</p>
      <p>
        We are building Second Breakfast toward WCAG 2.2 Level AA for its web surfaces and platform
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

      <h2>Ask for help or report a barrier</h2>
      <p>
        Email <a href="mailto:james@skaldandstone.com?subject=Second%20Breakfast%20accessibility%20feedback">
          james@skaldandstone.com
        </a>. If you are comfortable, include the page, what you were trying to do, and the browser,
        device, or assistive technology involved. We will review the report and work toward a
        practical fix or accessible alternative.
      </p>

      <p><Link href="/">Back to Second Breakfast</Link></p>
    </main>
  );
}
