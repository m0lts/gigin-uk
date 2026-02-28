/* eslint-disable */
import express from "express";
import bcrypt from "bcrypt";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { admin, db, FieldValue, Timestamp } from "../config/admin.js";

const ADMIN_EMAIL = "hq.gigin@gmail.com";
const DEFAULT_ADMIN_PASSWORD = "1234567Aa";
const ADMIN_SETTINGS_DOC = "credentials";
const SALT_ROUNDS = 10;

const router = express.Router();

function requireAdminEmail(req, res, next) {
  if (!req.auth || req.auth.email !== ADMIN_EMAIL) {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "Admin access is restricted to the designated account.",
    });
  }
  next();
}

async function getOrCreateAdminPasswordHash() {
  const ref = db.collection("adminSettings").doc(ADMIN_SETTINGS_DOC);
  const snap = await ref.get();
  if (snap.exists) {
    const data = snap.data() || {};
    return data.passwordHash || null;
  }
  const hash = bcrypt.hashSync(DEFAULT_ADMIN_PASSWORD, SALT_ROUNDS);
  await ref.set({ passwordHash: hash, updatedAt: FieldValue.serverTimestamp() });
  return hash;
}

// POST /api/admin/verifyPassword — verify admin password (must be logged in as ADMIN_EMAIL)
router.post(
  "/verifyPassword",
  requireAuth,
  requireAdminEmail,
  asyncHandler(async (req, res) => {
    const { password } = req.body || {};
    if (!password || typeof password !== "string") {
      return res.status(400).json({
        error: "INVALID_ARGUMENT",
        message: "password is required",
      });
    }
    const hash = await getOrCreateAdminPasswordHash();
    const valid = bcrypt.compareSync(password, hash);
    if (!valid) {
      return res.status(401).json({
        error: "UNAUTHENTICATED",
        message: "Invalid admin password",
      });
    }
    return res.json({ data: { success: true } });
  })
);

// GET /api/admin/signups — recent user signups (Firebase Auth metadata)
router.get(
  "/signups",
  requireAuth,
  requireAdminEmail,
  asyncHandler(async (req, res) => {
    const listResult = await admin.auth().listUsers(200);
    const signups = listResult.users.map((u) => ({
      uid: u.uid,
      email: u.email || null,
      createdAt: u.metadata.creationTime || null,
    }));
    signups.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
    return res.json({ data: { signups: signups.slice(0, 100) } });
  })
);

// GET /api/admin/activity — recent audit activity only
router.get(
  "/activity",
  requireAuth,
  requireAdminEmail,
  asyncHandler(async (req, res) => {
    const auditLimit = 100;
    const auditSnap = await db
      .collection("auditLogs")
      .orderBy("at", "desc")
      .limit(auditLimit)
      .get();

    const recentActivity = auditSnap.docs.map((doc) => {
      const d = doc.data() || {};
      const at = d.at;
      const atMs =
        at && (at.toMillis || at.toDate)
          ? at.toMillis
            ? at.toMillis()
            : at.toDate().getTime()
          : null;
      return {
        id: doc.id,
        type: d.type || null,
        ...d,
        at: atMs ? new Date(atMs).toISOString() : null,
      };
    });

    return res.json({ data: { recentActivity } });
  })
);

