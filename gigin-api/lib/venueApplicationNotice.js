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

function httpUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function memberCounts(member) {
  const name = String(member?.name || member?.userName || "").trim();
  const raw = member?.instruments ?? member?.instrument ?? "";
  const played = Array.isArray(raw)
    ? raw.some((item) => String(item || "").trim())
    : Boolean(String(raw || "").trim());
  return Boolean(name || played);
}

/** Solo, Duo, Trio, or an n-piece, plus the instruments they ticked. A blank row does not count. */
export function actKind(members) {
  const filled = (Array.isArray(members) ? members : []).filter(memberCounts);
  const count = filled.length;
  if (!count) return "";
  const kind = count === 1 ? "Solo" : count === 2 ? "Duo" : count === 3 ? "Trio" : `${count}-piece`;
  const seen = new Set();
  const instruments = [];
  filled.forEach((member) => {
    const raw = member?.instruments ?? member?.instrument ?? [];
    const list = Array.isArray(raw) ? raw : String(raw).split(",");
    list.forEach((item) => {
      const label = String(item || "").trim().toLowerCase();
      if (!label || seen.has(label)) return;
      seen.add(label);
      instruments.push(label);
    });
  });
  return instruments.length ? `${kind} · ${instruments.join(", ")}` : kind;
}

/** One Spotify or YouTube link, or the uploaded file name. No player. */
export function noticeTrack(app) {
  const links = app?.links || {};
  if (httpUrl(links.spotify)) return { trackUrl: String(links.spotify).trim() };
  if (httpUrl(links.youtube)) return { trackUrl: String(links.youtube).trim() };
  const assets = Array.isArray(app?.assets) ? app.assets : [];
  const file = assets.find((asset) => {
    const type = String(asset?.contentType || "");
    const name = String(asset?.name || "");
    return type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(name);
  });
  return file?.name ? { trackName: String(file.name).slice(0, 180) } : {};
}

export function applicationReviewUrl(rootId, base = process.env.BASE_URL || "https://giginmusic.com") {
  const origin = String(base || "https://giginmusic.com").replace(/\/$/, "");
  return `${origin}/venues/dashboard/gigs/gig-applications?gig=${encodeURIComponent(rootId || "")}&tab=applications`;
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

function trackText(item) {
  if (httpUrl(item?.trackUrl)) return item.trackUrl;
  return item?.trackName || "";
}

function textCard(item) {
  const lines = [
    `${item.actName} for ${item.gigName || "the gig"}`,
    item.actType || "",
    trackText(item),
    item.message || "",
    item.played ? `Where you've played: ${item.played}` : "",
    item.openSets ? `Sets still open: ${item.openSets}` : "",
    item.reviewUrl ? `Listen and decide: ${item.reviewUrl}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

function htmlRow(label, value) {
  if (!value) return "";
  return `<tr><td style="padding:6px 12px 6px 0;color:#6B7280;font-family:Geist,Arial,sans-serif;font-size:14px;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:6px 0;color:#0F1115;font-family:Geist,Arial,sans-serif;font-size:14px;">${value}</td></tr>`;
}

function htmlCard(item) {
  const photo = httpUrl(item.photoUrl)
    ? `<img src="${escapeHtml(item.photoUrl)}" alt="" width="72" height="72" style="display:block;border-radius:12px;object-fit:cover;margin-bottom:8px;">`
    : "";
  const track = httpUrl(item.trackUrl)
    ? `<a href="${escapeHtml(item.trackUrl)}">${escapeHtml(item.trackUrl)}</a>`
    : escapeHtml(item.trackName || "");
  const rows = [
    htmlRow("Type", escapeHtml(item.actType)),
    htmlRow("Track", track),
    htmlRow("Message", escapeHtml(item.message)),
    item.played ? htmlRow("Where you've played", escapeHtml(item.played)) : "",
    htmlRow("Sets still open", escapeHtml(item.openSets)),
  ].join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:#F6F7F9;border-radius:16px;"><tr><td style="padding:16px;">${photo}<h2 style="margin:0 0 4px;font-family:Georgia,serif;font-weight:300;font-size:28px;color:#0F1115;">${escapeHtml(item.actName)}</h2><p style="margin:0 0 10px;color:#4B5160;font-family:Geist,Arial,sans-serif;">for ${escapeHtml(item.gigName || "the gig")}</p><table role="presentation">${rows}</table><p style="margin:14px 0 0;"><a href="${escapeHtml(item.reviewUrl)}" style="display:inline-block;background:#111317;color:#ffffff;text-decoration:none;font-family:Geist,Arial,sans-serif;font-size:15px;font-weight:600;padding:12px 18px;border-radius:999px;">Listen and decide</a></p></td></tr></table>`;
}

export function applicationNoticeMessage(items) {
  const rows = (items || []).filter((item) => item && item.actName);
  const batched = rows.length > 1;
  const first = rows[0] || {};
  const subject = batched
    ? `${rows.length} new requests`
    : `New request: ${first.actName || "an act"} for ${first.gigName || "a gig"}`;
  const others = Number(rows[rows.length - 1]?.othersWaiting) || 0;
  const more = others > 0
    ? `${others} more ${others === 1 ? "request is" : "requests are"} waiting.`
    : "";
  const text = [...rows.map(textCard), more].filter(Boolean).join("\n\n");
  const html = `<div style="background:#ECEFF4;padding:24px;font-family:Geist,Arial,sans-serif;"><div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:24px;padding:28px;">${rows.map(htmlCard).join("")}${more ? `<p style="color:#4B5160;">${escapeHtml(more)}</p>` : ""}</div></div>`;
  return { subject, text, html };
}
