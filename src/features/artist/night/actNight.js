const MAX_CLIP = 90;

export function clipWindow(duration, start, length = MAX_CLIP) {
  const total = Math.max(0, Number(duration) || 0);
  const span = Math.min(MAX_CLIP, Math.max(1, Number(length) || MAX_CLIP), total || MAX_CLIP);
  const begin = Math.min(Math.max(0, Number(start) || 0), Math.max(0, total - span));
  return { start: begin, end: begin + span, length: span };
}

export function clipQuickPick(duration, pick) {
  const total = Math.max(0, Number(duration) || 0);
  if (pick === 'ending') return clipWindow(total, Math.max(0, total - MAX_CLIP));
  if (pick === 'loudest') return clipWindow(total, Math.max(0, total / 2 - MAX_CLIP / 2));
  return clipWindow(total, 0);
}

export function clock(seconds) {
  const whole = Math.max(0, Math.round(Number(seconds) || 0));
  const mins = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${mins}:${String(rest).padStart(2, '0')}`;
}

export function tonightRows(gig) {
  const start = gig?.startTime || '';
  const arrive = gig?.arriveBy || '';
  const sound = gig?.soundcheck || gig?.actsShouldKnow?.pa || '';
  const parking = gig?.parking || '';
  const phone = gig?.contactPhone || '';
  return [
    arrive ? { id: 'arrive', title: `Arrive ${arrive}`, detail: gig?.arrivalNote || '' } : null,
    sound ? { id: 'sound', title: start ? `Soundcheck before ${start}` : 'Soundcheck', detail: sound } : null,
    parking ? { id: 'parking', title: 'Parking', detail: parking } : null,
    phone ? { id: 'night', title: 'On the night', detail: phone } : null,
  ].filter(Boolean);
}

export function calendarUrl(gig) {
  const title = encodeURIComponent(gig?.name || gig?.gigName || 'Gig');
  const details = encodeURIComponent(tonightRows(gig).map((row) => `${row.title}. ${row.detail}`).join(' '));
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}`;
}

export function offerDeadline(sentAt, days = 7, now = new Date()) {
  const sent = sentAt instanceof Date ? sentAt : new Date(sentAt || now);
  if (Number.isNaN(sent.getTime())) return { label: '', left: '' };
  const due = new Date(sent.getTime() + days * 24 * 60 * 60 * 1000);
  const leftDays = Math.max(0, Math.ceil((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
  const label = due.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  return { label, left: leftDays === 1 ? '1 day left' : `${leftDays} days left` };
}
