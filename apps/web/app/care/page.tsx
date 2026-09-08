import { notFound, redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { parseCareLink } from '@seconds/core/format';
import { canUseBeta } from '@/lib/beta';
import { clerkConfigured } from '@/lib/session';
import { CareScreen } from '@/modules/care/CareScreen';

export const dynamic = 'force-dynamic';
export default async function CarePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const link = parseCareLink(await searchParams);
  if (!(await canUseBeta())) {
    if (process.env.SB_BETA_ENABLED === 'true' && clerkConfigured() && !(await auth()).userId) {
      const destination = '/care?' + new URLSearchParams(link as Record<string, string>).toString();
      redirect('/sign-in?redirect_url=' + encodeURIComponent(destination));
    }
    notFound();
  }
  return <CareScreen link={link} />;
}
