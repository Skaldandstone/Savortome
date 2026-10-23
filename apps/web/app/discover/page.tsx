import { KitchenPageHeading } from '@/modules/woodland/KitchenPageHeading';
import { DiscoverPanel } from "@/modules/discover";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function DiscoverPage() {
  return (
    <main className="woodland-workspace" data-kitchen-page="discover">
      <KitchenPageHeading title="Something to try" description="Browse shared recipes and find a place for them in your kitchen." icon="book" />
      <p><Link href="/discover/open">Browse the open recipe library</Link> — thousands of community recipes, with ingredients, directions and source credits.</p>
      <DiscoverPanel />
    </main>
  );
}
