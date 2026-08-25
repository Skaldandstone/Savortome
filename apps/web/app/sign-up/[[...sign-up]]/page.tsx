import { SignUp } from "@clerk/nextjs";
import styles from "../../auth.module.css";

export default function SignUpPage() {
  return (
    <main className={styles.authScreen}>
      <SignUp />
    </main>
  );
}
