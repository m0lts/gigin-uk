import { slotTaken } from '../../../services/utils/nightApplications.js';

export { slotTaken };

export function slotDate(slot) {
  const raw = slot?.startDateTime || slot?.date;
  if (!raw) return null;
  if (typeof raw.toDate === 'function') return raw.toDate();
  if (raw.seconds || raw._seconds) return new Date((raw.seconds || raw._seconds) * 1000);
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatGigDay(slot) {
  const date = slotDate(slot);
  if (!date) return 'DATE TO BE CONFIRMED';
  const parts = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).formatToParts(date);
  const pick = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${pick('weekday')} ${pick('day')} ${pick('month')} ${pick('year')}`.toUpperCase();
}

export function formatGigSentence(slot) {
  const date = slotDate(slot);
  if (!date) return 'Date to be confirmed';
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(date);
  const month = new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(date);
  return `${weekday} ${date.getDate()} ${month}`;
}

export function formatGuestTimes(slots, gig, { upper = false } = {}) {
  const list = slots?.length ? slots : [gig].filter(Boolean);
  const start = formatClock(list[0]?.startTime || gig?.startTime);
  const end = slotEnd(list[list.length - 1] || gig) || formatClock(gig?.endTime);
  if (!start) return '';
  return end ? `${start} ${upper ? 'TO' : 'to'} ${end}` : start;
}

export function formatGuestPhoneDate(gig, slots) {
  return [formatGigSentence(gig).toUpperCase(), formatGuestTimes(slots, gig, { upper: true })].filter(Boolean).join(' · ');
}

export function formatGuestDesktopDate(gig, slots, place) {
  return [formatGigSentence(gig), formatGuestTimes(slots, gig), place].filter(Boolean).join(' · ');
}

export function formatDurationLabel(minutes) {
  const n = Number(minutes);
  if (!Number.isFinite(n) || n <= 0) return '';
  const hours = Math.floor(n / 60);
  const mins = n % 60;
  if (hours && mins) return `${hours} ${hours === 1 ? 'hr' : 'hrs'} ${mins} min`;
  if (hours) return `${hours} ${hours === 1 ? 'hr' : 'hrs'}`;
  return `${n} min`;
}

export function formatSetLine(slot, index) {
  const start = formatClock(slot?.startTime);
  const end = slotEnd(slot);
  const time = start && end ? `${start} to ${end}` : start;
  return [`Set ${index + 1}`, time, formatDurationLabel(slot?.duration)].filter(Boolean).join(' · ');
}

export function guestFeeLabel(gig, slots = []) {
  const raw = [gig?.fee, gig?.budget, ...slots.map((slot) => slot?.fee || slot?.budget)]
    .map((value) => String(value ?? '').trim())
    .find(Boolean) || '';
  const plain = raw.replace(/\s/g, '').toLowerCase();
  if (!raw || plain === '£' || plain === '£0' || plain === '£0.00' || plain === '0' || plain === 'free' || plain === 'nofee') return '';
  return raw;
}

const KIT_NAMES = {
  pa: ['PA', 'PA'],
  mixingConsole: ['mixing desk', 'mixing desks'],
  soundEngineer: ['sound engineer', 'sound engineers'],
  microphones: ['vocal mic', 'vocal mics'],
  micStands: ['mic stand', 'mic stands'],
  diBoxes: ['DI box', 'DI boxes'],
  stageMonitors: ['stage monitor', 'stage monitors'],
  drumKit: ['drum kit', 'drum kits'],
  bassAmp: ['bass amp', 'bass amps'],
  guitarAmp: ['guitar amp', 'guitar amps'],
  keyboard: ['keyboard', 'keyboards'],
  keyboardStand: ['keyboard stand', 'keyboard stands'],
  stageLighting: ['stage lighting', 'stage lighting'],
  djDecks: ['DJ decks', 'DJ decks'],
};

export function providedKitPhrase(equipment) {
  const parts = (equipment || []).filter((item) => item?.available).map((item) => {
    const names = KIT_NAMES[item.key];
    const qty = Number(item.quantity);
    const count = Number.isFinite(qty) && qty > 0 ? qty : 0;
    if (names) {
      if (count > 1) return `${count} ${names[1]}`;
      return names[0];
    }
    const label = String(item.label || '').trim();
    if (!label) return '';
    return count > 1 ? `${count} ${label}` : label;
  }).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export function venueIsBar(venue) {
  const establishment = String(venue?.establishment || venue?.venueType || '').trim().toLowerCase();
  return establishment === 'pub/bar' || establishment === 'bar';
}

export function atThePlace(venue) {
  return venueIsBar(venue) ? 'the bar' : 'the venue';
}

export function openSetsSummary({ openCount = 0, total = 0, cancelled = false, past = false, allTaken = false, applicationsClosed = false } = {}) {
  if (cancelled) return 'This night has been cancelled';
  if (past) return 'This gig has happened';
  if (allTaken) return 'All sets filled';
  if (applicationsClosed) return 'Applications closed';
  const sets = total === 1 ? 'set' : 'sets';
  return `${openCount} of ${total} ${sets} open`;
}

export function formatShortDay(slot) {
  const date = slotDate(slot);
  if (!date) return 'the night';
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function formatClock(time) {
  if (!time) return '';
  const [hours, minutes] = String(time).split(':');
  if (!hours) return String(time);
  return `${hours.padStart(2, '0')}:${(minutes || '00').padStart(2, '0')}`;
}

export function slotEnd(slot) {
  if (slot?.endTime) return formatClock(slot.endTime);
  if (!slot?.startTime || slot.duration == null) return '';
  const [hours, minutes] = String(slot.startTime).split(':').map(Number);
  if (!Number.isFinite(hours)) return '';
  const total = hours * 60 + (minutes || 0) + Number(slot.duration);
  const h = Math.floor(((total % 1440) + 1440) % 1440 / 60);
  const m = ((total % 60) + 60) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function slotState(slot) {
  const date = slotDate(slot);
  if (date && date.getTime() < Date.now()) return 'played';
  return slotTaken(slot) ? 'booked' : 'open';
}

export function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || '';
}

const BUILT_IN_LAUNCH_VENUE_ID = 'a622f269-1866-44f8-b3f0-bb9ca38eeefe';

function launchVenueRaw() {
  try {
    return import.meta.env.VITE_LAUNCH_VENUE_IDS || '';
  } catch {
    return '';
  }
}

/** The built-in launch venue, plus any ids in VITE_LAUNCH_VENUE_IDS. */
export function launchVenueIds(raw = launchVenueRaw()) {
  const extra = String(raw || '').split(',').map((id) => id.trim()).filter(Boolean);
  return new Set([BUILT_IN_LAUNCH_VENUE_ID, ...extra]);
}

export function isJesusCollege(venue, gig) {
  const venueId = venue?.venueId || venue?.id || gig?.venueId || gig?.venue?.venueId || '';
  if (launchVenueIds().has(venueId)) return true;
  const name = `${venue?.name || ''} ${gig?.venue?.venueName || ''}`.toLowerCase();
  if (name.includes('jesus college')) return true;
  const place = [
    venue?.address?.city,
    venue?.address?.line1,
    venue?.address?.addressLine1,
    typeof venue?.address === 'string' ? venue.address : '',
    gig?.venue?.address,
  ].filter(Boolean).join(' ').toLowerCase();
  const shortName = `${venue?.name || gig?.venue?.venueName || ''}`.trim().toLowerCase();
  return shortName === 'jbar' && (place.includes('cambridge') || place.includes('jesus'));
}

export function isGuestApplyGig(gig, venue) {
  if (!gig) return false;
  if (gig.itemType === 'venue_hire' || gig.bookingMode === 'rental' || gig.kind === 'Venue Rental') return false;
  if (gig.guestApplications === true || venue?.guestApplications === true) return true;
  return isJesusCollege(venue, gig);
}

export function bookerLine(venue, gig) {
  const owner = firstName(venue?.accountName);
  const venueName = String(venue?.name || venue?.venueName || gig?.venue?.venueName || gig?.venueName || '').trim();
  return {
    name: owner || venueName || 'the venue',
    role: String(venue?.bookerRole || '').trim(),
  };
}

export function preferenceReview(slots, ids) {
  const names = (ids || []).map((id) => {
    const index = (slots || []).findIndex((slot) => (slot.gigId || slot.id) === id);
    return index >= 0 ? `Set ${index + 1}` : null;
  }).filter(Boolean);
  if (!names.length) return 'No preference';
  if (names.length === 1) return `Prefers ${names[0]}`;
  if (names.length === 2) return `Prefers ${names[0]} or ${names[1]}`;
  return `Prefers ${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

export function setCountLabel(count) {
  const words = ['', 'One set', 'Two sets', 'Three sets', 'Four sets', 'Five sets'];
  return words[count] || `${count} sets`;
}

export function rememberApplication(gigId, token) {
  const value = `${gigId}:${token}`;
  try { sessionStorage.setItem('guestApplicationLink', value); } catch { /* ignore */ }
  try { localStorage.setItem('guestApplicationLink', value); } catch { /* ignore */ }
}

export function rememberedApplication(gigIds) {
  let raw = '';
  try {
    raw = localStorage.getItem('guestApplicationLink') || sessionStorage.getItem('guestApplicationLink') || '';
  } catch { /* ignore */ }
  const splitAt = raw.indexOf(':');
  if (splitAt < 0) return null;
  const gigId = raw.slice(0, splitAt);
  const token = raw.slice(splitAt + 1);
  if (!token || !(gigIds || []).includes(gigId)) return null;
  return { gigId, token };
}

export function forgetApplication(gigId, token) {
  const drop = (storage) => {
    const raw = storage.getItem('guestApplicationLink') || '';
    const splitAt = raw.indexOf(':');
    if (splitAt < 0) return;
    const storedGigId = raw.slice(0, splitAt);
    const storedToken = raw.slice(splitAt + 1);
    if (storedGigId !== gigId && storedToken !== token) return;
    storage.removeItem('guestApplicationLink');
  };
  try { drop(localStorage); } catch { /* ignore */ }
  try { drop(sessionStorage); } catch { /* ignore */ }
}

export function keepRememberedApplication({ status, httpStatus } = {}) {
  if (httpStatus === 404 || httpStatus === 410) return false;
  if (status === 'withdrawn') return false;
  return true;
}

export function showsManageReview({ status, accepted } = {}) {
  if (accepted) return false;
  const value = String(status || '').toLowerCase();
  return value !== 'declined' && value !== 'withdrawn';
}

function instrumentGiven(member) {
  const raw = member?.instruments ?? member?.instrument ?? '';
  if (Array.isArray(raw)) return raw.some((item) => String(item || '').trim());
  return Boolean(String(raw || '').trim());
}

/** Members the act actually filled in. A blank placeholder row does not count. */
export function filledBandMembers(members) {
  return (Array.isArray(members) ? members : []).filter((member) => {
    const name = String(member?.name || member?.userName || '').trim();
    return Boolean(name || instrumentGiven(member));
  });
}

export function bandMemberPhrase(members, stated) {
  const named = filledBandMembers(members).length;
  const count = named || (Number(stated) > 0 ? Number(stated) : 0);
  if (!count) return '';
  return `${count} ${count === 1 ? 'member' : 'members'}`;
}

const ACT_SIZES = { 1: 'Solo', 2: 'Duo', 3: 'Trio' };

/** Solo, Duo, Trio, or an n-piece, plus the instruments they ticked. A blank row does not count. */
export function actTypeLine(members) {
  const filled = filledBandMembers(members);
  if (!filled.length) return '';
  const kind = ACT_SIZES[filled.length] || `${filled.length}-piece`;
  const seen = new Set();
  const instruments = [];
  filled.forEach((member) => {
    const raw = member?.instruments ?? member?.instrument ?? [];
    const list = Array.isArray(raw) ? raw : String(raw).split(',');
    list.forEach((item) => {
      const label = String(item || '').trim().toLowerCase();
      if (!label || seen.has(label)) return;
      seen.add(label);
      instruments.push(label);
    });
  });
  return instruments.length ? `${kind} · ${instruments.join(', ')}` : kind;
}

export function icsForSet({ title, start, end, location, description, uid, sequence = 0 }) {
  const stamp = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gigin//EN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    uid ? `UID:${uid}` : '',
    `SEQUENCE:${sequence}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${title}`,
    location ? `LOCATION:${location}` : '',
    description ? `DESCRIPTION:${description}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
  return body;
}

export function photoUrl(venue) {
  const photo = venue?.photos?.[0] || venue?.photo;
  if (!photo) return '';
  if (typeof photo === 'string') return photo;
  return photo.url || photo.src || '';
}

export function draftKey(gigId, inviteId) {
  return `guest-apply:${gigId}:${inviteId || 'public'}`;
}

export function readDraft(gigId, inviteId) {
  try {
    const raw = localStorage.getItem(draftKey(gigId, inviteId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeDraft(gigId, inviteId, draft) {
  try {
    localStorage.setItem(draftKey(gigId, inviteId), JSON.stringify(draft));
  } catch { /* the phone may be out of space */ }
}

export function clearDraft(gigId, inviteId) {
  try { localStorage.removeItem(draftKey(gigId, inviteId)); } catch { /* ignore */ }
}