// Build monthly buckets for last 12 months (keys YYYY-MM, count 0)
function emptyMonthly() {
  const out = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, count: 0 });
  }
  return out;
}
function bucketByMonth(items, getTimestamp) {
  const monthly = emptyMonthly();
  const byMonth = new Map(monthly.map(({ month }) => [month, { month, count: 0 }]));
  items.forEach((item) => {
    const ms = getTimestamp(item);
    if (ms == null) return;
    const d = new Date(ms);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const entry = byMonth.get(monthStr);
    if (entry) entry.count += 1;
  });
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

// Build daily buckets for last 30 days (for "monthly" chart view)
function emptyDaily() {
  const out = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push({ date: dateStr, count: 0 });
  }
  return out;
}
function bucketByDay(items, getTimestamp) {
  const daily = emptyDaily();
  const byDate = new Map(daily.map(({ date }) => [date, { date, count: 0 }]));
  items.forEach((item) => {
    const ms = getTimestamp(item);
    if (ms == null) return;
    const d = new Date(ms);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const entry = byDate.get(dateStr);
    if (entry) entry.count += 1;
  });
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

const MS_WEEK = 7 * 24 * 60 * 60 * 1000;
const MS_MONTH = 30 * 24 * 60 * 60 * 1000;

// GET /api/admin/overview — stats for dashboard overview (this week, this month, overall + monthly for charts)
router.get(
  "/overview",
  requireAuth,
  requireAdminEmail,
  asyncHandler(async (req, res) => {
    const now = Date.now();
    const weekAgo = now - MS_WEEK;
    const monthAgo = now - MS_MONTH;

    // 1) Account signups (Firebase Auth)
    let accountSignups = { thisWeek: 0, thisMonth: 0, overall: 0, daily: emptyDaily() };
    try {
      const userList = await admin.auth().listUsers(1000);
      const users = userList.users;
      accountSignups.overall = users.length;
      users.forEach((u) => {
        const t = u.metadata?.creationTime ? new Date(u.metadata.creationTime).getTime() : 0;
        if (t >= weekAgo) accountSignups.thisWeek += 1;
        if (t >= monthAgo) accountSignups.thisMonth += 1;
      });
      accountSignups.daily = bucketByDay(users, (u) =>
        u.metadata?.creationTime ? new Date(u.metadata.creationTime).getTime() : null
      );
    } catch (e) {
      console.warn("admin overview account signups:", e.message);
    }

    // 2) Gigs + hire opportunities posted (query recent, then filter to past year for chart)
    let gigsAndHire = { thisWeek: 0, thisMonth: 0, overall: 0, daily: emptyDaily() };
    try {
      const [gigsSnap, hireSnap] = await Promise.all([
        db.collection("gigs").orderBy("createdAt", "desc").limit(2000).get(),
        db.collection("venueHireOpportunities").orderBy("createdAt", "desc").limit(1000).get(),
      ]);
      const gigTimestamps = gigsSnap.docs.map((doc) => {
        const t = doc.data()?.createdAt;
        return t && (t.toMillis || t.toDate) ? (t.toMillis ? t.toMillis() : t.toDate().getTime()) : null;
      });
      const hireTimestamps = hireSnap.docs.map((doc) => {
        const t = doc.data()?.createdAt;
        return t && (t.toMillis || t.toDate) ? (t.toMillis ? t.toMillis() : t.toDate().getTime()) : null;
      });
      const allTimestamps = [...gigTimestamps, ...hireTimestamps].filter(Boolean);
      gigsAndHire.thisWeek = allTimestamps.filter((t) => t >= weekAgo).length;
      gigsAndHire.thisMonth = allTimestamps.filter((t) => t >= monthAgo).length;
      gigsAndHire.overall = gigsSnap.size + hireSnap.size;
      gigsAndHire.daily = bucketByDay(allTimestamps, (ms) => ms);
    } catch (e) {
      console.warn("admin overview gigs/hire:", e.message);
    }

    // 3) Venue signups (venueProfiles)
    let venueSignups = { thisWeek: 0, thisMonth: 0, overall: 0, daily: emptyDaily() };
    try {
      const venueSnap = await db.collection("venueProfiles").get();
      venueSignups.overall = venueSnap.size;
      const venueTimestamps = venueSnap.docs.map((doc) => {
        const t = doc.data()?.createdAt;
        return t && (t.toMillis || t.toDate) ? (t.toMillis ? t.toMillis() : t.toDate().getTime()) : null;
      });
      venueSignups.thisWeek = venueTimestamps.filter((t) => t && t >= weekAgo).length;
      venueSignups.thisMonth = venueTimestamps.filter((t) => t && t >= monthAgo).length;
      venueSignups.daily = bucketByDay(venueTimestamps, (ms) => ms);
    } catch (e) {
      console.warn("admin overview venues:", e.message);
    }

    // 4) Artist signups (artistProfiles)
    let artistSignups = { thisWeek: 0, thisMonth: 0, overall: 0, daily: emptyDaily() };
    try {
      const artistSnap = await db.collection("artistProfiles").limit(1000).get();
      artistSignups.overall = artistSnap.size;
      const artistTimestamps = artistSnap.docs.map((doc) => {
        const t = doc.data()?.createdAt;
        return t && (t.toMillis || t.toDate) ? (t.toMillis ? t.toMillis() : t.toDate().getTime()) : null;
      });
      artistSignups.thisWeek = artistTimestamps.filter((t) => t && t >= weekAgo).length;
      artistSignups.thisMonth = artistTimestamps.filter((t) => t && t >= monthAgo).length;
      artistSignups.daily = bucketByDay(artistTimestamps, (ms) => ms);
    } catch (e) {
      console.warn("admin overview artists:", e.message);
    }

    return res.json({
      data: {
        accountSignups,
        gigsAndHire,
        venueSignups,
        artistSignups,
      },
    });
  })
);

function toIso(ts) {
  if (!ts) return null;
  try {
    if (ts && typeof ts.toMillis === "function") return new Date(ts.toMillis()).toISOString();
    if (ts && typeof ts.toDate === "function") return ts.toDate().toISOString();
    if (typeof ts === "number") return new Date(ts).toISOString();
    if (typeof ts === "string") return new Date(ts).toISOString();
  } catch (_) {}
  return null;
}

function serializeApplicant(a) {
  if (!a || typeof a !== "object") return a;
  const out = { ...a };
  if (a.timestamp) {
    const t = a.timestamp;
    out.timestamp = t && (t.toMillis || t.toDate) ? (t.toMillis ? new Date(t.toMillis()).toISOString() : t.toDate().toISOString()) : t;
  }
  return out;
}

// GET /api/admin/gigs — all gigs, newest first (full details for expand), with venue name
router.get(
  "/gigs",
  requireAuth,
  requireAdminEmail,
  asyncHandler(async (req, res) => {
    const limit = 500;
    const snap = await db
      .collection("gigs")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    const venueIds = new Set();
    const gigs = snap.docs.map((doc) => {
      const d = doc.data() || {};
      const venueId = d.venueId || null;
      if (venueId) venueIds.add(venueId);
      return {
        gigId: doc.id,
        venueId,
        title: d.title || d.name || null,
        kind: d.kind || null,
        budget: d.budget ?? null,
        status: d.status || null,
        paid: d.paid ?? null,
        agreedFee: d.agreedFee ?? null,
        date: toIso(d.date),
        startDateTime: toIso(d.startDateTime),
        createdAt: toIso(d.createdAt),
        updatedAt: toIso(d.updatedAt),
        applicants: (d.applicants || []).map(serializeApplicant),
        private: d.private ?? null,
        payoutConfig: d.payoutConfig || null,
      };
    });

    const venueNameById = {};
    if (venueIds.size > 0) {
      const venueSnaps = await Promise.all(
        [...venueIds].map((id) => db.collection("venueProfiles").doc(id).get())
      );
      [...venueIds].forEach((id, i) => {
        const v = venueSnaps[i].exists ? venueSnaps[i].data() : {};
        venueNameById[id] = v.name || v.venueName || v.accountName || id;
      });
    }
    gigs.forEach((g) => {
      g.venue = g.venueId
        ? { venueId: g.venueId, venueName: venueNameById[g.venueId] || g.venueId }
        : null;
    });

    return res.json({ data: { gigs } });
  })
);

// GET /api/admin/spaceHire — all venue hire opportunities, newest first
const VENUE_HIRE_COLLECTION = "venueHireOpportunities";
router.get(
  "/spaceHire",
  requireAuth,
  requireAdminEmail,
  asyncHandler(async (req, res) => {
    const snap = await db
      .collection(VENUE_HIRE_COLLECTION)
      .orderBy("createdAt", "desc")
      .limit(500)
      .get();

    const items = snap.docs.map((doc) => {
      const d = doc.data() || {};
      return {
        id: doc.id,
        venueId: d.venueId || null,
        createdByUserId: d.createdByUserId ?? d.createdBy ?? null,
        status: d.status ?? null,
        date: toIso(d.date),
        startTime: d.startTime ?? null,
        endTime: d.endTime ?? null,
        startDateTime: toIso(d.startDateTime),
        endDateTime: toIso(d.endDateTime),
        accessFrom: d.accessFrom ?? null,
        curfew: d.curfew ?? null,
        hireFee: d.hireFee ?? null,
        depositRequired: d.depositRequired ?? null,
        depositAmount: d.depositAmount ?? null,
        depositPaid: d.depositPaid ?? null,
        technicalSetup: d.technicalSetup || null,
        documents: d.documents || [],
        notesInternal: d.notesInternal ?? null,
        hirerType: d.hirerType ?? null,
        hirerContactId: d.hirerContactId ?? null,
        hirerUserId: d.hirerUserId ?? null,
        hirerName: d.hirerName ?? null,
        performers: d.performers || [],
        private: d.private ?? null,
        linkedGigId: d.linkedGigId ?? null,
        createdAt: toIso(d.createdAt),
        updatedAt: toIso(d.updatedAt),
      };
    });

    return res.json({ data: { items } });
  })
);

// GET /api/admin/venues — all venue profiles
router.get(
  "/venues",
  requireAuth,
  requireAdminEmail,
  asyncHandler(async (req, res) => {
    const snap = await db.collection("venueProfiles").limit(500).get();

    const venues = snap.docs.map((doc) => {
      const d = doc.data() || {};
      const gigs = d.gigs || [];
      return {
        id: doc.id,
        venueName: d.name || d.venueName || d.accountName || null,
        createdBy: d.createdBy ?? d.userId ?? null,
        gigs: Array.isArray(gigs) ? gigs : [],
        gigCount: Array.isArray(gigs) ? gigs.length : 0,
        createdAt: toIso(d.createdAt),
        updatedAt: toIso(d.updatedAt),
        stripeCustomerId: d.stripeCustomerId ?? null,
      };
    });
    venues.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });

    return res.json({ data: { venues } });
  })
);

