import { KitchenPageHeading } from '@/modules/woodland/KitchenPageHeading';
import { DiscoverPanel } from "@/modules/discover";

export const dynamic = "force-dynamic";

export default function DiscoverPage() {
  return (
    <main className="woodland-workspace" data-kitchen-page="discover">
      <KitchenPageHeading title="Something to try" description="Browse shared recipes and find a place for them in your kitchen." icon="book" />
      <DiscoverPanel />
    </main>
  );
}
