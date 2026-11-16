/* eslint-disable */
import { schedule } from "../../../lib/schedule.js";
import { admin, db, FieldValue, Timestamp } from "../../../lib/admin.js";
import { renderArtistEmail } from "../../../shared/artistEmails.js";
import {
  durableEmailImageUrl,
  emailImageOrigin,
  emailThumbId,
  emailThumbObjectPath,
  storageObjectPath,
} from "../../../shared/emailImages.js";
import { formatPromoDay, londonDayKey, promoDueKey, promoReminderCopy, promoReminderDue } from "../../../shared/promo.js";

const FROM = "Gigin <noreply@giginmusic.com>";
const ORIGIN = process.env.BASE_URL || "https://giginmusic.com";

function firebaseDownloadUrl(bucketName, objectPath, token) {
  const object = encodeURIComponent(objectPath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${object}?alt=media&token=${encodeURIComponent(token)}`;
}

/** The face already published for email. Empty when that JPEG does not exist yet. */
async function existingBookerThumb(source) {
  const ready = durableEmailImageUrl(source);
  if (ready) return ready;
  try {
    const bucket = admin.storage().bucket();
    const objectPath = storageObjectPath(source, bucket.name);
    const id = emailThumbId(objectPath);
    const destPath = emailThumbObjectPath(id);
    if (!destPath) return "";
    const dest = bucket.file(destPath);
    const [exists] = await dest.exists();
    if (!exists) return "";
    const origin = emailImageOrigin();
    if (origin) return `${origin}/api/email-images/${id}.jpg`;
    const [meta] = await dest.getMetadata();
    const token = String(meta?.metadata?.firebaseStorageDownloadTokens || "").split(",")[0].trim();
    if (!token) return "";
    return durableEmailImageUrl(firebaseDownloadUrl(bucket.name, destPath, token));
  } catch {
    return "";
  }
}

export async function sendDuePromoReminders(now = new Date()) {
  const start = Timestamp.fromDate(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const end = Timestamp.fromDate(new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000));
  const snap = await db.collection("gigs").where("startDateTime", ">=", start).where("startDateTime", "<", end).get();
  const todayKey = londonDayKey(now);
  let sent = 0;
  for (const doc of snap.docs) {
    const gig = { gigId: doc.id, ...(doc.data() || {}) };
    if (String(gig.status || "").toLowerCase() === "cancelled") continue;
    const applicants = Array.isArray(gig.applicants) ? gig.applicants : [];
    const rootId = gig.applicationsRootGigId || gig.gigId;
    const venueName = gig.venue?.venueName || gig.venueName || "the venue";
    const gigName = String(gig.gigName || "the gig").replace(/\s*\(Set\s+\d+\)\s*$/, "");
    let bookerName = venueName;
    let bookerPhotoUrl = "";
    if (gig.venueId) {
      const venueSnap = await db.doc(`venueProfiles/${gig.venueId}`).get();
      const venue = venueSnap.exists ? (venueSnap.data() || {}) : {};
      const owner = String(venue.accountName || "").trim().split(/\s+/)[0];
      bookerName = owner || venueName;
      bookerPhotoUrl = await existingBookerThumb(venue.bookerPhoto || "");
    }
    for (const applicant of applicants) {
      if (!applicant?.id) continue;
      const privateRef = db.doc(`gigs/${rootId}/guestApplicants/${applicant.id}`);
      const privSnap = await privateRef.get();
      const priv = privSnap.exists ? privSnap.data() || {} : {};
      const due = promoReminderDue({
        gigDate: gig.startDateTime || gig.date,
        acceptedAt: applicant.acceptedAt || priv.acceptedAt,
        promo: priv.promo,
        reminderSentAt: priv.promoReminderSentAt,
        todayKey,
        status: applicant.status,
        cancelled: false,
      });
      if (!due) continue;
      const email = String(priv.email || "").trim().toLowerCase();
      const token = priv.manageToken;
      if (!email.includes("@") || !token) continue;
      const dueLabel = formatPromoDay(promoDueKey(gig.startDateTime || gig.date, applicant.acceptedAt || priv.acceptedAt));
      const manage = `${ORIGIN}/gig/${gig.gigId}/application/${token}`;
      const message = renderArtistEmail(promoReminderCopy({
        firstName: String(priv.contactName || "there").split(/\s+/)[0],
        venueName,
        gigName,
        dueLabel,
        manageUrl: manage,
        bookerName,
        bookerPhotoUrl,
      }));
      await db.collection("mail").add({ to: email, from: FROM, message });
      await privateRef.set({ promoReminderSentAt: FieldValue.serverTimestamp() }, { merge: true });
      sent += 1;
    }
  }
  return { sent };
}

/** 10:00 Europe/London. One reminder, three days before the promo due date. */
export const sendPromoReminders = schedule(
  {
    schedule: "0 10 * * *",
    timeZone: "Europe/London",
    timeoutSeconds: 300,
    memory: "256MiB",
  },
  async () => {
    const result = await sendDuePromoReminders();
    console.log("promo reminders", result);
  },
);
