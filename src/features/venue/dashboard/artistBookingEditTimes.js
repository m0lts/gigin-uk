function minutesOf(clock) {
  const [hours, minutes] = String(clock || '').trim().split(':').map(Number);
  if (!Number.isFinite(hours)) return null;
  return hours * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

function clockFromMinutes(total) {
  const wrapped = ((total % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function minutesBetween(start, end) {
  const startMinutes = minutesOf(start);
  const endMinutes = minutesOf(end);
  if (startMinutes == null || endMinutes == null) return 0;
  let diff = endMinutes - startMinutes;
  if (diff <= 0) diff += 1440;
  return diff;
}

function dateAt(dateIso, clock) {
  const time = String(clock || '').trim();
  if (!dateIso || !time) return null;
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date(`${dateIso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return date;
}

/**
 * Times written onto one set document when Edit gig saves.
 *
 * A single-set night is edited through Music start and Music end. Those
 * fields must replace the start time that was loaded from the gig, which
 * otherwise stays on the slot row and is what the save used to persist.
 *
 * A multi-set night keeps each set's own start and length. Moving the first
 * set does not shift the later ones, and the night-wide music envelope is
 * not copied onto them.
 */
export function artistBookingEditTimes({ gig, slot, slotIndex, slotCount, dateIso }) {
  const storedStart = String(slot?.startTime ?? '').trim();
  const storedDuration = Number(slot?.duration);
  const musicStart = String(gig?.timingMusicStartTime || '').trim();
  const musicStop = String(gig?.timingMusicStopTime || '').trim();
  const single = !slotCount || slotCount <= 1;

  let startTime = storedStart;
  let duration = Number.isFinite(storedDuration) && storedDuration > 0 ? storedDuration : undefined;

  if (single) {
    if (musicStart) startTime = musicStart;
    if (musicStart && musicStop) {
      const fromMusic = minutesBetween(musicStart, musicStop);
      if (fromMusic > 0) duration = fromMusic;
    }
  } else if (!startTime && slotIndex === 0 && musicStart) {
    startTime = musicStart;
  }

  const endTime = startTime && duration ? clockFromMinutes(minutesOf(startTime) + duration) : '';
  const startDateTime = startTime ? dateAt(dateIso, startTime) : null;
  const date = startDateTime || dateAt(dateIso, '12:00');

  return {
    ...(startTime && { startTime }),
    ...(duration && { duration }),
    ...(endTime && { endTime }),
    ...(startDateTime && { startDateTime }),
    ...(date && { date }),
  };
}
