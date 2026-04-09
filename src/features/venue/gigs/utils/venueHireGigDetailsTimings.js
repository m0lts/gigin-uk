/** Same labels as BookNewEventWizard; keys match API `eventTimings` (AddGigsModal `buildEventTimingsForStorage`). */
export const VENUE_HIRE_GIG_DETAIL_TIMING_STEPS = [
  ['accessFrom', 'Access / load-in'],
  ['soundcheck', 'Soundcheck'],
  ['musicStart', 'Music start'],
  ['musicStop', 'Music stop'],
  ['mustVacate', 'Must vacate'],
];

export function formatVenueHireTimeDisplay(timeString) {
  if (timeString == null) return '—';
  const s = String(timeString).trim();
  if (!s) return '—';
  const [h, m] = s.split(':').map(Number);
  if (!Number.isFinite(h)) return s;
  return `${String(h).padStart(2, '0')}:${String(Number.isFinite(m) ? m : 0).padStart(2, '0')}`;
}

function timeStringToMinutes(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const [h, m] = s.split(':').map(Number);
  if (!Number.isFinite(h)) return null;
  return h * 60 + (Number.isFinite(m) ? m : 0);
}

function minutesToFormattedDisplay(totalMins) {
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return formatVenueHireTimeDisplay(`${h}:${m}`);
}

/**
 * Earliest–latest across event timings, access/curfew, and start/end (e.g. header "18:00–22:30").
 * Empty times omitted; returns null if nothing to show.
 */
export function buildVenueHireEarliestLatestTimeRangeLabel(rawGig) {
  if (!rawGig) return null;
  const minutes = [];
  const add = (v) => {
    const mm = timeStringToMinutes(v);
    if (mm != null) minutes.push(mm);
  };

  const et = rawGig.eventTimings;
  if (et && typeof et === 'object' && !Array.isArray(et)) {
    for (const [key] of VENUE_HIRE_GIG_DETAIL_TIMING_STEPS) {
      add(et[key]);
    }
  }
  add(rawGig.rentalAccessFrom ?? rawGig.accessFrom);
  add(rawGig.rentalHardCurfew ?? rawGig.curfew);
  add(rawGig.startTime);
  add(rawGig.endTime);

  if (minutes.length === 0) return null;
  const lo = Math.min(...minutes);
  const hi = Math.max(...minutes);
  const a = minutesToFormattedDisplay(lo);
  const b = minutesToFormattedDisplay(hi);
  if (a === b) return a;
  return `${a}\u2013${b}`;
}

/** Row labels for the gig details tile (left column); fixed order, all rows shown. */
const GIG_DETAILS_TIMING_DISPLAY_LABELS = {
  accessFrom: 'Access',
  soundcheck: 'Soundcheck',
  musicStart: 'Music Start',
  musicStop: 'Music Stop',
  mustVacate: 'Must Vacate',
};

/**
 * All timing steps for display (e.g. sidebar grid), including "—" when empty.
 * @returns {{ key: string, label: string, displayTime: string }[]}
 */
export function buildVenueHireGigDetailsTimingDisplayRows(rawGig, accessFrom, curfew) {
  const et = rawGig?.eventTimings;
  const hasFullEt = et && typeof et === 'object' && !Array.isArray(et);
  return VENUE_HIRE_GIG_DETAIL_TIMING_STEPS.map(([key]) => {
    let raw = '';
    if (hasFullEt && et[key] != null) raw = String(et[key]).trim();
    if (!raw && !hasFullEt) {
      if (key === 'accessFrom' && accessFrom != null && accessFrom !== '') {
        raw = String(accessFrom).trim();
      }
      if (key === 'musicStop' && curfew != null && curfew !== '') {
        raw = String(curfew).trim();
      }
    }
    const label = GIG_DETAILS_TIMING_DISPLAY_LABELS[key] || key;
    return {
      key,
      label,
      displayTime: raw ? formatVenueHireTimeDisplay(raw) : '—',
    };
  });
}
