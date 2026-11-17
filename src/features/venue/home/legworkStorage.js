const KEY = 'gigin.legwork';

export function readLegwork(venueId) {
  if (!venueId) return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(`${KEY}.${venueId}`) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function writeLegwork(venueId, patch) {
  if (!venueId) return {};
  const next = { ...readLegwork(venueId), ...patch };
  try {
    localStorage.setItem(`${KEY}.${venueId}`, JSON.stringify(next));
  } catch { /* ignore full storage */ }
  return next;
}
