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

function formatTimeRangeSpacedLabel(timeRangeLabel) {
  if (!timeRangeLabel || typeof timeRangeLabel !== 'string') return '—';
  return timeRangeLabel.replace(/\s*[\u2013-]\s*/g, ' – ');
}

/**
 * Single programme line for venue-hire UIs (sidebar gig summary, host gig details column).
 * Music start–stop from `eventTimings` (with access/curfew fallbacks), else night `timeRangeLabel`.
 */
export function buildVenueHireGigSummaryProgrammeTimeLabel(rawGig, normalisedGig, accessFrom, curfew) {
  const rows = buildVenueHireGigDetailsTimingDisplayRows(rawGig, accessFrom, curfew);
  const ms = rows.find((r) => r.key === 'musicStart')?.displayTime ?? '—';
  const mStop = rows.find((r) => r.key === 'musicStop')?.displayTime ?? '—';
  if (ms !== '—' && mStop !== '—') {
    return formatTimeRangeSpacedLabel(`${ms}–${mStop}`);
  }
  if (ms !== '—') return ms;
  if (mStop !== '—') return mStop;
  const tr = normalisedGig?.timeRangeLabel;
  if (tr && String(tr).trim()) return formatTimeRangeSpacedLabel(String(tr));
  return '—';
}

/** End HH:MM from start + duration (minutes); same-day wrap at 24h as elsewhere in the app. */
function endTimeFromStartAndDurationMinutes(startTime, durationMinutes) {
  if (!startTime || !String(startTime).trim() || !(Number(durationMinutes) > 0)) return '';
  const [h, m] = String(startTime).trim().split(':').map(Number);
  if (!Number.isFinite(h)) return '';
  const totalMins = h * 60 + (Number.isFinite(m) ? m : 0) + Number(durationMinutes);
  const eh = Math.floor(totalMins / 60) % 24;
  const em = totalMins % 60;
  return formatVenueHireTimeDisplay(`${eh}:${em}`);
}

/**
 * One continuous timeline for a multi-set artist booking: shared access/soundcheck from
 * `rawGig.eventTimings`, then each set’s slot window, then night-level music stop / vacate.
 * @param {object} rawGig Primary slot gig (carries shared `eventTimings`).
 * @param {object[]} sortedSlotGigs All slot docs, sorted by startTime.
 * @returns {{ key: string, label: string, displayTime: string }[]}
 */
export function buildArtistBookingMergedTimingDisplayRows(rawGig, sortedSlotGigs, accessFrom, curfew) {
  const rows = [];
  const et = rawGig?.eventTimings;
  const hasEt = et && typeof et === 'object' && !Array.isArray(et);

  let accessRaw = '';
  if (hasEt && et.accessFrom != null) accessRaw = String(et.accessFrom).trim();
  if (!accessRaw && accessFrom != null && accessFrom !== '') accessRaw = String(accessFrom).trim();
  if (accessRaw) {
    rows.push({
      key: 'accessFrom',
      label: 'Access / load-in',
      displayTime: formatVenueHireTimeDisplay(accessRaw),
    });
  }

  if (hasEt && et.soundcheck != null && String(et.soundcheck).trim()) {
    rows.push({
      key: 'soundcheck',
      label: 'Soundcheck',
      displayTime: formatVenueHireTimeDisplay(et.soundcheck),
    });
  }

  const slots = Array.isArray(sortedSlotGigs) ? sortedSlotGigs.filter(Boolean) : [];
  slots.forEach((slot, idx) => {
    const st = slot?.startTime;
    const dur = slot?.duration;
    const startDisp = st ? formatVenueHireTimeDisplay(st) : '—';
    const endDisp = endTimeFromStartAndDurationMinutes(st, dur);
    const timeDisp = endDisp && st ? `${startDisp}–${endDisp}` : startDisp;
    rows.push({
      key: `set-${idx + 1}`,
      label: `Set ${idx + 1}`,
      displayTime: timeDisp,
    });
  });

  let musicStopRaw = '';
  if (hasEt && et.musicStop != null) musicStopRaw = String(et.musicStop).trim();
  if (!musicStopRaw && curfew != null && curfew !== '') musicStopRaw = String(curfew).trim();
  if (musicStopRaw) {
    rows.push({
      key: 'musicStop',
      label: 'Music stop',
      displayTime: formatVenueHireTimeDisplay(musicStopRaw),
    });
  }

  if (hasEt && et.mustVacate != null && String(et.mustVacate).trim()) {
    rows.push({
      key: 'mustVacate',
      label: 'Must vacate',
      displayTime: formatVenueHireTimeDisplay(et.mustVacate),
    });
  }

  return rows;
}
