import { KitchenPageHeading } from '@/modules/woodland/KitchenPageHeading';
import { redirect } from "next/navigation";
import { isISODate, todayISO, weekStart } from "@seconds/core/format";
import { PlanWeek } from "@/modules/plan";
import { Callout } from "@/ui";
import { clerkConfigured, currentUserId, databaseConfigured } from "@/lib/session";

export const dynamic = "force-dynamic";

/** What you're cooking this week. */
export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const requestedWeek = (await searchParams).week;
  const initialWeek = requestedWeek && isISODate(requestedWeek)
    ? weekStart(requestedWeek)
    : weekStart(todayISO());

  if (!databaseConfigured()) {
    return (
      <main className="woodland-workspace" data-kitchen-page="plan">
      <KitchenPageHeading title="Your week at the table" description="Leave room for familiar favorites and changes of plan." icon="plan" />
        <Callout tone="warn" title="Nowhere to keep a plan">
          Set DATABASE_URL in .env.local to plan meals.
        </Callout>
      </main>
    );
  }

  if (clerkConfigured() && !(await currentUserId())) {
    const destination = requestedWeek && isISODate(requestedWeek)
      ? `/plan?week=${initialWeek}`
      : "/plan";
    redirect(`/sign-in?redirect_url=${encodeURIComponent(destination)}`);
  }

  // The week is picked on the server so the first paint is already the right
  // one; the grid takes over from there.
  return (
    <main className="woodland-workspace" data-kitchen-page="plan">
      <KitchenPageHeading title="Your week at the table" description="Leave room for familiar favorites and changes of plan." icon="plan" />
      <PlanWeek initialWeek={initialWeek} />
    </main>
  );
}
