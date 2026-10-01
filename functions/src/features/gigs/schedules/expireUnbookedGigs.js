/* eslint-disable */
import { schedule } from "../../../lib/schedule.js";
import { db, Timestamp, FieldValue } from "../../../lib/admin.js";

const BASE_URL = process.env.BASE_URL || "https://app.gigin.com";
const PAGE_SIZE = 100;

/**
 * Scheduled task: Expire unbooked gigs and venue hire opportunities once their date passes.
 *
 * Runs nightly at 03:00 UTC.
 *
 * For regular gigs:
 *   - Finds gigs with startDateTime in the past and status 'open' (unbooked / no confirmed applicant).
 *   - Updates any 'pending' applicants to 'expired'.
 *   - Sets the gig status to 'expired'.
 *   - Sends an email notification to each affected artist.
 *
 * For venue hire opportunities:
 *   - Finds hire opportunities with date in the past and status 'available' or 'pending' (unbooked).
 *   - Updates any 'pending' applicants to 'expired'.
 *   - Sets the hire opportunity status to 'expired'.
 *   - Sends an email notification to each affected artist.
 *
 * Only gigs that passed within the last 30 days are processed to avoid
 * sending stale notifications for very old data.
 */
export const expireUnbookedGigs = schedule(
  {
    schedule: "0 3 * * *",
    timeZone: "Etc/UTC",
    timeoutSeconds: 540,
    memory: "256MiB",
  },
  async () => {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    // Send notification emails only for gigs that passed within the last 48 h
    const notifyAfter = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    let gigsExpired = 0;
    let hiresExpired = 0;
    let notificationsSent = 0;

    // ── Regular gigs ─────────────────────────────────────────────────────────

    let lastGigDoc = null;
    while (true) {
      let q = db
        .collection("gigs")
        .where("startDateTime", "<", Timestamp.fromDate(now))
        .where("startDateTime", ">=", Timestamp.fromDate(cutoff))
        .where("status", "==", "open")
        .orderBy("startDateTime", "asc")
        .limit(PAGE_SIZE);
      if (lastGigDoc) q = q.startAfter(lastGigDoc);

      const snap = await q.get();
      if (snap.empty) break;

      for (const gigDoc of snap.docs) {
        const gig = gigDoc.data() || {};
        const applicants = Array.isArray(gig.applicants) ? gig.applicants : [];
        const pendingApplicants = applicants.filter((a) => a?.status === "pending");
        const hasConfirmed = applicants.some((a) =>
          ["confirmed", "accepted", "paid", "payment processing"].includes(a?.status)
        );

        if (hasConfirmed || pendingApplicants.length === 0) continue;

        const updatedApplicants = applicants.map((a) =>
          a?.status === "pending" ? { ...a, status: "expired" } : a
        );

        await gigDoc.ref.update({
          applicants: updatedApplicants,
          status: "expired",
          expiredAt: FieldValue.serverTimestamp(),
        });
        gigsExpired++;

        const gigStartDate = gig.startDateTime?.toDate?.() ?? null;
        const sendEmail = gigStartDate && gigStartDate >= notifyAfter;

        if (sendEmail) {
          const venueName = await getVenueName(gig.venueId);
          const gigDateLabel = gigStartDate
            ? gigStartDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
            : null;

          for (const applicant of pendingApplicants) {
            const applicantIsGuest = applicant?.guest === true || applicant?.type === "guest";
            const email = applicantIsGuest ? (applicant.email || null) : await getArtistEmail(applicant.id);
            if (!email) continue;
            await sendExpiryEmail({
              recipientEmail: email,
              gigName: gig.gigName || "Gig",
              venueName,
              gigDateLabel,
              gigId: gigDoc.id,
            });
            notificationsSent++;
          }
        }
      }

      lastGigDoc = snap.docs[snap.docs.length - 1];
      if (snap.size < PAGE_SIZE) break;
    }

    // ── Venue hire opportunities ──────────────────────────────────────────────

    let lastHireDoc = null;
    while (true) {
      let q = db
        .collection("venueHireOpportunities")
        .where("date", "<", Timestamp.fromDate(now))
        .where("date", ">=", Timestamp.fromDate(cutoff))
        .where("status", "in", ["available", "pending"])
        .orderBy("date", "asc")
        .limit(PAGE_SIZE);
      if (lastHireDoc) q = q.startAfter(lastHireDoc);

      const snap = await q.get();
      if (snap.empty) break;

      for (const hireDoc of snap.docs) {
        const hire = hireDoc.data() || {};
        const applicants = Array.isArray(hire.applicants) ? hire.applicants : [];
        const pendingApplicants = applicants.filter((a) => a?.status === "pending");

        const updatedApplicants = applicants.map((a) =>
          a?.status === "pending" ? { ...a, status: "expired" } : a
        );

        await hireDoc.ref.update({
          applicants: updatedApplicants,
          status: "expired",
          expiredAt: FieldValue.serverTimestamp(),
        });
        hiresExpired++;

        const hireDate = hire.date?.toDate?.() ?? null;
        const sendEmail = hireDate && hireDate >= notifyAfter;

        if (sendEmail && pendingApplicants.length > 0) {
          const venueName = await getVenueName(hire.venueId);
          const hireDateLabel = hireDate
            ? hireDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
            : null;

          for (const applicant of pendingApplicants) {
            const applicantIsGuest = applicant?.guest === true || applicant?.type === "guest";
            const email = applicantIsGuest ? (applicant.email || null) : await getArtistEmail(applicant.id);
            if (!email) continue;
            await sendExpiryEmail({
              recipientEmail: email,
              gigName: "Venue Hire",
              venueName,
              gigDateLabel: hireDateLabel,
              gigId: hireDoc.id,
            });
            notificationsSent++;
          }
        }
      }

      lastHireDoc = snap.docs[snap.docs.length - 1];
      if (snap.size < PAGE_SIZE) break;
    }

    console.log(
      `expireUnbookedGigs done. Gigs expired: ${gigsExpired}, hires expired: ${hiresExpired}, notifications sent: ${notificationsSent}.`
    );
  }
);

