/** Which picture URLs are safe to put in an email. Signed Storage URLs are not. */

import crypto from "crypto";

const SIGNED = /X-Goog-|GoogleAccessId|X-Amz-/i;
const THUMB_FILE = /\/email-thumbs\/([a-f0-9]{32})\.jpg/i;
const API_FILE = /\/api\/email-images\/([a-f0-9]{32})\.jpg$/i;

function publicHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return host !== "localhost" && host !== "127.0.0.1" && !host.endsWith(".local");
}

/**
 * A long-lived https URL for a JPEG we published for email.
 * Signed, local, and original Storage URLs are left out.
 */
export function durableEmailImageUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  let url;
  try {
    url = new URL(raw);
  } catch {
    return "";
  }
  if (url.protocol !== "https:") return "";
  if (!publicHost(url.hostname)) return "";
  if (SIGNED.test(url.search)) return "";
  const path = decodeURIComponent(url.pathname);
  if (THUMB_FILE.test(path) || API_FILE.test(url.pathname)) return url.toString();
  return "";
}

/** Public API origin for email images, when one is configured. */
export function emailImageOrigin() {
  const raw = String(process.env.EMAIL_IMAGE_ORIGIN || process.env.API_BASE_URL || "").trim().replace(/\/$/, "");
  if (!/^https:\/\//i.test(raw)) return "";
  try {
    const url = new URL(raw);
    if (!publicHost(url.hostname)) return "";
    return raw;
  } catch {
    return "";
  }
}

function barePath(path) {
  const clean = String(path || "").split("?")[0];
  if (!clean || clean.includes("..") || clean.startsWith("email-thumbs/")) return "";
  return clean;
}

/**
 * Storage object path for a photo we already hold.
 * A path outside this bucket, or a path that climbs directories, is ignored.
 */
export function storageObjectPath(value, bucketName) {
  const raw = String(value || "").trim();
  if (!raw || raw.includes("..") || raw.includes("\\")) return "";
  if (!/^https?:\/\//i.test(raw)) return barePath(raw.replace(/^\/+/, ""));
  let url;
  try {
    url = new URL(raw);
  } catch {
    return "";
  }
  const host = url.hostname.toLowerCase();
  if (host === "firebasestorage.googleapis.com") {
    const match = url.pathname.match(/\/b\/([^/]+)\/o\/(.+)$/);
    if (!match) return "";
    if (bucketName && decodeURIComponent(match[1]) !== bucketName) return "";
    return barePath(decodeURIComponent(match[2]));
  }
  if (host === "storage.googleapis.com") {
    const parts = url.pathname.split("/").filter(Boolean).map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return "";
      }
    });
    if (parts.some((part) => !part) || parts.length < 2) return "";
    if (bucketName && parts[0] !== bucketName) return "";
    return barePath(parts.slice(1).join("/"));
  }
  return "";
}

/** Stable id for the public JPEG made from a stored photo. */
export function emailThumbId(objectPath) {
  const path = String(objectPath || "");
  if (!path || path.includes("..") || path.includes("\\")) return "";
  return crypto.createHash("sha256").update(path).digest("hex").slice(0, 32);
}

/** Storage path of a published email JPEG. Empty unless the id is 32 hex chars. */
export function emailThumbObjectPath(id) {
  if (!/^[a-f0-9]{32}$/.test(String(id || ""))) return "";
  return `email-thumbs/${id}.jpg`;
}

/** First venue photo, as a storage path or URL. Empty when the venue has none. */
export function venueImageSource(venue) {
  const list = Array.isArray(venue?.photos) ? venue.photos : [];
  const first = list[0] || venue?.photo || venue?.picture || "";
  if (!first) return "";
  if (typeof first === "string") return first;
  return first.path || first.url || first.src || "";
}
