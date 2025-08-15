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
 * Formats a Firestore Timestamp or JavaScript Date into various readable formats
 * @param {Timestamp | Date} input - Firestore Timestamp or JS Date
 * @param {'long' | 'short' | 'withTime'} format - Desired format
 * @returns {string} Formatted date string
 */
export const formatDate = (input, format = 'long') => {
  let date;

  // Handle Firestore Timestamp or JS Date
  if (input && typeof input.toDate === 'function') {
      date = input.toDate(); // Firestore Timestamp
  } else if (input instanceof Date) {
      date = input; // JS Date
  } else {
      return 'Invalid date';
  }

  const day = date.getDate();
  const dayPadded = String(day).padStart(2, '0');
  const month = date.getMonth() + 1;
  const monthPadded = String(month).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

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

  let date;
  try {
      if (timestamp.toDate) {
          date = timestamp.toDate();
      } else if (timestamp instanceof Date) {
          date = timestamp;
      } else if (timestamp.seconds) {
          date = new Date(timestamp.seconds * 1000);
      } else {
          date = new Date(timestamp);
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