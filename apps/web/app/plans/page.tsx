import { tierOr } from "@seconds/core";
import { creditsFor, db } from "@seconds/db";
import { PlanTable } from "@/modules/plans";
import { Panel, PanelHeader } from "@/ui";
import { currentUserId, databaseConfigured } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  // Signed out still sees the plans — they're the argument for signing up, so
  // hiding them behind an account would be exactly backwards.
  let tier = tierOr(null);
  if (databaseConfigured()) {
    const database = db();
    const userId = await currentUserId(database);
    if (userId) tier = (await creditsFor(database, userId)).tier;
  }

  return (
    <main>
      <Panel>
        <PanelHeader
          title="Plans"
          hint="Everything except AI import is free, on every plan. Credits are for the one thing that costs money to run."
        />
      </Panel>
      <PlanTable current={tier} />
    </main>
  );
}
