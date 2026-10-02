/**
 * One application per night, stored on the earliest slot (the applications root).
 * Reads accept the previous per-slot shape: `slotGigIds` is the preference, and
 * the same applicant id on several slots is one application.
 */

const BOOKED_STATUSES = new Set(["confirmed", "accepted", "paid"]);

const STATUS_RANK = {
  withdrawn: 1,
  declined: 2,
  pending: 3,
  sent: 3,
  accepted: 4,
  confirmed: 4,
  paid: 4,
};

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function unique(ids) {
  const seen = new Set();
  const out = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function slotGigId(slot) {
  return slot?.gigId || slot?.id || null;
}

export function slotStartMinutes(slot) {
  const [hours, minutes] = String(slot?.startTime || "").split(":");
  const h = Number(hours);
  const m = Number(minutes);
  if (!Number.isFinite(h)) return Number.POSITIVE_INFINITY;
  return h * 60 + (Number.isFinite(m) ? m : 0);
}

export function sortSlots(slots) {
  return [...(slots || [])].filter((slot) => slotGigId(slot)).sort((a, b) => {
    const diff = slotStartMinutes(a) - slotStartMinutes(b);
    if (diff !== 0) return diff;
    return String(slotGigId(a)).localeCompare(String(slotGigId(b)));
  });
}

/** Earliest slot by start time. A single slot points at itself. */
export function applicationsRootGigId(slots) {
  const list = sortSlots(slots);
  if (!list.length) return null;
  const stored = unique(list.map((slot) => slot.applicationsRootGigId).filter(Boolean));
  if (stored.length === 1 && list.some((slot) => slotGigId(slot) === stored[0])) {
    return stored[0];
  }
  return slotGigId(list[0]);
}

export function isBookedStatus(status) {
  return BOOKED_STATUSES.has(String(status || "").toLowerCase());
}

function statusRank(status) {
  return STATUS_RANK[String(status || "").toLowerCase()] || 3;
}

/**
 * Preference for one applicant. An explicit `preferredSlotGigIds` (including
 * `[]`, no preference) wins. Otherwise `slotGigIds`. Otherwise the slots the
 * old per-slot application was written on.
 */
export function preferredSlotGigIds(applicant, copies = null) {
  const list = copies || [applicant];
  const explicit = list.filter((copy) => Array.isArray(copy?.preferredSlotGigIds));
  if (explicit.length) {
    return unique(explicit.flatMap((copy) => copy.preferredSlotGigIds));
  }
  const legacy = list.filter((copy) => Array.isArray(copy?.slotGigIds));
  if (legacy.length) {
    return unique(legacy.flatMap((copy) => copy.slotGigIds));
  }
  if (copies) return unique(copies.map((copy) => copy?._slotGigId).filter(Boolean));
  return [];
}

export function assignedSlotGigId(applicant, copies = null) {
  const list = copies || [applicant];
  const explicit = list.filter((copy) => hasOwn(copy, "assignedSlotGigId"));
  if (explicit.length) {
    const set = explicit.find((copy) => copy.assignedSlotGigId);
    return set ? set.assignedSlotGigId : null;
  }
  const booked = list.find((copy) => copy?._slotGigId && isBookedStatus(copy.status));
  return booked ? booked._slotGigId : (applicant?.assignedSlotGigId || null);
}

function strongest(copies) {
  return copies.reduce((best, copy) => (
    statusRank(copy?.status) > statusRank(best?.status) ? copy : best
  ), copies[0]);
}

function stamp(copies, best, key) {
  if (best?.[key]) return best[key];
  const found = copies.find((copy) => copy?.[key]);
  return found ? found[key] : undefined;
}

/** Collapse copies of one applicant id into the night-level entry. */
export function mergeApplicantCopies(copies) {
  const list = (copies || []).filter((copy) => copy && copy.id != null);
  if (!list.length) return null;
  const best = strongest(list);
  const preferred = preferredSlotGigIds(best, list);
  const assigned = assignedSlotGigId(best, list);
  const legacyIds = list.some((copy) => Array.isArray(copy.slotGigIds))
    ? unique(list.flatMap((copy) => (Array.isArray(copy.slotGigIds) ? copy.slotGigIds : [])))
    : unique(list.map((copy) => copy._slotGigId).filter(Boolean));
  const merged = { ...best };
  for (const copy of list) {
    for (const [key, value] of Object.entries(copy)) {
      if (key === "_slotGigId" || value == null || value === "") continue;
      if (merged[key] == null || merged[key] === "") merged[key] = value;
    }
  }
  Object.assign(merged, {
    preferredSlotGigIds: preferred,
    assignedSlotGigId: assigned,
    slotGigIds: legacyIds,
    withdrawnAfterAccept: list.some((copy) => copy.withdrawnAfterAccept === true),
  });
  delete merged._slotGigId;
  for (const key of ["acceptedAt", "assignedAt", "declinedAt", "withdrawnAt", "declineEmailSendAt"]) {
    const value = stamp(list, best, key);
    if (value) merged[key] = value;
  }
  return merged;
}

/** De-duplicate by applicant id. Copies keep `_slotGigId` for the migration. */
export function dedupeApplicants(entries) {
  const groups = new Map();
  for (const entry of entries || []) {
    if (!entry || entry.id == null) continue;
    const key = String(entry.id);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  return [...groups.values()].map((copies) => mergeApplicantCopies(copies));
}

/** Stored `bookedApplicantId`, or the confirmed mirror on an old slot doc. */
export function bookedApplicantId(slot) {
  if (!slot) return null;
  if (hasOwn(slot, "bookedApplicantId")) return slot.bookedApplicantId || null;
  const booked = (Array.isArray(slot.applicants) ? slot.applicants : []).find((entry) => (
    entry?.id != null && isBookedStatus(entry.status)
  ));
  return booked ? booked.id : null;
}

export function slotTaken(slot) {
  if (!slot) return false;
  if (hasOwn(slot, "bookedApplicantId")) return Boolean(slot.bookedApplicantId);
  if (hasOwn(slot, "taken")) return slot.taken === true;
  return Boolean(bookedApplicantId(slot));
}

const PUBLIC_LINEUP_STATUSES = new Set(["accepted", "confirmed", "paid"]);

/**
 * One confirmed act, safe to leave on a world-readable gig document:
 * act name and the set they are playing.
 */
export function publicLineupEntry(applicant, slotId) {
  const name = applicant?.name || applicant?.artistName || applicant?.actName || "";
  return {
    id: applicant.id,
    name,
    artistName: applicant?.artistName || applicant?.name || name,
    status: "confirmed",
    assignedSlotGigId: applicant?.assignedSlotGigId || slotId || null,
  };
}

/**
 * Accepted or confirmed, and assigned to this set.
 * A one-slot night can still carry an old confirmed row with no assignment.
 */
export function isPublicLineup(applicant, slotId, options = {}) {
  if (!applicant || applicant.id == null) return false;
  const status = String(applicant.status || "").toLowerCase();
  if (!PUBLIC_LINEUP_STATUSES.has(status)) return false;
  const assigned = applicant.assignedSlotGigId || null;
  if (assigned) return assigned === slotId;
  return options.onlySlot === true && (status === "confirmed" || status === "paid");
}

export function publicLineup(applicants, slotId, options = {}) {
  const seen = new Set();
  const out = [];
  for (const entry of applicants || []) {
    if (!isPublicLineup(entry, slotId, options)) continue;
    const key = String(entry.id);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(publicLineupEntry(entry, slotId));
  }
  return out;
}

/** Artist-facing slot. No act names. */
export function publicSlot(slot) {
  return {
    gigId: slotGigId(slot),
    startTime: slot?.startTime || null,
    duration: slot?.duration ?? null,
    hint: typeof slot?.hint === "string" ? slot.hint : "",
    taken: slotTaken(slot),
  };
}

export function publicSlots(slots) {
  return sortSlots(slots).map((slot) => publicSlot(slot));
}

const MIRROR_KEYS = [
  "type",
  "guest",
  "name",
  "artistName",
  "timestamp",
  "appliedAt",
  "createdAt",
  "updatedAt",
  "viewed",
  "invited",
  "sentBy",
  "fee",
  "proposedFee",
  "userId",
  "linkedArtistId",
  "preferredSlotGigIds",
  "techSetup",
];

/** The `status: 'confirmed'` row existing per-slot screens already read. */
export function confirmedMirrorEntry(applicant, slotId) {
  if (!applicant?.id) return null;
  const mirror = { id: applicant.id, status: "confirmed" };
  for (const key of MIRROR_KEYS) {
    if (applicant[key] !== undefined) mirror[key] = applicant[key];
  }
  if (!mirror.name) mirror.name = applicant.actName || "";
  if (!mirror.artistName) mirror.artistName = mirror.name;
  mirror.preferredSlotGigIds = preferredSlotGigIds(applicant);
  mirror.assignedSlotGigId = slotId || applicant.assignedSlotGigId || null;
  return mirror;
}

/**
 * Slot `applicants[]` as existing screens should see it.
 * Once `bookedApplicantId` is stored, that act is the confirmed mirror and
 * pending applicants stay off the slot. Older docs are returned unchanged.
 */
export function readSlotApplicants(slot, nightApplications = []) {
  const stored = Array.isArray(slot?.applicants) ? slot.applicants : [];
  if (!hasOwn(slot, "bookedApplicantId")) return stored;
  const bookedId = slot.bookedApplicantId || null;
  if (!bookedId) {
    return stored.filter((entry) => String(entry?.status || "").toLowerCase() !== "confirmed");
  }
  const source = nightApplications.find((entry) => String(entry?.id) === String(bookedId))
    || stored.find((entry) => String(entry?.id) === String(bookedId));
  const mirror = source
    ? confirmedMirrorEntry(source, slotGigId(slot))
    : { id: bookedId, status: "confirmed", assignedSlotGigId: slotGigId(slot) };
  const rest = stored.filter((entry) => String(entry?.id) !== String(bookedId)
    && String(entry?.status || "").toLowerCase() !== "confirmed");
  return [...rest, mirror];
}

const ACTIVE = new Set(["accepted", "confirmed", "paid"]);

/** Move an accepted act onto a set, swap with the act already there, or clear the set. */
export function planAssignment(applications, applicantId, slotGigId) {
  const apps = (applications || []).map((entry) => ({ ...entry }));
  const act = apps.find((entry) => String(entry.id) === String(applicantId));
  if (!act) return { error: "Application not found." };
  if (!ACTIVE.has(String(act.status || "").toLowerCase())) {
    return { error: "Accept them before giving them a set." };
  }
  const nextSlot = slotGigId || null;
  const previous = act.assignedSlotGigId || null;
  if (nextSlot === previous) return { applications: apps, displaced: null, previous };
  let displaced = null;
  if (nextSlot) {
    displaced = apps.find((entry) => (
      String(entry.id) !== String(act.id)
      && entry.assignedSlotGigId === nextSlot
      && ACTIVE.has(String(entry.status || "").toLowerCase())
    )) || null;
    if (displaced) {
      displaced.assignedSlotGigId = previous;
      displaced.assignedAt = new Date().toISOString();
    }
  }
  act.assignedSlotGigId = nextSlot;
  if (nextSlot) act.assignedAt = new Date().toISOString();
  if (String(act.status).toLowerCase() === "confirmed") act.status = "accepted";
  if (displaced && String(displaced.status).toLowerCase() === "confirmed") displaced.status = "accepted";
  return { applications: apps, displaced, previous };
}

export function preferencePhrase(slots, ids) {
  const labels = (ids || []).map((id) => {
    const index = sortSlots(slots).findIndex((slot) => slotGigId(slot) === id);
    return index >= 0 ? `Set ${index + 1}` : null;
  }).filter(Boolean);
  if (!labels.length) return "";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`;
}

/** Read a night from slot docs already in memory. */
export function readNight(slots) {
  const ordered = sortSlots(slots);
  const root = applicationsRootGigId(ordered);
  const tagged = [];
  for (const slot of ordered) {
    const id = slotGigId(slot);
    for (const applicant of slot.applicants || []) {
      if (!applicant || applicant.id == null) continue;
      tagged.push({ ...applicant, _slotGigId: id });
    }
  }
  const applications = dedupeApplicants(tagged);
  return {
    applicationsRootGigId: root,
    applications,
    slots: ordered.map((slot) => ({
      ...slot,
      applicationsRootGigId: root,
      bookedApplicantId: bookedApplicantId(slot),
      taken: slotTaken(slot),
      applicants: readSlotApplicants(slot, applications),
    })),
    publicSlots: publicSlots(ordered),
  };
}
