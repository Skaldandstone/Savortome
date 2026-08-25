import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import styles from "./account.module.css";

/**
 * The masthead's right-hand side. Renders nothing but Clerk's own controls, so
 * session state is never mirrored into our own components.
 */
export function AccountMenu() {
  return (
    <div className={styles.menu}>
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button type="button" className={styles.link}>
            Sign in
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button type="button" className={styles.cta}>
            Sign up
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </div>
  );
}

/** Shown instead of the account controls when the app is running without Clerk keys. */
export function DevAccountBadge() {
  return (
    <span className={styles.devBadge} title="Set Clerk keys in .env.local to enable real accounts">
      local account
    </span>
  );
}
