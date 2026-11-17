import { displayUrl, venuePageUrl } from './publicLinks.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shortDate(date) {
  if (!date) return '';
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

const BOOKED = new Set(['accepted', 'confirmed', 'paid', 'booked']);

export const LEGWORK_STEPS = [
  { id: 'website', auto: false },
  { id: 'instagram', auto: false },
  { id: 'reply', auto: false },
  { id: 'nights', auto: true },
  { id: 'promo', auto: true },
  { id: 'qr', auto: false },
];

export function isBookedApplicant(applicant) {
  return BOOKED.has(String(applicant?.status || '').toLowerCase());
}

export function hasPromo(applicant) {
  return Boolean(applicant?.promo?.submittedAt);
}

export function legworkProgress(manual = {}) {
  const done = LEGWORK_STEPS.filter((step) => step.auto || manual[step.id]).length;
  const total = LEGWORK_STEPS.length;
  return { done, total, left: total - done };
}

export function legworkBanner(progress) {
  if (!progress || progress.left <= 0) return null;
  const left = progress.left;
  const setups = left === 1 ? '1 quick set-up left' : `${left} quick set-ups left`;
  return {
    title: 'Let Gigin do the legwork',
    body: `Put your link on your website and Instagram, and reply to enquiries with it. ${setups}.`,
  };
}

export function venuePublicUrl(venue) {
  const id = venue?.venueId || venue?.id || '';
  return id ? venuePageUrl(id) : '';
}

export function websiteEmbed(venueName, url) {
  const name = String(venueName || 'the venue').trim() || 'the venue';
  return `<a href="${url}">Play at ${name}</a>`;
}

export function instagramBio(url) {
  return `Live music most weeks. Want to play? ${displayUrl(url)}`;
}

export function enquiryReply(url) {
  return `Thanks for getting in touch! We book all our acts through Gigin now. Send us your music here and we'll give it a proper listen: ${displayUrl(url)}`;
}

export function homeNeeds(nights) {
  const items = [];
  for (const night of nights || []) {
    if (night.fresh > 0) {
      const when = night.date ? shortDate(night.date) : '';
      const nightLabel = [night.name, when].filter(Boolean).join(', ');
      items.push({
        kind: 'applications',
        gigId: night.gigId,
        title: night.fresh === 1 ? '1 new application' : `${night.fresh} new applications`,
        detail: [`Set ${night.setCount}`, nightLabel].filter(Boolean).join(' · '),
        action: 'Review',
      });
    }
    for (const applicant of night.applications || []) {
      if (!isBookedApplicant(applicant) || hasPromo(applicant)) continue;
      const name = applicant.name || applicant.actName || 'an act';
      items.push({
        kind: 'promo',
        gigId: night.gigId,
        applicantId: applicant.id || '',
        title: `Promo missing from ${name}`,
        detail: 'Photos and audio not sent yet',
        action: 'Request',
      });
    }
  }
  return items;
}

export function nightHomeChips(night) {
  const chips = [];
  if (night.fullyBooked) chips.push({ label: 'Booked', tone: 'good' });
  else chips.push({ label: `${night.bookedCount} of ${night.setCount} booked`, tone: 'neutral' });
  const booked = (night.applications || []).filter(isBookedApplicant);
  const ready = booked.filter(hasPromo).length;
  if (booked.length && ready === booked.length) chips.push({ label: 'Promo in', tone: 'good' });
  else if (booked.length) chips.push({ label: `Promo ${ready} of ${booked.length}`, tone: 'neutral' });
  return chips;
}

export function nightMeta(night) {
  const sets = night.setCount === 1 ? '1 set' : `${night.setCount} sets`;
  return [night.range, sets].filter(Boolean).join(' · ');
}
