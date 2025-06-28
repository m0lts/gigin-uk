export const incrementRating = (currentAvg, newRating) => {
    const totalReviews = currentAvg.totalReviews + 1;
    const avgRating = ((currentAvg.avgRating * currentAvg.totalReviews) + newRating) / totalReviews;
    return { totalReviews, avgRating };
};

/**
 * Formats a time span from a start time and duration in minutes
 * @param {string} startTime - Start time in 'HH:mm' format (24-hour)
 * @param {number} duration - Duration in minutes
 * @returns {string} Formatted span like '18:00 - 20:30'
 */
export const formatDurationSpan = (startTime, duration) => {
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const startDate = new Date();
    startDate.setHours(startHours, startMinutes, 0, 0);
  
    const endDate = new Date(startDate.getTime() + duration * 60000);
  
    const formatTime = (date) => {
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    };
  
    return `${formatTime(startDate)} - ${formatTime(endDate)}`;
  };

/**
 * Extracts the city name from a comma-separated address string.
 * Assumes the city is the third last element in the string.
 * @param {string} address - Full address string
 * @returns {string} Extracted city or original address if parsing fails
 */
export const getCityFromAddress = (address) => {
    if (typeof address !== 'string') return '';
  
    const parts = address.split(',');
    return parts.length >= 3
      ? parts[parts.length - 3].trim()
      : address.trim();
  };

/**
 * Opens a given URL in a new browser tab
 * @param {string} url - URL or route to open
 */
export const openInNewTab = (url, e) => {
    e.stopPropagation();
    if (!url || typeof url !== 'string') return;
    window.open(url, '_blank');
  };
