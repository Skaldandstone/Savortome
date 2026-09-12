import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { clerkConfigured } from "@/lib/session";
import styles from "../../auth.module.css";

export default function SignUpPage() {
  // Clerk's component throws without a publishable key, so an environment
  // without one - a preview, a contributor's checkout, CI - got a 500 here
  // while /sign-in degraded politely. The asymmetry was an oversight, not a
  // decision: the two pages fail for the same reason and should say so the
  // same way.
  if (!clerkConfigured()) return <main className={styles.authScreen}>
    <section aria-labelledby="account-unavailable">
      <h1 id="account-unavailable">Accounts are unavailable in this preview</h1>
      <p>You can still use Feed me gently without an account. Your idea has not been added to a shopping list.</p>
      <p><Link href="/care">Return to Feed me gently</Link></p>
      <p><Link href="/">Back to the library</Link></p>
    </section>
  </main>;
  return (
    <main className={styles.authScreen}>
      <SignUp />
    </main>
  );
}
