const WINDOW_MS = 60 * 60 * 1000;

export function createWindowLimiter({ max, windowMs = WINDOW_MS } = {}) {
  const hits = new Map();
  return {
    allow(key, now = Date.now()) {
      if (!key) return false;
      const recent = (hits.get(key) || []).filter((at) => now - at < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
  };
}

function londonDay(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function shiftDay(isoDay, days) {
  const [year, month, day] = isoDay.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

/** Gig date is upcoming or within the last 14 London calendar days. */
export function isUpcomingOrRecent(date, now = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
  return londonDay(date) >= shiftDay(londonDay(now), -14);
}

export function applicationDateLabel(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long" }).format(date);
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric" }).format(date);
  const month = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", month: "long" }).format(date);
  return `${weekday} ${day} ${month}`;
}

export function manageLinksText(rows) {
  const lines = [
    "Here are the private links for your applications on Gigin.",
    "",
    ...rows.map((row) => `${row.gigName} · ${row.venueName} · ${row.dateLabel}\nView my application: ${row.url}`),
    "",
    "These links are private. Don't forward them. If you didn't ask for this, you can ignore this email.",
  ];
  return lines.join("\n");
}
