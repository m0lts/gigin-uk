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

  // Firestore Timestamp instance
  if (typeof v.toDate === 'function') return v.toDate();

  // JS Date
  if (v instanceof Date) return new Date(v);

  // Firestore timestamp-like object
  const secs =
    typeof v.seconds === 'number'
      ? v.seconds
      : typeof v._seconds === 'number'
      ? v._seconds
      : null;

  if (secs !== null) {
    const nanos =
      typeof v.nanoseconds === 'number'
        ? v.nanoseconds
        : typeof v._nanoseconds === 'number'
        ? v._nanoseconds
        : 0;
    return new Date(secs * 1000 + Math.floor(nanos / 1e6));
  }

  // ISO string or milliseconds number
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}