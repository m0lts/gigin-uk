const BOOKED = new Set(['accepted', 'confirmed', 'paid', 'booked']);

export function isBookedStatus(status) {
  return BOOKED.has(String(status || '').toLowerCase());
}

export function settingsDraft(venue) {
  const know = venue?.actsShouldKnow || {};
  const prefs = venue?.emailPrefs || {};
  return {
    name: venue?.name || '',
    capacity: venue?.capacity != null ? String(venue.capacity) : '',
    address: venue?.address || venue?.formattedAddress || '',
    about: know.about || venue?.description || '',
    pa: know.pa || '',
    soundEngineer: know.soundEngineer || '',
    backline: know.backline || '',
    fee: know.fee || '',
    loadIn: know.loadIn || '',
    emailApplications: prefs.applications !== false,
    emailPromo: prefs.promo !== false,
  };
}

export function settingsPatch(draft) {
  return {
    name: String(draft.name || '').trim(),
    capacity: String(draft.capacity || '').trim(),
    address: String(draft.address || '').trim(),
    actsShouldKnow: {
      about: String(draft.about || '').trim(),
      pa: String(draft.pa || '').trim(),
      soundEngineer: String(draft.soundEngineer || '').trim(),
      backline: String(draft.backline || '').trim(),
      fee: String(draft.fee || '').trim(),
      loadIn: String(draft.loadIn || '').trim(),
    },
    emailPrefs: {
      applications: Boolean(draft.emailApplications),
      promo: Boolean(draft.emailPromo),
    },
  };
}

export function staffLabel(member, ownerId) {
  if (!member) return 'Can view, not change';
  if (member.id === ownerId || member.role === 'owner') return 'Owner';
  const permissions = member.permissions;
  if (!permissions || typeof permissions !== 'object') return 'Can change';
  const writes = Object.entries(permissions).filter(([key, value]) => key !== 'gigs.read' && value === true);
  return writes.length ? 'Can change' : 'Can view, not change';
}

export function initials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function clockToMinutes(value) {
  const [hours, minutes] = String(value || '').split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

export function endFromStart(start, duration) {
  const begin = clockToMinutes(start);
  const length = Number(duration);
  if (begin == null || !Number.isFinite(length)) return '';
  const total = begin + length;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function durationFromRange(start, end) {
  const begin = clockToMinutes(start);
  const finish = clockToMinutes(end);
  if (begin == null || finish == null) return null;
  const span = finish - begin;
  return span > 0 ? span : span + 24 * 60;
}

export function gigEditDraft(gig, slots) {
  const list = Array.isArray(slots) && slots.length ? slots : [gig].filter(Boolean);
  return {
    name: gig?.eventName || gig?.title || gig?.gigName || '',
    fee: gig?.budget != null ? String(gig.budget) : '',
    genre: gig?.genre || gig?.musicStyle || '',
    notes: gig?.description || gig?.notes || '',
    open: gig?.applicationsOpen !== false,
    offersOnly: Boolean(gig?.private),
    sets: list.map((slot) => ({
      gigId: slot.gigId,
      start: String(slot.startTime || '').slice(0, 5),
      end: endFromStart(slot.startTime, slot.duration),
    })),
  };
}

export function timesChanged(before, after) {
  const prior = (before?.sets || []).map((set) => `${set.start}-${set.end}`).join('|');
  const next = (after?.sets || []).map((set) => `${set.start}-${set.end}`).join('|');
  return prior !== next;
}

export function bookedOnGig(gig) {
  return (gig?.applicants || []).filter((applicant) => isBookedStatus(applicant?.status)).length;
}

export function contactKind(contact) {
  return contact?.contactType === 'soundEngineer' || contact?.contactType === 'other' || contact?.contactType === 'promoter'
    ? 'crew'
    : 'artist';
}

export function contactHasPromo(contact) {
  const promo = contact?.promo;
  if (!promo) return false;
  return Boolean(promo.submittedAt || promo.bio || (Array.isArray(promo.photos) && promo.photos.length) || promo.track);
}

export function filterContacts(contacts, { tab = 'all', query = '', kind = 'artists' } = {}) {
  const needle = String(query || '').trim().toLowerCase();
  return (contacts || []).filter((contact) => {
    if (kind === 'crew' && contactKind(contact) !== 'crew') return false;
    if (kind === 'artists' && contactKind(contact) !== 'artist') return false;
    const haystack = `${contact?.name || ''} ${contact?.role || ''} ${contact?.email || ''}`.toLowerCase();
    if (needle && !haystack.includes(needle)) return false;
    if (tab === 'want') return Boolean(contact?.wantToBook);
    if (tab === 'played') return Boolean(contact?.playedHere || (contact?.gigs || []).length);
    if (tab === 'booked') return Boolean(contact?.booked);
    if (tab === 'applied') return Boolean(contact?.applied);
    if (tab === 'promo') return !contactHasPromo(contact);
    return true;
  });
}

export function promoKitSummary(contact) {
  const promo = contact?.promo;
  if (!promo) return null;
  const photos = Array.isArray(promo.photos) ? promo.photos.filter(Boolean) : [];
  return {
    bio: promo.bio || '',
    photos,
    videoUrl: promo.videoUrl || '',
    trackName: promo.track?.name || promo.trackName || '',
    trackUrl: promo.track?.url || '',
    updated: promo.submittedAt || '',
  };
}
