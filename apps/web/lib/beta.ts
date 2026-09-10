import 'server-only';
import { cache } from 'react';
import { auth, currentUser } from '@clerk/nextjs/server';
import { betaAccess } from '@seconds/core/format';
import { clerkConfigured } from './session';

export function hasStudioBetaApproval(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false;
  const studioAccess = (metadata as Record<string, unknown>).studio_access;
  if (!studioAccess || typeof studioAccess !== 'object' || Array.isArray(studioAccess)) return false;
  const approval = (studioAccess as Record<string, unknown>)['second-breakfast'];
  return !!approval
    && typeof approval === 'object'
    && !Array.isArray(approval)
    && (approval as Record<string, unknown>).approved === true;
}

export const canUseBeta = cache(async (): Promise<boolean> => {
  if (process.env.SB_BETA_ENABLED !== 'true') return false;
  // SB_PUBLIC_ACCESS=true is the public-launch switch: every visitor gets the
  // woodland experience and the owner-approval cohort check is skipped.
  // Account-bound data remains behind Clerk sign-in at each read site.
  if (process.env.SB_PUBLIC_ACCESS === 'true') return true;
  if (!clerkConfigured()) {
    return betaAccess({
      enabled: process.env.SB_BETA_ENABLED,
      nodeEnv: process.env.NODE_ENV,
      localPreview: process.env.SB_BETA_LOCAL_PREVIEW,
    });
  }

  const userId = (await auth()).userId;
  if (betaAccess({
    enabled: process.env.SB_BETA_ENABLED,
    nodeEnv: process.env.NODE_ENV,
    localPreview: process.env.SB_BETA_LOCAL_PREVIEW,
    userId,
    allowedIds: process.env.SB_BETA_CLERK_USER_IDS,
  })) return true;
  if (!userId) return false;

  try {
    const user = await currentUser();
    return user?.id === userId && hasStudioBetaApproval(user.publicMetadata);
  } catch {
    return false;
  }
});
