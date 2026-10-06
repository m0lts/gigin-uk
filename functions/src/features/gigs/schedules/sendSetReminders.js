/* eslint-disable */
import { schedule } from "../../../lib/schedule.js";
import { db, FieldValue, Timestamp } from "../../../lib/admin.js";
import { icsAttachment, icsEvent, renderArtistEmail } from "../../../shared/artistEmails.js";

const FROM = "Gigin <noreply@giginmusic.com>";
const ORIGIN = process.env.BASE_URL || "https://giginmusic.com";

function londonKey(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function tomorrowKey() {
  return londonKey(new Date(Date.now() + 24 * 60 * 60 * 1000));
}

function asDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value._seconds || value.seconds) return new Date((value._seconds || value.seconds) * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function clock(slot, end = false) {
  const day = asDate(slot.startDateTime || slot.date);
  if (!day || !slot.startTime) return null;
  const [hours, minutes] = String(slot.startTime).split(":").map(Number);
  if (!Number.isFinite(hours)) return null;
  const start = new Date(day);
  start.setHours(hours, minutes || 0, 0, 0);
  if (!end) return start;
  return new Date(start.getTime() + (Number(slot.duration) || 60) * 60000);
}

function range(slot) {
  const start = clock(slot, false);
  const finish = clock(slot, true);
  if (!start) return "";
  const fmt = (date) => date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/London" });
  return finish ? `${fmt(start)}–${fmt(finish)}` : fmt(start);
}

export async function sendDueSetReminders() {
  const start = Timestamp.fromDate(new Date(Date.now() - 6 * 60 * 60 * 1000));
  const end = Timestamp.fromDate(new Date(Date.now() + 48 * 60 * 60 * 1000));
  const snap = await db.collection("gigs").where("startDateTime", ">=", start).where("startDateTime", "<", end).get();
  const target = tomorrowKey();
  let sent = 0;
  for (const doc of snap.docs) {
    const gig = { gigId: doc.id, ...(doc.data() || {}) };
    const when = asDate(gig.startDateTime || gig.date);
    if (!when || londonKey(when) !== target) continue;
    if (gig.status === "cancelled") continue;
    const applicants = Array.isArray(gig.applicants) ? gig.applicants : [];
    const venueName = gig.venue?.venueName || gig.venueName || "the venue";
    const gigName = String(gig.gigName || "your gig").replace(/\s*\(Set\s+\d+\)\s*$/, "");
    const day = when.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" });
    const address = [gig.venue?.address?.line1, gig.venue?.address?.city].filter(Boolean).join(", ");
    for (const applicant of applicants) {
      const status = String(applicant?.status || "").toLowerCase();
      if (!["accepted", "confirmed", "paid"].includes(status)) continue;
      if (!applicant?.assignedSlotGigId && !(gig.gigSlots || []).length) continue;
      const privateRef = db.doc(`gigs/${gig.applicationsRootGigId || gig.gigId}/guestApplicants/${applicant.id}`);
      const privSnap = await privateRef.get();
      const priv = privSnap.exists ? privSnap.data() || {} : {};
      if (priv.reminderSentAt) continue;
      const email = String(priv.email || applicant.email || "").trim().toLowerCase();
      if (!email.includes("@")) continue;
      const slotId = applicant.assignedSlotGigId || gig.gigId;
      const slotSnap = slotId === gig.gigId ? doc : await db.doc(`gigs/${slotId}`).get();
      const slot = slotSnap.exists ? { ...(slotSnap.data() || {}), startDateTime: slotSnap.data()?.startDateTime || gig.startDateTime } : gig;
      const setIndex = Array.isArray(gig.gigSlots) ? gig.gigSlots.indexOf(slotId) : 0;
      const setLabel = setIndex >= 0 ? `Set ${setIndex + 1}` : "Set 1";
      const setRange = range({ ...gig, ...slot, startDateTime: gig.startDateTime });
      const minutes = slot.duration || gig.duration;
      const doors = gig.timingAccessTime || gig.doors || "";
      const first = String(priv.contactName || applicant.name || "there").split(/\s+/)[0];
      const act = applicant.name || priv.actName || "your act";
      const manage = priv.manageToken ? `${ORIGIN}/gig/${gig.gigId}/application/${priv.manageToken}` : `${ORIGIN}/gig/${gig.gigId}`;
      const message = renderArtistEmail({
        subject: `Tomorrow: you're playing ${setLabel} at ${venueName}`,
        preheader: `${setLabel}, ${setRange}.${doors ? ` Doors ${doors}.` : ""}`,
        eyebrow: "TOMORROW",
        heading: "You're playing tomorrow",
        paras: [`Hi ${first},`, `A reminder that ${act} is playing <b>${setLabel}, ${setRange}</b> at ${venueName} on ${day}.`],
        boxes: [{
          label: "YOUR SET",
          green: true,
          rows: [
            ["Set", `${setLabel} · ${setRange}${minutes ? ` (${minutes} minutes)` : ""}`],
            doors ? ["Doors", doors] : null,
            address ? ["Where", address] : null,
          ].filter(Boolean),
        }],
        pre: "Can't make it? Let the venue know now from your private link, so the set can go to someone else.",
        button: ["View your booking", manage],
        footer: "You're getting this because you applied to a gig on giginmusic.com.",
      });
      const ics = icsEvent({
        uid: `gigin-${gig.applicationsRootGigId || gig.gigId}-${applicant.id}@giginmusic.com`,
        sequence: Number(priv.calendarSequence) || 0,
        summary: `${act} at ${venueName}`,
        start: clock({ ...slot, startDateTime: gig.startDateTime }, false),
        end: clock({ ...slot, startDateTime: gig.startDateTime, duration: minutes }, true),
        location: address,
        description: `${setLabel} ${setRange}`.trim(),
      });
      message.attachments = icsAttachment(ics);
      await db.collection("mail").add({ to: email, from: FROM, message });
      await privateRef.set({ reminderSentAt: FieldValue.serverTimestamp() }, { merge: true });
      sent += 1;
    }
  }
  return { sent };
}

/** 10:00 Europe/London, the day before a booked set. */
export const sendSetReminders = schedule(
  {
    schedule: "0 10 * * *",
    timeZone: "Europe/London",
    timeoutSeconds: 300,
    memory: "256MiB",
  },
  async () => {
    const result = await sendDueSetReminders();
    console.log("set reminders", result);
  },
);
