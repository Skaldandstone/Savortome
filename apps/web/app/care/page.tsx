import { notFound } from 'next/navigation';
import { parseCareLink } from '@seconds/core/format';
import { canUseBeta } from '@/lib/beta';
import { CareScreen } from '@/modules/care/CareScreen';

export const dynamic = 'force-dynamic';

/**
 * Gentle food when cooking is hard.
 *
 * The useful, local suggestion surface is available without an account.
 * Account-bound dietary settings, pantry reads, and shopping-list writes stay
 * protected inside CareScreen and its API routes. Link parameters are filtered
 * to the documented public fields before the client receives them.
 */
export default async function CarePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const link = parseCareLink(await searchParams);
  // Closed hosted betas still require cohort admission. Public launches and
  // local development can render guest Care without granting account access.
  if (!(await canUseBeta())) notFound();

  return <CareScreen link={link} />;
}