// GET /api/admin/artists — all artist profiles
router.get(
  "/artists",
  requireAuth,
  requireAdminEmail,
  asyncHandler(async (req, res) => {
    const snap = await db.collection("artistProfiles").limit(500).get();

    const artists = snap.docs.map((doc) => {
      const d = doc.data() || {};
      return {
        id: doc.id,
        name: d.name || null,
        userId: d.userId ?? d.createdBy ?? null,
        createdAt: toIso(d.createdAt),
        updatedAt: toIso(d.updatedAt),
        genres: d.genres || [],
        location: d.location ?? null,
      };
    });
    artists.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });

    return res.json({ data: { artists } });
  })
);

// Categorise client error by message for admin view
function errorCategory(message) {
  if (!message || typeof message !== "string") return "Other";
  const m = message.toLowerCase();
  if (m.includes("auth/") || m.includes("firebase: error (auth")) return "Auth / Firebase";
  if (m.includes("timeout")) return "Timeout";
  if (m.includes("indexed database") || m.includes("indexeddb")) return "IndexedDB";
  if (m.includes("network") || m.includes("network-request-failed")) return "Network";
  if (m.includes("permission") || m.includes("permission_denied")) return "Permission";
  return "Other";
}

const CLIENT_ERRORS_COLLECTION = "clientErrors";

