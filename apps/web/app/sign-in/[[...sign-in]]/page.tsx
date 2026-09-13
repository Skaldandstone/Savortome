import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { clerkConfigured } from "@/lib/session";
import styles from "../../auth.module.css";

export default function SignInPage() {
  if (!clerkConfigured()) return <main className={styles.authScreen}>
    <section className={styles.authPanel} aria-labelledby="account-unavailable">
      <h1 id="account-unavailable">Accounts are unavailable in this preview</h1>
      <p>You can still use Feed me gently without an account. Your idea has not been added to a shopping list.</p>
      <nav className={styles.authLinks} aria-label="Account unavailable options">
        <Link href="/care">Return to Feed me gently</Link>
        <Link href="/">Back to the library</Link>
      </nav>
    </section>
  </main>;
  return (
    <main className={styles.authScreen}>
      <SignIn />
    </main>
  );
}
