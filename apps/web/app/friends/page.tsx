import { KitchenPageHeading } from '@/modules/woodland/KitchenPageHeading';
import { FriendsPanel } from "@/modules/friends";
import { requireSignedInPage } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function FriendsPage() {
  await requireSignedInPage("/friends");

  return (
    <main className="woodland-workspace" data-kitchen-page="friends">
      <KitchenPageHeading title="Around the table" description="Recipes and meals shared with people you know." icon="person" />
      <FriendsPanel />
    </main>
  );
}