// GET /api/admin/errors — list client errors, newest first, with category
router.get(
  "/errors",
  requireAuth,
  requireAdminEmail,
  asyncHandler(async (req, res) => {
    const limit = 500;
    const snap = await db
      .collection(CLIENT_ERRORS_COLLECTION)
      .orderBy("ts", "desc")
      .limit(limit)
      .get();

    const errors = snap.docs.map((doc) => {
      const d = doc.data() || {};
      const message = d.message || "";
      return {
        id: doc.id,
        message,
        category: errorCategory(message),
        path: d.path ?? null,
        stack: d.stack ?? null,
        extra: d.extra ?? null,
        userAgent: d.userAgent ?? null,
        ts: toIso(d.ts),
      };
    });

    return res.json({ data: { errors } });
  })
);

// DELETE /api/admin/errors — delete one or many client errors
router.delete(
  "/errors",
  requireAuth,
  requireAdminEmail,
  asyncHandler(async (req, res) => {
    const { id, ids } = req.body || {};
    const toDelete = ids && Array.isArray(ids) ? ids : id != null ? [id] : [];
    if (toDelete.length === 0) {
      return res.status(400).json({
        error: "INVALID_ARGUMENT",
        message: "id or ids array required",
      });
    }
    const batch = db.batch();
    toDelete.forEach((docId) => {
      batch.delete(db.collection(CLIENT_ERRORS_COLLECTION).doc(docId));
    });
    await batch.commit();
    return res.json({ data: { deleted: toDelete.length } });
  })
);

export default router;
