/* eslint-disable */

/**
 * Generate a Google Calendar link for an event.
 *
 * @param {Object} opts
 * @param {string} opts.title - Event title.
 * @param {string} opts.startTime - ISO8601 string of start time.
 * @param {string} opts.endTime - ISO8601 string of end time.
 * @param {string} opts.description - Event description.
 * @param {string} opts.location - Event location.
 * @returns {string} Google Calendar event link.
 */
export function generateCalendarLink({ title, startTime, endTime, description, location }) {
    const baseUrl = "https://www.google.com/calendar/render";
    const formattedStartTime = startTime.replace(/-|:|\.\d+/g, "");
    const formattedEndTime = endTime.replace(/-|:|\.\d+/g, "");
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: title,
      dates: `${formattedStartTime}/${formattedEndTime}`,
      details: description,
      location,
    });
    return `${baseUrl}?${params.toString()}`;
  }