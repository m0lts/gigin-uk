export function gigWhen(gig) {
  const value = gig?.date?.toDate?.() || gig?.date || gig?.startDate;
  const date = value instanceof Date ? value : new Date(value || '');
  return Number.isNaN(date.getTime()) ? null : date;
}

export function splitGigs(gigs, now = new Date()) {
  const upcoming = [];
  const past = [];
  const applied = [];
  for (const gig of gigs || []) {
    const when = gigWhen(gig);
    const status = String(gig?.status || '').toLowerCase();
    if (status === 'pending' || status === 'sent' || gig?.applied) applied.push(gig);
    if (when && when.getTime() < now.getTime()) past.push(gig);
    else upcoming.push(gig);
  }
  return { upcoming, past, applied };
}

export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const days = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    days.push(date);
  }
  return days;
}

export function dayKey(date) {
  const day = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(day.getTime())) return '';
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
}

export function toggleDayOff(days, key) {
  const next = new Set(days || []);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return [...next];
}

export function diaryNote(notes, gigId) {
  return (notes && notes[gigId]) || '';
}
