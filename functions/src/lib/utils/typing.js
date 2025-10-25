/* eslint-disable */
import { Timestamp, GeoPoint } from "../admin.js";

export function toAdminTimestamp(input) {
  if (!input) return null;

  // Already an Admin Timestamp
  if (input instanceof Timestamp) return input;

  // Object form from client (callable payload)
  if (typeof input === 'object' && input.seconds != null && input.nanoseconds != null) {
    return new Timestamp(input.seconds, input.nanoseconds);
  }

  // JS Date or ISO string or millis
  if (input instanceof Date) return Timestamp.fromDate(input);
  if (typeof input === 'string' || typeof input === 'number') {
    const d = new Date(input);
    if (!Number.isNaN(d.getTime())) return Timestamp.fromDate(d);
  }

  return null;
}

export function toAdminGeoPoint(input) {
  if (!input) return null;

  // Already an Admin GeoPoint
  if (input instanceof GeoPoint) return input;

  // Our app sometimes uses {_lat,_long} or {latitude,longitude} or [lng,lat]
  if (typeof input === 'object') {
    if (input.latitude != null && input.longitude != null) {
      return new GeoPoint(input.latitude, input.longitude);
    }
    if (input._lat != null && input._long != null) {
      return new GeoPoint(input._lat, input._long);
    }
    // Array form [lng, lat]
    if (Array.isArray(input) && input.length === 2) {
      const [lng, lat] = input;
      return new GeoPoint(lat, lng);
    }
  }

  return null;
}

// Build Timestamp from separate date + "HH:mm"
export function buildStartDateTime(dateLike, hhmm) {
  if (!dateLike || !hhmm) return null;
  const d = new Date(dateLike);
  const [h, m] = String(hhmm).split(':').map(Number);
  if (Number.isFinite(h) && Number.isFinite(m)) {
    d.setHours(h, m, 0, 0);
    return Timestamp.fromDate(d);
  }
  return null;
}