// ── Helpers ─────────────────────────────────────────────────────────────────

async function getArtistEmail(artistId) {
  if (!artistId) return null;
  try {
    // Try artistProfiles first (new model), then musicianProfiles (legacy)
    for (const coll of ["artistProfiles", "musicianProfiles"]) {
      const snap = await db.doc(`${coll}/${artistId}`).get();
      if (!snap.exists) continue;
      const data = snap.data() || {};
      const userId = data.userId || data.createdBy || null;
      if (!userId) continue;
      const userSnap = await db.doc(`users/${userId}`).get();
      if (!userSnap.exists) continue;
      const userEmail = userSnap.data()?.email;
      if (userEmail) return userEmail;
    }
  } catch (err) {
    console.error(`getArtistEmail error for ${artistId}:`, err);
  }
  return null;
}

async function getVenueName(venueId) {
  if (!venueId) return null;
  try {
    const snap = await db.doc(`venueProfiles/${venueId}`).get();
    return snap.exists ? (snap.data()?.venueName ?? null) : null;
  } catch (_) {
    return null;
  }
}

async function sendExpiryEmail({ recipientEmail, gigName, venueName, gigDateLabel, gigId }) {
  const dashboardUrl = `${BASE_URL}/dashboard`;
  const venueLabel = venueName ? ` at ${venueName}` : "";
  const dateLabel = gigDateLabel ? ` on ${gigDateLabel}` : "";
  const subject = `Your application for "${gigName}"${venueLabel} — gig passed unbooked`;
  const text = `Hi,\n\nThe gig "${gigName}"${venueLabel}${dateLabel} has passed and was left unbooked. Your application was not accepted.\n\nYou can find new opportunities on your dashboard: ${dashboardUrl}`;

  const baseStyles = {
    bodyBg: "#f9f9f9",
    cardBg: "#ffffff",
    text: "#333333",
    muted: "#6b7280",
    accent: "#111827",
    border: "#e5e7eb",
    btnBg: "#111827",
    btnText: "#ffffff",
  };
  const logoUrl =
    "https://firebasestorage.googleapis.com/v0/b/giginltd-dev.firebasestorage.app/o/gigin.png?alt=media&token=efd9ba79-f580-454c-98f6-b4a391e0d636";

  const html = `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="background:${baseStyles.bodyBg};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:${baseStyles.cardBg};border:1px solid ${baseStyles.border};border-radius:16px;">
            <tr>
              <td style="padding:28px 28px 0 28px;" align="center">
                <img src="${logoUrl}" width="120" height="36" alt="gigin." style="display:block;border:0;max-width:100%;height:auto;">
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 0 28px;" align="center">
                <h1 style="margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:20px;line-height:28px;color:${baseStyles.accent};font-weight:700;">
                  This gig has passed and was left unbooked
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 0 28px;">
                <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
                  The gig <strong>${gigName}</strong>${venueLabel}${dateLabel} has now passed without a booking being made.
                  Your application was not accepted.
                </p>
                <p style="margin:0 0 16px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
                  Head back to your dashboard to find new opportunities.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 28px 28px;" align="center">
                <a href="${dashboardUrl}" style="display:inline-block;background:${baseStyles.btnBg};color:${baseStyles.btnText};text-decoration:none;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;padding:12px 18px;border-radius:10px;">
                  Find New Gigs
                </a>
              </td>
            </tr>
          </table>
          <div style="max-width:600px;margin-top:16px;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;color:${baseStyles.muted};">
            You're receiving this because you applied to a gig on Gigin.
          </div>
        </td>
      </tr>
    </table>
  `;

  if (typeof recipientEmail !== "string" || !recipientEmail.includes("@")) {
    console.warn("Skipped mail document: missing to address");
    return;
  }
  await db.collection("mail").add({
    to: recipientEmail,
    message: { subject, text, html },
  });
}
