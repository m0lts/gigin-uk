import { db } from "../config/admin.js";

/** Fields that must not sit on the world-readable gigs/{id} document. */
export const PRIVATE_KEYS = [
  "contactName",
  "email",
  "phone",
  "instagram",
  "links",
  "note",
  "applicationMessage",
  "needs",
  "bringOwn",
  "assets",
  "photoUrl",
  "photo",
  "members",
  "manageTokenHash",
  "manageToken",
  "crmEntryId",
  "whatsapp",
  "venueId",
  "inviteId",
  "gigName",
  "venueName",
  "dateLabel",
  "setLabel",
  "source",
  "artistProfileId",
  "keepProfileOffer",
  "reminderCount",
  "profileSlug",
  "setChangedFrom",
  "setChangeSeenAt",
  "reminderSentAt",
  "calendarSequence",
];

const DETAILS_FIELDS = [
  "soundEngineerName",
  "soundEngineerContact",
  "soundEngineerLastEdited",
  "media",
  "mediaShareTokenHash",
];

/**
 * Operational guest record. Contact details stay on guestApplicants/{id}.
 * This object is stored for the venue under private/applications, not on the
 * world-readable gig document.
 */
export function guestStub(full = {}) {
  const created = full.createdAt || full.timestamp || full.appliedAt || new Date().toISOString();
  const stub = {
    id: full.id,
    type: "guest",
    guest: true,
    status: full.status || "pending",
    name: full.name || full.artistName || "",
    artistName: full.artistName || full.name || "",
    slotGigIds: Array.isArray(full.slotGigIds) ? full.slotGigIds : [],
    createdAt: created,
    timestamp: full.timestamp || created,
    appliedAt: full.appliedAt || created,
    updatedAt: full.updatedAt || new Date().toISOString(),
    viewed: full.viewed === true,
    invited: full.invited === true,
    sentBy: full.sentBy || "musician",
  };
  if (full.userId) stub.userId = full.userId;
  if (full.linkedArtistId) stub.linkedArtistId = full.linkedArtistId;
  if (full.artistProfileId) stub.artistProfileId = full.artistProfileId;
  if (full.profileSlug) stub.profileSlug = full.profileSlug;
  if (full.fee != null) stub.fee = full.fee;
  if (full.proposedFee != null) stub.proposedFee = full.proposedFee;
  if (Array.isArray(full.preferredSlotGigIds)) stub.preferredSlotGigIds = full.preferredSlotGigIds;
  if (Object.prototype.hasOwnProperty.call(full, "assignedSlotGigId")) {
    stub.assignedSlotGigId = full.assignedSlotGigId || null;
  }
  if (full.withdrawnAfterAccept === true) stub.withdrawnAfterAccept = true;
  if (full.lastSlotGigId) stub.lastSlotGigId = full.lastSlotGigId;
  if (full.undo) stub.undo = full.undo;
  for (const key of ["acceptedAt", "assignedAt", "declinedAt", "withdrawnAt", "declineEmailSendAt"]) {
    if (full[key]) stub[key] = full[key];
  }
  return stub;
}

export function guestPrivate(full = {}, gigId) {
  const out = {
    applicantId: full.id || null,
    gigId: gigId || full.gigId || null,
  };
  for (const key of PRIVATE_KEYS) {
    if (full[key] !== undefined) out[key] = full[key];
  }
  return out;
}

export function isGuestApplicant(entry) {
  return entry?.type === "guest" || entry?.guest === true;
}

/** Applicant state the venue needs, without tokens or a guest's contact details. */
export function operationalApplicant(entry) {
  if (!entry || entry.id == null) return null;
  if (isGuestApplicant(entry)) return guestStub(entry);
  const next = { ...entry };
  delete next.manageToken;
  delete next.manageTokenHash;
  delete next.email;
  delete next._slotGigId;
  for (const key of PRIVATE_KEYS) {
    if (key === "applicationMessage" || key === "artistProfileId" || key === "profileSlug") continue;
    delete next[key];
  }
  return next;
}

