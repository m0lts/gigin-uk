export const JOIN_STEPS = ['start', 'about', 'music', 'photo', 'live'];

export function nextStep(step) {
  const index = JOIN_STEPS.indexOf(step);
  return JOIN_STEPS[Math.min(JOIN_STEPS.length - 1, index + 1)] || 'live';
}

export function canAdvance(step, draft) {
  if (step === 'start') return Boolean(String(draft?.name || '').trim());
  if (step === 'about') return Boolean(String(draft?.city || '').trim());
  if (step === 'music') return Boolean(String(draft?.link || '').trim());
  if (step === 'photo') return Boolean(String(draft?.bio || '').trim());
  return true;
}

export function profileFromDraft(draft) {
  return {
    name: String(draft?.name || '').trim(),
    city: String(draft?.city || '').trim(),
    genres: String(draft?.genres || '').split(',').map((item) => item.trim()).filter(Boolean),
    bio: String(draft?.bio || '').trim(),
    photoUrl: String(draft?.photoUrl || '').trim(),
    links: { spotify: String(draft?.link || '').trim() },
  };
}

export function daysUntil(date, now = new Date()) {
  if (!date) return null;
  const when = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(when.getTime())) return null;
  return Math.ceil((when.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}
