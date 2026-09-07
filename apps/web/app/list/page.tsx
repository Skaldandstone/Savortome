import { KitchenPageHeading } from '@/modules/woodland/KitchenPageHeading';
import { ListPanel } from "@/modules/list";

export const dynamic = "force-dynamic";

export default function ListPage() {
  return (
    <main className="woodland-workspace" data-kitchen-page="list">
      <KitchenPageHeading title="The shopping list" description="A place for what your kitchen needs next." icon="basket" />
      <ListPanel />
    </main>
  );
}
