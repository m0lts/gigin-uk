import archiver from "archiver";
import { admin, db } from "../config/admin.js";
import { assertVenuePerm } from "../utils/permissions.js";
import { loadGuestPrivates } from "./gigPrivacy.js";
import { loadNightSlots, slotView } from "./nightApplicationOps.js";
import { readNight } from "./nightApplications.js";
import { queueMail } from "./queueMail.js";
import { renderArtistEmail } from "./artistEmails.js";
import { emailThumbUrl } from "./emailThumbs.js";
import { ownerName } from "./ownerName.js";
import { formatPromoDay, promoDueKey, promoReminderCopy, promoZipPlan, safeZipName } from "./promo.js";

const ACTIVE = new Set(["accepted", "confirmed", "paid"]);

function setLabel(count, index) {
  return count < 2 ? "The set" : `Set ${index + 1}`;
}

export async function readPromoNight(gigId, caller) {
  const { slots, rootId } = await loadNightSlots(gigId);
  const root = slots.find((slot) => slot.id === rootId) || slots[0];
  if (!root) {
    const error = new Error("Gig not found.");
    error.statusCode = 404;
    throw error;
  }
  await assertVenuePerm(db, caller, root.data.venueId, "gigs.read");
  const night = readNight(slots.map((slot) => slotView(slot)));
  const privates = await loadGuestPrivates(rootId);
  const gig = root.data || {};
  const gigName = String(gig.gigName || "the gig").replace(/\s*\(Set\s+\d+\)\s*$/, "");
  const venueName = gig.venue?.venueName || gig.venueName || "the venue";
  const acts = night.slots.map((slot, index) => {
    const slotId = slot.gigId || slot.id;
    const app = (night.applications || []).find((entry) => (
      ACTIVE.has(String(entry?.status || "").toLowerCase()) && entry.assignedSlotGigId === slotId
    ));
    const label = setLabel(night.slots.length, index);
    if (!app) return { booked: false, setLabel: label };
    const priv = privates.get(app.id) || {};
    const promo = priv.promo || {};
    return {
      booked: true,
      id: app.id,
      name: app.name || app.actName || app.artistName || "Act",
      status: app.status,
      assignedSlotGigId: app.assignedSlotGigId,
      setLabel: label,
      bio: promo.bio || "",
      photos: Array.isArray(promo.photos) ? promo.photos : [],
      track: promo.track || null,
      videoUrl: promo.videoUrl || "",
      played: promo.played || "",
      email: priv.email || app.email || "",
      token: priv.manageToken || "",
      contactName: priv.contactName || app.contactName || "",
      acceptedAt: app.acceptedAt || priv.acceptedAt || null,
      promo,
    };
  });
  return { rootId, gig, gigName, venueName, acts };
}

export function pipePromoZip(res, acts, filename) {
  const entries = promoZipPlan((acts || []).filter((act) => act?.booked));
  if (!entries.length) {
    res.status(404).json({ error: "Nothing to download yet." });
    return;
  }
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${safeZipName(filename)}.zip"`);
  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.on("error", (err) => {
    console.error("promo zip failed", err);
    if (!res.headersSent) res.status(500).end();
    else res.end();
  });
  archive.pipe(res);
  const bucket = admin.storage().bucket();
  for (const entry of entries) {
    if (entry.text != null) archive.append(entry.text, { name: entry.name });
    else archive.append(bucket.file(entry.path).createReadStream(), { name: entry.name });
  }
  archive.finalize();
}

/** Same reminder as the scheduled one. Does not stamp promoReminderSentAt. */
export async function queuePromoReminder(pack, applicantId) {
  const act = (pack?.acts || []).find((entry) => entry.booked && String(entry.id) === String(applicantId || ""));
  if (!act) {
    const error = new Error("That act is not booked on this night.");
    error.statusCode = 404;
    throw error;
  }
  const email = String(act.email || "").trim().toLowerCase();
  if (!email.includes("@") || !act.token) {
    const error = new Error("This act has no email to remind.");
    error.statusCode = 400;
    throw error;
  }
  const dueLabel = formatPromoDay(promoDueKey(pack.gig.startDateTime || pack.gig.date, act.acceptedAt));
  const origin = String(process.env.BASE_URL || "https://giginmusic.com").replace(/\/$/, "");
  let bookerName = "";
  let bookerPhotoUrl = "";
  const venueId = pack.gig?.venueId || "";
  if (venueId) {
    try {
      const snap = await db.doc(`venueProfiles/${venueId}`).get();
      const venue = snap.exists ? (snap.data() || {}) : {};
      bookerName = ownerName(venue, pack.gig);
      bookerPhotoUrl = await emailThumbUrl(venue.bookerPhoto || "");
    } catch {
      bookerName = "";
      bookerPhotoUrl = "";
    }
  }
  const message = renderArtistEmail(promoReminderCopy({
    firstName: String(act.contactName || "there").split(/\s+/)[0],
    venueName: pack.venueName,
    gigName: pack.gigName,
    dueLabel,
    manageUrl: `${origin}/gig/${pack.rootId}/application/${act.token}`,
    bookerName,
    bookerPhotoUrl,
  }));
  await queueMail({ to: email, from: "Gigin <noreply@giginmusic.com>", message });
  return { sent: true };
}
