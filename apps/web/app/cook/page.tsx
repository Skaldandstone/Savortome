import { KitchenPageHeading } from '@/modules/woodland/KitchenPageHeading';
import { CookPanel } from "@/modules/pantry";
import { CookingProfilePanel } from "@/modules/cooking";
import { canUseBeta } from '@/lib/beta';
import { CareEntry } from '@/modules/woodland/Woodland';
import { requireSignedInPage } from '@/lib/page-auth';
import Link from 'next/link';

export const dynamic = "force-dynamic";

export default async function CookPage() {
  await requireSignedInPage("/cook");

  return (
    <main className="woodland-workspace" data-kitchen-page="cook">
      <KitchenPageHeading title="Cooking, at your pace" description="Start with your pantry, a recipe you love, or something easy." icon="pot" />
      {await canUseBeta() ? <CareEntry /> : null}
      <CookingProfilePanel />
      <p><Link href="/today">Want to plan something for today or keep a food note?</Link></p>
      <CookPanel />
    </main>
  );
}
