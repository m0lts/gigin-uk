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

/**
 * Returns ordinal suffix for a given day
 * @param {number} day - Day of the month
 * @returns {string} Suffix (st, nd, rd, th)
 */
const getOrdinalSuffix = (day) => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
};

/**
 * Formats a date-like value into readable formats.
 * Uses toJsDate() internally to ensure consistent parsing.
 *
 * @param {any} input - Any supported date value
 * @param {'long' | 'short' | 'withTime'} format
 * @returns {string}
 */
export const formatDate = (input, format = 'long') => {
  const date = toJsDate(input);
  if (!date) return 'Invalid date';

  const pad2 = (n) => String(n).padStart(2, '0');
  const day = date.getDate();
  const dayPadded = pad2(day);
  const monthPadded = pad2(date.getMonth() + 1);
  const year = date.getFullYear();
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
  const monthName = date.toLocaleDateString('en-GB', { month: 'long' });

  switch (format) {
    case 'short':
      return `${dayPadded}/${monthPadded}/${year}`;
    case 'withTime':
      return `${dayPadded}/${monthPadded}/${year} - ${hours}:${minutes}`;
    case 'long':
    default:
      return `${weekday} ${day}${getOrdinalSuffix(day)} ${monthName}`;
  }
};

/**
 * Formats a timestamp into a readable weekday + date string
 * @param {Timestamp|Date|{seconds: number}} timestamp - Firestore Timestamp, Date object, or Unix-like object
 * @param {'long' | 'short'} weekdayFormat - Whether to use full or abbreviated weekday ('Friday' vs 'Fri')
 * @returns {string} Formatted date string like "Friday, 7th June" or "Fri, 7th June"
 */
export const formatFeeDate = (timestamp) => {
  if (!timestamp) {
      console.error('Invalid or undefined timestamp passed to formatFeeDate');
      return 'Invalid date';
  }

  const cleanTimestamp = toJsDate(timestamp);

  let date;
  try {
      if (cleanTimestamp.toDate) {
          date = cleanTimestamp.toDate();
      } else if (cleanTimestamp instanceof Date) {
          date = cleanTimestamp;
      } else if (cleanTimestamp.seconds) {
          date = new Date(cleanTimestamp.seconds * 1000);
      } else {
          date = new Date(cleanTimestamp);
      }

      if (isNaN(date.getTime())) throw new Error('Invalid date object');
  } catch (err) {
      console.error('Timestamp could not be converted to a valid date:', timestamp);
      return 'Invalid date';
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} - ${hours}:${minutes}`;
};