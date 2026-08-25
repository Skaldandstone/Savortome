import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ClerkProvider } from "@clerk/nextjs";
import { AccountMenu, DevAccountBadge } from "@/modules/account";
import { clerkConfigured } from "@/lib/session";
import "./globals.css";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: "NomNom",
  description: "Every recipe you find, turned into a card you can actually cook from.",
};

function Masthead({ children }: { children: ReactNode }) {
  return (
    <header className={styles.masthead}>
      <h1 className={styles.wordmark}>
        <Link href="/">NomNom</Link>
      </h1>
      <span className={styles.tagline}>recipes, from anywhere</span>
      <nav className={styles.nav}>
        <Link href="/">Library</Link>
        <Link href="/cook">What can I make?</Link>
        <Link href="/list">Shopping list</Link>
        <Link href="/friends">Friends</Link>
        <Link href="/discover">Discover</Link>
      </nav>
      {children}
    </header>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  // Without keys the app runs on a single local account, and mounting
  // ClerkProvider would fail outright rather than degrading.
  if (!clerkConfigured()) {
    return (
      <html lang="en">
        <body>
          <div className={styles.shell}>
            <Masthead>
              <DevAccountBadge />
            </Masthead>
            {children}
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          <div className={styles.shell}>
            <Masthead>
              <AccountMenu />
            </Masthead>
            {children}
          </div>
        </ClerkProvider>
      </body>
    </html>
  );
}
