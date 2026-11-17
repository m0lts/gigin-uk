function line(label, value) {
  return `${label}: ${value || ""}`;
}

export function acceptedPromoEmail({ actName, venueName, gigName, when, setLabel, place }) {
  return {
    subject: `You're playing ${gigName}`,
    text: [
      `Hi ${actName}, ${venueName} has booked you. Here are the details.`,
      line("Date", when),
      line("Set", setLabel),
      line("Venue", place || venueName),
      `Next: send your promo. ${venueName} needs a bio, a photo and audio or video to promote your set. It takes about five minutes.`,
    ].join("\n"),
    button: "Send my promo",
  };
}

export function promoRequestEmail({ actName, venueName, when, missing, hasBio }) {
  const still = (missing || []).join("\n");
  return {
    subject: `${venueName} is waiting on your promo`,
    text: [
      `Hi ${actName}, your gig is on ${when}. ${venueName} still needs:`,
      still,
      hasBio ? "Your bio is already in, so this should only take a minute." : "",
    ].filter(Boolean).join("\n"),
    button: "Add my promo",
  };
}

export function bookingEnquiryEmail({ venueName, bookerName, when, fee, message, onGigin }) {
  const from = [bookerName, venueName].filter(Boolean).join(", ");
  return {
    subject: `New booking enquiry from ${venueName}`,
    text: [
      "Someone found your Gigin profile and wants to book you.",
      line("From", from),
      line("Date", when),
      line("Fee", fee || "Not given"),
      message ? `"${message}"` : "",
      "Reply to this email to answer them directly.",
      onGigin ? "" : `${venueName} is not on Gigin yet.`,
    ].filter(Boolean).join("\n"),
    button: "See it in Gigin",
  };
}

export function photosReadyEmail({ actName, venueName, gigName, when }) {
  return {
    subject: `Photos from ${gigName}`,
    text: `Hi ${actName}, ${venueName} has shared photos and video from ${when}. Download what you like and use it for your own promo.`,
    button: "View and download",
  };
}

export function promoReceivedEmail({ actName, gigName, when, done, total, photos, tracks, consent }) {
  return {
    subject: `${actName} sent their promo`,
    text: [
      `Promo for ${gigName}, ${when}, is now ${done} of ${total} acts complete.`,
      line("Bio", "Received"),
      line("Photos", String(photos || 0)),
      line("Audio", tracks ? `${tracks} track` : "None"),
      line("Consent", consent ? "Given" : "Not given"),
    ].join("\n"),
    button: "Open the gig",
  };
}

export function promoUpdatedEmail({ actName, gigName, when, done, total, photos, tracks, consent }) {
  const received = promoReceivedEmail({ actName, gigName, when, done, total, photos, tracks, consent });
  return {
    ...received,
    subject: `${actName} updated their promo`,
  };
}

const PROMO_UPDATE_GAP_MS = 60 * 60 * 1000;
const BOOKED_FOR_PROMO = new Set(["accepted", "confirmed", "paid"]);

/** How many booked acts have sent promo. Sets on the night are not counted. */
export function promoProgress({ applications, applicantId, promo }) {
  const seen = new Set();
  let total = 0;
  let done = 0;
  const currentId = applicantId == null ? "" : String(applicantId);
  for (const act of Array.isArray(applications) ? applications : []) {
    const id = act?.id == null ? "" : String(act.id);
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    if (!BOOKED_FOR_PROMO.has(String(act?.status || "").toLowerCase())) continue;
    total += 1;
    const saved = id && id === currentId ? (promo || act?.promo) : act?.promo;
    if (saved?.submittedAt) done += 1;
  }
  if (!total && promo?.submittedAt) return { done: 1, total: 1 };
  return { done, total: Math.max(total, 1) };
}

export function promoNotifyPlan({ alreadySubmitted, lastUpdatedAt, now = Date.now() }) {
  if (!alreadySubmitted) return "received";
  const last = Date.parse(lastUpdatedAt || "");
  if (!Number.isFinite(last) || now - last >= PROMO_UPDATE_GAP_MS) return "updated";
  return "skip";
}
