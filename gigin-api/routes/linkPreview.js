/* eslint-disable */
import express from "express";
import rateLimit from "express-rate-limit";
import { db } from "../config/admin.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = express.Router();
const APP_ORIGIN = process.env.PUBLIC_APP_URL || "http://localhost:5173";

const previewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function gigWhen(gig) {
  const raw = gig?.startDateTime || gig?.date;
  if (!raw) return "";
  const date = typeof raw.toDate === "function"
    ? raw.toDate()
    : new Date((raw._seconds || raw.seconds || 0) * 1000 || raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

router.get("/gig/:gigId", previewLimiter, asyncHandler(async (req, res) => {
  const snap = await db.doc(`gigs/${req.params.gigId}`).get();
  if (!snap.exists) return res.status(404).type("html").send("<!doctype html><title>Gig</title><p>This gig is not available.</p>");
  const gig = snap.data() || {};
  const venueSnap = gig.venueId ? await db.doc(`venueProfiles/${gig.venueId}`).get() : null;
  const venue = venueSnap?.exists ? venueSnap.data() || {} : {};
  const title = String(gig.gigName || "Gig on Gigin").replace(/\s*\(Set\s+\d+\)\s*$/, "");
  const venueName = venue.name || venue.venueName || gig.venue?.venueName || "Gigin";
  const when = gigWhen(gig);
  const description = [when, venueName].filter(Boolean).join(" · ");
  const image = venue.photoUrl || venue.picture || venue.heroImage || gig.imageUrl || "";
  const invite = typeof req.query.inviteId === "string" ? req.query.inviteId : "";
  const pageUrl = `${APP_ORIGIN}/gig/${encodeURIComponent(req.params.gigId)}${invite ? `?inviteId=${encodeURIComponent(invite)}` : ""}`;
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
${image ? `<meta property="og:image" content="${escapeHtml(image)}">` : ""}
<meta property="og:url" content="${escapeHtml(pageUrl)}">
<meta http-equiv="refresh" content="0; url=${escapeHtml(pageUrl)}">
<link rel="canonical" href="${escapeHtml(pageUrl)}">
</head>
<body>
<p><a href="${escapeHtml(pageUrl)}">${escapeHtml(title)}</a> · ${escapeHtml(description)}</p>
</body>
</html>`;
  res.setHeader("Cache-Control", "public, max-age=300");
  res.type("html").send(html);
}));

export default router;
