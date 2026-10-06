/** Gig reads the client cannot prove with a venueId constraint. Admin SDK only. */

import { db, GeoPoint, Timestamp } from "../config/admin.js";
import { venueIsApproved } from "./venueApprovalPolicy.js";

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function serializeValue(value) {
  if (value == null) return value;
  if (value instanceof Timestamp) {
    return { seconds: value.seconds, nanoseconds: value.nanoseconds };
  }
  if (typeof value.toDate === "function" && typeof value.seconds === "number") {
    return { seconds: value.seconds, nanoseconds: value.nanoseconds || 0 };
  }
  if (value instanceof GeoPoint) {
    return { latitude: value.latitude, longitude: value.longitude };
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    return { seconds: Math.floor(ms / 1000), nanoseconds: (ms % 1000) * 1e6 };
  }
  if (Array.isArray(value)) return value.map(serializeValue);
  if (typeof value === "object") {
    const out = {};
    for (const [key, child] of Object.entries(value)) out[key] = serializeValue(child);
    return out;
  }
  return value;
}

async function loadVenue(venueId, cache) {
  if (cache.has(venueId)) return cache.get(venueId);
  const snap = await db.doc(`venueProfiles/${venueId}`).get();
  const venue = snap.exists ? (snap.data() || {}) : null;
  cache.set(venueId, venue);
  return venue;
}

async function viewerCanRead(gig, uid, cache) {
  const venueId = gig?.venueId;
  if (typeof venueId !== "string" || !venueId) return false;
  const venue = await loadVenue(venueId, cache);
  if (!venue) return false;
  if (venueIsApproved(venue)) return true;
  if (!uid) return false;
  if (venue.createdBy === uid || venue.userId === uid) return true;
  const memberKey = `${venueId}/${uid}`;
  if (!cache.has(memberKey)) {
    const member = await db.doc(`venueProfiles/${venueId}/members/${uid}`).get();
    cache.set(memberKey, member.exists);
  }
  return cache.get(memberKey) === true;
}

export async function readGigsByIds(gigIds, uid) {
  const ids = [...new Set((Array.isArray(gigIds) ? gigIds : [])
    .map((id) => String(id || "").trim())
    .filter(Boolean))].slice(0, 100);
  if (!ids.length) return [];
  const snaps = await db.getAll(...ids.map((id) => db.doc(`gigs/${id}`)));
  const cache = new Map();
  const visible = [];
  for (const snap of snaps) {
    if (!snap.exists) continue;
    const gig = { id: snap.id, ...snap.data() };
    if (await viewerCanRead(gig, uid, cache)) visible.push(serializeValue(gig));
  }
  const order = new Map(ids.map((id, index) => [id, index]));
  visible.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return visible;
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function readNearbyGigs(body) {
  const source = body && typeof body === "object" ? body : {};
  const lat = finite(source.location?.latitude);
  const lng = finite(source.location?.longitude);
  if (lat == null || lng == null) throw httpError(400, "A location is required.");
  const radius = Math.min(Math.max(finite(source.radiusInKm) ?? 50, 1), 200);
  const latDelta = radius / 111;
  const lngDelta = radius / (111 * Math.cos((lat * Math.PI) / 180));
  const minLat = lat - latDelta;
  const maxLat = lat + latDelta;
  const minLng = lng - lngDelta;
  const maxLng = lng + lngDelta;
  const filters = source.filters && typeof source.filters === "object" ? source.filters : {};
  const startMs = filters.startDate ? new Date(filters.startDate).getTime() : Date.now();
  const startAt = Timestamp.fromDate(new Date(Number.isFinite(startMs) ? startMs : Date.now()));

  let snap;
  try {
    snap = await db.collection("gigs")
      .where("geopoint", ">=", new GeoPoint(minLat, minLng))
      .where("geopoint", "<=", new GeoPoint(maxLat, maxLng))
      .where("status", "==", "open")
      .where("startDateTime", ">=", startAt)
      .orderBy("geopoint")
      .orderBy("startDateTime")
      .limit(200)
      .get();
  } catch (error) {
    const missingIndex = error?.code === 9 || String(error?.message || "").toLowerCase().includes("index");
    if (!missingIndex) throw error;
    snap = await db.collection("gigs").where("status", "==", "open").limit(400).get();
  }

  const cache = new Map();
  const gigs = [];
  const earliest = startAt.toDate().getTime();
  const latest = filters.endDate ? new Date(filters.endDate).getTime() : null;
  for (const doc of snap.docs) {
    const gig = { id: doc.id, ...doc.data() };
    const point = gig.geopoint;
    const pointLat = point?.latitude;
    const pointLng = point?.longitude;
    if (typeof pointLat !== "number" || typeof pointLng !== "number") continue;
    if (pointLat < minLat || pointLat > maxLat || pointLng < minLng || pointLng > maxLng) continue;
    const when = gig.startDateTime?.toDate?.()?.getTime?.() ?? 0;
    if (when && when < earliest) continue;
    if (latest != null && Number.isFinite(latest) && when > latest) continue;
    if (filters.musicianType && gig.gigType !== filters.musicianType) continue;
    if (filters.kind && gig.kind !== filters.kind) continue;
    if (typeof filters.minBudget === "number" && !(Number(gig.budgetValue) >= filters.minBudget)) continue;
    if (typeof filters.maxBudget === "number" && !(Number(gig.budgetValue) <= filters.maxBudget)) continue;
    if (!(await viewerCanRead(gig, null, cache))) continue;
    gigs.push(serializeValue(gig));
  }
  return { gigs };
}
