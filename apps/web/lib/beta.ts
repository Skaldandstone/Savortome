import 'server-only';
import { cache } from 'react';
import { auth } from '@clerk/nextjs/server';
import { betaAccess } from '@seconds/core/format';
import { clerkConfigured } from './session';

export const canUseBeta = cache(async (): Promise<boolean> => {
  if (process.env.SB_BETA_ENABLED !== 'true') return false;
  const userId = clerkConfigured() ? (await auth()).userId : null;
  return betaAccess({ enabled: process.env.SB_BETA_ENABLED, nodeEnv: process.env.NODE_ENV, localPreview: process.env.SB_BETA_LOCAL_PREVIEW, userId, allowedIds: process.env.SB_BETA_CLERK_USER_IDS });
});
