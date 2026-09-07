import { KitchenPageHeading } from '@/modules/woodland/KitchenPageHeading';
import { CookPanel } from "@/modules/pantry";
import { canUseBeta } from '@/lib/beta';
import { CareEntry } from '@/modules/woodland/Woodland';

export const dynamic = "force-dynamic";

export default async function CookPage() {
  return (
    <main className="woodland-workspace" data-kitchen-page="cook">
      <KitchenPageHeading title="Cooking, at your pace" description="Start with your pantry, a recipe you love, or something easy." icon="pot" />
      {await canUseBeta() ? <CareEntry /> : null}
      <CookPanel />
    </main>
  );
}
