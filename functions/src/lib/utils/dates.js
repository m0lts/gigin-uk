/* eslint-disable */

/**
 * Converts a value to a JS Date object.
 * Supports the following formats:
 *   - Firestore Timestamp
 *   - JS Date object
 *   - { seconds: number, nanoseconds: number } object
 *   - ISO string
 *   - Milliseconds number
 * @param {any} v
 * @returns {Date|null} - JS Date object or null if invalid
 */
export function toJsDate(v) {
    if (!v) return null;
    if (typeof v.toDate === 'function') return v.toDate(); // Firestore Timestamp
    if (v instanceof Date) return new Date(v);
    if (typeof v === 'object' && typeof v.seconds === 'number') {
      return new Date(v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6));
    }
    const d = new Date(v); // ISO string or millis number
    return Number.isNaN(d.getTime()) ? null : d;
}