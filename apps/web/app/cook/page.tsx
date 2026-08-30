import { CookPanel } from "@/modules/pantry";
import { canUseBeta } from '@/lib/beta';
import { CareEntry } from '@/modules/woodland/Woodland';

export const dynamic = "force-dynamic";

export default async function CookPage() {
  return (
    <main>
      {await canUseBeta() ? <CareEntry /> : null}
      <CookPanel />
    </main>
  );
}
