import { notFound } from 'next/navigation';
import { parseCareLink } from '@seconds/core/format';
import { canUseBeta } from '@/lib/beta';
import { requireSignedInPage } from '@/lib/page-auth';
import { CareScreen } from '@/modules/care/CareScreen';

export const dynamic = 'force-dynamic';

/**
 * Gentle food when cooking is hard.
 *
 * Sign-in is required before anything is rendered, and the care link's own
 * parameters are carried through the redirect so a handoff from Wispling
 * survives the detour. Those parameters are already filtered by
 * `parseCareLink` to the seven public fields, so nothing about why someone
 * needs this page travels in the URL we hand to Clerk.
 */
export default async function CarePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const link = parseCareLink(await searchParams);
  const query = new URLSearchParams(link as Record<string, string>).toString();
  await requireSignedInPage(query ? `/care?${query}` : '/care');

  // Signed in but outside the cohort, on a build where the beta is still
  // closed: the page should not exist rather than advertise itself.
  if (!(await canUseBeta())) notFound();

  return <CareScreen link={link} />;
}
