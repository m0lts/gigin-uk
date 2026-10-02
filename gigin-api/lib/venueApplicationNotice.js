/** Pure rules for the venue "someone applied" email. No Firebase. */

export const NOTICE_WINDOW_MS = 60 * 60 * 1000;

export function shouldNotify(to) {
  return Boolean(to && String(to).includes("@"));
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Fold a new application into the venue's open 60-minute window.
 * One mail document covers the window. A second application replaces that
 * mail with a single batched email instead of a second one.
 */
export function planVenueNotice(open, item, now, windowMs = NOTICE_WINDOW_MS) {
  const openedAt = open?.openedAt ? Date.parse(open.openedAt) : NaN;
  const openWindow = Number.isFinite(openedAt) && now - openedAt < windowMs;
  const items = openWindow ? [...(open.items || []), item] : [item];
  const started = openWindow ? openedAt : now;
  return {
    openedAt: new Date(started).toISOString(),
    items,
    previousMailId: openWindow ? (open.mailId || null) : null,
    sendAt: started + windowMs,
    batched: items.length > 1,
  };
}

export function applicationNoticeMessage(items) {
  const rows = (items || []).filter((item) => item && item.actName);
  const batched = rows.length > 1;
  const subject = batched
    ? `${rows.length} new applications`
    : `New application from ${rows[0]?.actName || "an act"}`;
  const text = rows.map((item) => [
    item.actName,
    item.nightDate || "the night",
    item.preferredSet || "No preference",
    item.reviewUrl || "",
  ].join("\n")).join("\n\n");
  const html = rows.map((item) => `<p><strong>${escapeHtml(item.actName)}</strong><br>${escapeHtml(item.nightDate || "the night")}<br>${escapeHtml(item.preferredSet || "No preference")}</p><p><a href="${escapeHtml(item.reviewUrl)}">Review the application</a></p>`).join("");
  return { subject, text, html };
}
