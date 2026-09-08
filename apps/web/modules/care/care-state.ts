import { CARE_FOODS, parseCareLink, type CareChoices, type CareLink } from '@seconds/core/format';

const RETURN_TTL = 30 * 60 * 1000;
export function localCareChoices(value: unknown): CareChoices {
  const { effort, time, temperature, texture } = parseCareLink(value);
  const choices: CareChoices = { effort, time, temperature, texture };
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const raw = value as Record<string, unknown>;
    if (Object.hasOwn(raw, 'appetite') && ['small', 'regular', 'more'].includes(raw.appetite as string)) choices.appetite = raw.appetite as CareChoices['appetite'];
    if (Object.hasOwn(raw, 'usePantry') && typeof raw.usePantry === 'boolean') choices.usePantry = raw.usePantry;
  }
  return choices;
}

// This record stays in this tab. No profile or restrictions are persisted here.
export function careReturnRecord(link: CareLink, choices: CareChoices, selectedId: string | null, now = Date.now()) {
  return { at: now, link: parseCareLink(link), choices: localCareChoices(choices), selectedId: CARE_FOODS.some(food => food.id === selectedId) ? selectedId : null };
}

export function restoreCareReturn(raw: string | null, now = Date.now()) {
  try {
    const value = JSON.parse(raw ?? 'null');
    if (!value || typeof value.at !== 'number' || !Number.isFinite(value.at) || value.at > now || now - value.at >= RETURN_TTL) return null;
    return careReturnRecord(parseCareLink(value.link), localCareChoices(value.choices), value.selectedId, value.at);
  } catch { return null; }
}

// Preparation and the fixed return destination are allowed. Food selection,
// appetite, pantry, and profile state never become query parameters.
export function careSignInHref(link: CareLink) {
  const query = new URLSearchParams(Object.entries(parseCareLink(link)) as [string, string][]).toString();
  return `/sign-in?redirect_url=${encodeURIComponent(`/care${query ? `?${query}` : ''}`)}`;
}
