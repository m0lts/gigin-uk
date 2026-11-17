function minutes(value) {
  if (value instanceof Date) return value.getHours() * 60 + value.getMinutes();
  if (typeof value === 'number') return value;
  const [hours, mins] = String(value || '').split(':').map(Number);
  if (!Number.isFinite(hours)) return null;
  return hours * 60 + (Number.isFinite(mins) ? mins : 0);
}

export function setWindow(set, index) {
  const start = minutes(set.start || set.startTime);
  const end = minutes(set.end);
  const duration = Number(set.duration);
  const finish = end != null ? end : (start != null && Number.isFinite(duration) ? start + duration : null);
  return {
    id: set.gigId || set.id || `set-${index}`,
    label: set.name || set.actName || `Set ${index + 1}`,
    startLabel: set.start || String(set.startTime || '').slice(0, 5),
    start: start ?? 0,
    end: finish ?? (start ?? 0) + 45,
  };
}

export function assignPhotos(photos, sets) {
  const windows = (sets || []).map(setWindow);
  return (photos || []).map((photo) => {
    const taken = minutes(photo.takenAt);
    const hit = windows.find((window) => taken != null && taken >= window.start && taken < window.end);
    const chosen = hit || windows[0] || null;
    return { ...photo, setId: photo.setId || chosen?.id || '' };
  });
}

export function photosForSet(photos, setId) {
  return (photos || []).filter((photo) => photo.setId === setId);
}

export function movePhoto(photos, photoId, setId) {
  return (photos || []).map((photo) => (photo.id === photoId ? { ...photo, setId } : photo));
}

export function togglePicked(picked, photoId) {
  const next = new Set(picked || []);
  if (next.has(photoId)) next.delete(photoId);
  else next.add(photoId);
  return [...next];
}
