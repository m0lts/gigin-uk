/* eslint-disable */
import express from "express";
import { v4 as uuidv4 } from "uuid";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { db, Timestamp } from "../config/admin.js";
import { assertVenuePerm } from "../utils/permissions.js";

const router = express.Router();

const CALENDAR_TOKENS_COLLECTION = "calendarFeedTokens";

function toAdminTimestamp(input) {
  try {
    if (!input) return null;
    if (input instanceof Date) return Timestamp.fromDate(input);
    if (typeof input === "number") return Timestamp.fromDate(new Date(input));
    if (typeof input === "string") return Timestamp.fromDate(new Date(input));
    if (typeof input === "object") {
      const seconds = input.seconds ?? input._seconds;
      const nanoseconds = input.nanoseconds ?? input._nanoseconds;
      if (typeof seconds === "number" && typeof nanoseconds === "number") {
        return new Timestamp(seconds, nanoseconds);
      }
      if (typeof input.toDate === "function") {
        return Timestamp.fromDate(input.toDate());
      }
    }
  } catch (_) {
    // ignore
  }
  return null;
}

/**
 * Escape a string for use in iCal (replace \ with \\, ; with \;, , with \,)
 */
function escapeIcalString(str) {
  if (str == null || typeof str !== "string") return "";
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/**
 * Format a Date as iCal UTC: YYYYMMDDTHHmmssZ
 */
function formatIcalUtc(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  const s = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${day}T${h}${min}${s}Z`;
}

/**
 * Get a JS Date for the gig's start. Uses startDateTime, or builds from date + startTime.
 */
function getGigStartDate(gig) {
  const startTs = toAdminTimestamp(gig.startDateTime);
  if (startTs) return startTs.toDate();
  const dateTs = toAdminTimestamp(gig.date);
  const timeStr = gig.startTime || "20:00";
  if (!dateTs) return null;
  const d = dateTs.toDate();
  const [hours, minutes] = String(timeStr).split(":").map(Number);
  if (Number.isFinite(hours)) d.setHours(hours);
  if (Number.isFinite(minutes)) d.setMinutes(minutes);
  d.setSeconds(0, 0);
  return d;
}

/**
 * Build iCalendar (ICS) body for a list of gigs.
 * Includes all gigs for the venue(s) – confirmed, unbooked, past, and future.
 */
function buildIcs(gigs, calendarName = "Gigin Gigs") {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Gigin//Gigs//EN",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:" + escapeIcalString(calendarName),
  ];

  for (const gig of gigs) {
    const startDate = getGigStartDate(gig);
    if (!startDate || isNaN(startDate.getTime())) continue;
    const durationMinutes = typeof gig.duration === "number" ? gig.duration : 60;
    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
    const uid = `gig-${gig.id || gig.gigId || startDate.getTime()}@gigin`;
    const summary = gig.gigName || "Gig";
    const description = [gig.venue?.venueName, gig.kind].filter(Boolean).join(" • ") || undefined;

    lines.push("BEGIN:VEVENT");
    lines.push("UID:" + uid);
    lines.push("DTSTAMP:" + formatIcalUtc(new Date()));
    lines.push("DTSTART:" + formatIcalUtc(startDate));
    lines.push("DTEND:" + formatIcalUtc(endDate));
    lines.push("SUMMARY:" + escapeIcalString(summary));
    if (description) lines.push("DESCRIPTION:" + escapeIcalString(description));
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

// POST /api/calendar/feed-token — create or get a calendar feed token (auth required)
router.post("/feed-token", requireAuth, asyncHandler(async (req, res) => {
  const caller = req.auth.uid;
  const { venueIds } = req.body || {};
  if (!Array.isArray(venueIds) || venueIds.length === 0) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "venueIds array is required" });
  }
  const uniqueVenueIds = [...new Set(venueIds)].filter(Boolean);
  if (uniqueVenueIds.length === 0) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "At least one venueId is required" });
  }

  for (const venueId of uniqueVenueIds) {
    await assertVenuePerm(db, caller, venueId, "gigs.read");
  }

  const tokensRef = db.collection(CALENDAR_TOKENS_COLLECTION);
  const existing = await tokensRef.where("userId", "==", caller).get();
  let tokenId = null;
  existing.docs.forEach((doc) => {
    const data = doc.data() || {};
    const sameVenues =
      Array.isArray(data.venueIds) &&
      data.venueIds.length === uniqueVenueIds.length &&
      data.venueIds.every((id) => uniqueVenueIds.includes(id));
    if (sameVenues) tokenId = doc.id;
  });

  if (!tokenId) {
    tokenId = uuidv4();
    await tokensRef.doc(tokenId).set({
      userId: caller,
      venueIds: uniqueVenueIds,
      createdAt: Timestamp.fromDate(new Date()),
    });
  }

  const baseUrl = (process.env.API_BASE_URL || process.env.ALLOWED_ORIGIN || "https://api.giginmusic.com").replace(/\/$/, "");
  const feedPath = `/api/calendar/feed.ics?token=${tokenId}`;
  const feedUrl = baseUrl.startsWith("http") ? `${baseUrl}${feedPath}` : `https://${baseUrl}${feedPath}`;

  return res.json({
    data: {
      token: tokenId,
      feedUrl,
      venueIds: uniqueVenueIds,
    },
  });
}));

// GET /api/calendar/feed.ics — public iCal feed (no auth; token in query)
router.get("/feed.ics", asyncHandler(async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token.trim() : null;
  if (!token) {
    res.status(400).set("Content-Type", "text/plain");
    return res.send("Missing token parameter.");
  }

  const tokenRef = db.collection(CALENDAR_TOKENS_COLLECTION).doc(token);
  const tokenSnap = await tokenRef.get();
  if (!tokenSnap.exists) {
    res.status(404).set("Content-Type", "text/plain");
    return res.send("Invalid or expired calendar link.");
  }

  const { venueIds } = tokenSnap.data() || {};
  if (!Array.isArray(venueIds) || venueIds.length === 0) {
    res.status(404).set("Content-Type", "text/plain");
    return res.send("Invalid calendar feed.");
  }

  const gigsRef = db.collection("gigs");
  const allDocs = [];
  const chunkSize = 10;
  for (let i = 0; i < venueIds.length; i += chunkSize) {
    const chunk = venueIds.slice(i, i + chunkSize);
    const snapshot = await gigsRef.where("venueId", "in", chunk).get();
    snapshot.docs.forEach((d) => allDocs.push(d));
  }

  const gigs = allDocs.map((doc) => {
    const d = doc.data() || {};
    return {
      id: doc.id,
      gigId: doc.id,
      ...d,
    };
  });

  gigs.sort((a, b) => {
    const ta = toAdminTimestamp(a.startDateTime)?.toMillis?.() ?? 0;
    const tb = toAdminTimestamp(b.startDateTime)?.toMillis?.() ?? 0;
    return ta - tb;
  });

  const ics = buildIcs(gigs);
  res.set({
    "Content-Type": "text/calendar; charset=utf-8",
    "Cache-Control": "private, max-age=300",
  });
  return res.send(ics);
}));

export default router;
