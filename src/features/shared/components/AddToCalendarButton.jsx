// AddToCalendarButton.jsx
import { useState } from "react";
import { AppleIcon, GoogleIcon } from "../ui/extras/Icons";

/**
 * Build a Google Calendar "add event" URL
 * @param {Object} evt
 * @param {string} evt.title
 * @param {Date|string} evt.start - Date or ISO string
 * @param {Date|string} evt.end   - Date or ISO string
 * @param {string} [evt.description]
 * @param {string} [evt.location]
 */
function buildGoogleCalUrl({ title, start, end, description = "", location = "" }) {
  const toGCal = (d) =>
    new Date(d).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${toGCal(start)}/${toGCal(end)}`,
    details: description,
    location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Build a minimal ICS text
 * @param {Object} evt
 * @param {string} evt.title
 * @param {Date|string} evt.start
 * @param {Date|string} evt.end
 * @param {string} [evt.description]
 * @param {string} [evt.location]
 */
function buildICS({ title, start, end, description = "", location = "" }) {
  const fmt = (d) => new Date(d).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const uid = `${Date.now()}@giginmusic.com`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Gigin//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${escapeICS(title)}`,
    description ? `DESCRIPTION:${escapeICS(description)}` : "",
    location ? `LOCATION:${escapeICS(location)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

// Escape commas/semicolons/backslashes/newlines for ICS
function escapeICS(str) {
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function downloadICS(filename, icsText) {
  const blob = new Blob([icsText], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Props:
 * - event: { title, start, end, description?, location? }
 */
export default function AddToCalendarButton({ event }) {

  const handleGoogle = () => {
    const url = buildGoogleCalUrl(event);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleApple = () => {
    const ics = buildICS(event);
    downloadICS(event.title || "event", ics);
  };

  return (
    <div className="add-to-calendar">
      <button className="btn tertiary" onClick={handleGoogle}>
        <GoogleIcon />
        Add to Google Calendar
      </button>
      <button className="btn tertiary" onClick={handleApple}>
        <AppleIcon />
        Add to Apple/iOS Calendar
      </button>
    </div>
  );
}