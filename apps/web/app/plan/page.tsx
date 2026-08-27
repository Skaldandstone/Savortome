import { redirect } from "next/navigation";
import { todayISO, weekStart } from "@seconds/core/format";
import { PlanWeek } from "@/modules/plan";
import { Callout } from "@/ui";
import { clerkConfigured, currentUserId, databaseConfigured } from "@/lib/session";

export const dynamic = "force-dynamic";

/** What you're cooking this week. */
export default async function PlanPage() {
  if (!databaseConfigured()) {
    return (
      <main>
        <Callout tone="warn" title="Nowhere to keep a plan">
          Set DATABASE_URL in .env.local to plan meals.
        </Callout>
      </main>
    );
  }

  if (clerkConfigured() && !(await currentUserId())) {
    redirect("/sign-in?redirect_url=/plan");
  }

  // The week is picked on the server so the first paint is already the right
  // one; the grid takes over from there.
  return (
    <main>
      <PlanWeek initialWeek={weekStart(todayISO())} />
    </main>
  );
}
