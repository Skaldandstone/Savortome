import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ClerkProvider } from "@clerk/nextjs";
import { AccountMenu, DevAccountBadge } from "@/modules/account";
import { OfflineBanner, ServiceWorkerRegistration } from "@/modules/offline";
import { clerkConfigured } from "@/lib/session";
import "./globals.css";
import styles from "./layout.module.css";
import { LegalFooter } from "../ui/LegalFooter";
import { canUseBeta } from '@/lib/beta';
import { DecorationControl, WoodlandNavigation } from '@/modules/woodland/Woodland';
import '../ui/woodland.css';

export const metadata: Metadata = {
  title: "Second Breakfast",
  description: "Every recipe you find, turned into a card you can actually cook from.",
};

function Masthead({ children }: { children: ReactNode }) {
  return (
    <header className={styles.masthead} data-print="hide">
      <h1 className={styles.wordmark}>
        <Link href="/">Second Breakfast</Link>
      </h1>
      <span className={styles.tagline}>recipes, from anywhere</span>
      <nav className={styles.nav}>
        <Link href="/">Library</Link>
        <Link href="/plan">Plan</Link>
        <Link href="/cook">What can I make?</Link>
        <Link href="/list">Shopping list</Link>
        <Link href="/friends">Friends</Link>
        <Link href="/discover">Discover</Link>
        <Link href="/profile">Dietary profile</Link>
        <Link href="/plans">Plans</Link>
      </nav>
      {children}
    </header>
  );
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const beta = await canUseBeta();
  if (beta) {
    const shell = <div className="woodland-shell">
      <a className="woodland-skip" href="#main-content">Skip to content</a>
      <header className="woodland-masthead" data-print="hide"><Link href="/" className="woodland-brand"><img src="/icons/icon-192.png" alt="" />Second Breakfast</Link><DecorationControl />{clerkConfigured() ? <AccountMenu /> : <DevAccountBadge />}</header>
      <WoodlandNavigation />
      <OfflineBanner /><div id="main-content" tabIndex={-1}>{children}</div><LegalFooter />
    </div>;
    return <html lang="en" data-woodland="true" suppressHydrationWarning><body>{clerkConfigured() ? <ClerkProvider>{shell}</ClerkProvider> : shell}<ServiceWorkerRegistration /></body></html>;
  }
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
            <OfflineBanner />
            {children}
            <LegalFooter />
          </div>
          <ServiceWorkerRegistration />
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
            <OfflineBanner />
            {children}
            <LegalFooter />
          </div>
          <ServiceWorkerRegistration />
        </ClerkProvider>
      </body>
    </html>
  );
}
