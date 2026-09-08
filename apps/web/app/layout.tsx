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
  title: "Savortome™",
  description: "Food is magic. Cooking shouldn’t require it.",
};

function Masthead({ children }: { children: ReactNode }) {
  return (
    <header className={styles.masthead} data-print="hide">
      <h1 className={styles.wordmark}>
        <Link href="/">Savortome™</Link>
      </h1>
      <span className={styles.tagline}>Food is magic. Cooking shouldn’t require it.</span>
      <nav className={styles.nav}>
        <Link href="/">Library</Link>
        <Link href="/plan">Plan</Link>
        <Link href="/cook">What can I make?</Link>
        <Link href="/list">Shopping list</Link>
        <Link href="/friends">Friends</Link>
        <Link href="/discover">Discover</Link>
        <Link href="/profile">Dietary profile</Link>
        <Link href="/plans">Plans</Link>
        <a href="https://skaldandstone.com/secondbreakfast/#request-access">Request beta access</a>
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
      <header className="woodland-masthead" data-print="hide"><Link href="/" className="woodland-brand"><img src="/icons/icon-192.png" alt="" /><span>Savortome™<small>Food is magic. Cooking shouldn’t require it.</small></span></Link><DecorationControl />{clerkConfigured() ? <AccountMenu /> : <DevAccountBadge />}</header>
      <WoodlandNavigation />
      <OfflineBanner /><div id="main-content" tabIndex={-1}>{children}</div><LegalFooter />
    </div>;
    return <html lang="en" data-woodland="true" data-theme="dark" suppressHydrationWarning><body>{clerkConfigured() ? <ClerkProvider>{shell}</ClerkProvider> : shell}<ServiceWorkerRegistration /></body></html>;
  }
  // Without keys the app runs on a single local account, and mounting
  // ClerkProvider would fail outright rather than degrading.
  if (!clerkConfigured()) {
    return (
      <html lang="en">
        <body>
          <div className={styles.shell}>
            <a className={styles.skipLink} href="#main-content">Skip to content</a>
            <Masthead>
              <DevAccountBadge />
            </Masthead>
            <OfflineBanner />
            <div id="main-content" tabIndex={-1}>{children}</div>
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
            <a className={styles.skipLink} href="#main-content">Skip to content</a>
            <Masthead>
              <AccountMenu />
            </Masthead>
            <OfflineBanner />
            <div id="main-content" tabIndex={-1}>{children}</div>
            <LegalFooter />
          </div>
          <ServiceWorkerRegistration />
        </ClerkProvider>
      </body>
    </html>
  );
}