export async function loadPrivateApplications(rootId) {
  if (!rootId) return null;
  const snap = await db.doc(`gigs/${rootId}/private/applications`).get();
  return snap.exists ? (snap.data() || null) : null;
}

export async function savePrivateApplications(rootId, applicants, extra = {}) {
  if (!rootId) return;
  const next = {
    gigId: rootId,
    applicants: (Array.isArray(applicants) ? applicants : []).map(operationalApplicant).filter(Boolean),
  };
  for (const [key, value] of Object.entries(extra)) next[key] = value;
  await db.doc(`gigs/${rootId}/private/applications`).set(next, { merge: true });
}

export function sanitiseApplicants(list) {
  if (!Array.isArray(list)) return list;
  return list.map((entry) => (isGuestApplicant(entry) ? guestStub(entry) : entry));
}

export function mergeGuest(stub, priv) {
  if (!priv) return stub;
  return { ...priv, ...stub, id: stub?.id || priv.applicantId };
}

export async function loadGuestPrivate(gigId, applicantId) {
  if (!gigId || !applicantId) return null;
  const snap = await db.doc(`gigs/${gigId}/guestApplicants/${applicantId}`).get();
  return snap.exists ? snap.data() : null;
}

export async function loadGuestPrivates(gigId) {
  const map = new Map();
  if (!gigId) return map;
  const snap = await db.collection(`gigs/${gigId}/guestApplicants`).get();
  snap.forEach((doc) => map.set(doc.id, doc.data() || {}));
  return map;
}

export function mergeApplicants(applicants, map) {
  return (Array.isArray(applicants) ? applicants : []).map((entry) => {
    if (!isGuestApplicant(entry)) return entry;
    const priv = map?.get?.(entry.id);
    return priv ? mergeGuest(entry, priv) : entry;
  });
}

export async function loadPrivateDetails(gigId) {
  if (!gigId) return {};
  const snap = await db.doc(`gigs/${gigId}/private/details`).get();
  return snap.exists ? snap.data() || {} : {};
}

export async function savePrivateDetails(gigId, patch) {
  if (!gigId || !patch) return;
  const next = { gigId };
  for (const key of DETAILS_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) next[key] = patch[key];
  }
  if (Object.keys(next).length <= 1) return;
  await db.doc(`gigs/${gigId}/private/details`).set(next, { merge: true });
}

export function splitGigUpdate(updates) {
  const privatePatch = {};
  const publicUpdates = { ...(updates || {}) };
  for (const key of DETAILS_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(publicUpdates, key)) {
      privatePatch[key] = publicUpdates[key];
      delete publicUpdates[key];
    }
  }
  if (Array.isArray(publicUpdates.applicants)) {
    publicUpdates.applicants = sanitiseApplicants(publicUpdates.applicants);
  }
  return { publicUpdates, privatePatch };
}

export function venueGuestView(data = {}) {
  return {
    email: data.email || null,
    phone: data.phone || null,
    instagram: data.instagram || null,
    links: data.links || {},
    note: data.note || "",
    applicationMessage: data.applicationMessage || data.note || "",
    needs: data.needs || [],
    bringOwn: data.bringOwn || [],
    photoUrl: data.photoUrl || data.photo?.url || null,
    photo: data.photo || null,
    assets: data.assets || [],
    members: data.members || [],
    contactName: data.contactName || "",
    setLabel: data.setLabel || "",
    crmEntryId: data.crmEntryId || null,
    whatsapp: data.whatsapp === true || data.contacts?.whatsapp === true,
  };
}

export function publicMediaItem(item = {}) {
  return {
    id: item.id,
    name: item.name,
    contentType: item.contentType,
    size: item.size,
    uploadedAt: item.uploadedAt || null,
  };
}
