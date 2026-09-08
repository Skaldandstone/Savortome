import { normalizeCareIntent } from '@/modules/care/nativeLink';

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  return normalizeCareIntent(path);
}
