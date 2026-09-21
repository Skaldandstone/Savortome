import { createHash } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { clerkConfigured } from "@/lib/session";
import { OnboardingJourney } from "@/modules/onboarding";

export const dynamic = "force-dynamic";

export default async function GettingStartedPage() {
  const configured = clerkConfigured();
  const clerkId = configured ? (await auth()).userId : null;
  const signedIn = !configured || Boolean(clerkId);
  const storageScope = clerkId
    ? createHash("sha256").update(clerkId).digest("hex").slice(0, 16)
    : configured ? "guest" : "local-development";

  return <OnboardingJourney signedIn={signedIn} storageScope={storageScope} />;
}
