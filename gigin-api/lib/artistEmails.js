/* Artist emails. Inline styles only, plus one small rule so the button stays tappable on a phone. */

import { durableEmailImageUrl } from "./emailImages.js";

const FONT = "Arial, Helvetica, sans-serif";
const HEAD = "Georgia, 'Times New Roman', serif";
const MONO = "Consolas, Menlo, monospace";

function strip(value) {
  return String(value || "").replace(/<[^>]+>/g, "");
}

function escapeEmail(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function instrumentGiven(member) {
  const raw = member?.instruments ?? member?.instrument ?? "";
  if (Array.isArray(raw)) return raw.some((item) => String(item || "").trim());
  return Boolean(String(raw || "").trim());
}

/**
 * Band line for the application email.
 * A blank member row is not a band, so the row is left out.
 */
export function bandMemberRow(members) {
  const count = (Array.isArray(members) ? members : []).filter((member) => {
    const name = String(member?.name || member?.userName || "").trim();
    return Boolean(name || instrumentGiven(member));
  }).length;
  if (!count) return null;
  return ["Band", `${count} member${count === 1 ? "" : "s"}`];
}

function emailImg(url, size, round = false) {
  const src = durableEmailImageUrl(url);
  if (!src) return "";
  const radius = round ? "50%" : "8px";
  return `<img src="${escapeEmail(src)}" alt="" width="${size}" height="${size}" style="display:block;border:0;border-radius:${radius};object-fit:cover;">`;
}

/** A round face next to the booker's first name. Left out when there is no public photo. */
function bookerFace(email) {
  const name = String(email.bookerName || "").trim();
  const photo = emailImg(email.bookerPhotoUrl, 28, true);
  if (!name || !photo) return "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;"><tr><td style="padding-right:8px;vertical-align:middle;">${photo}</td><td style="font-family:${FONT};font-size:15px;line-height:20px;font-weight:600;color:#0F1115;vertical-align:middle;">${escapeEmail(name)}</td></tr></table>`;
}

function brandBlock(email) {
  if (!email.brand?.name) {
    return `<div style="font-family:${FONT};font-size:22px;line-height:26px;font-weight:700;color:#0F1115;padding-bottom:18px;">gigin<span style="color:#FF6C4B;">.</span></div>`;
  }
  const name = `<div style="font-size:14px;font-weight:600;color:#0F1115;">${escapeEmail(email.brand.name)}</div><div style="font-size:12px;color:#5B606B;">via gigin<span style="color:#FF6C4B;">.</span></div>`;
  const mark = emailImg(email.brand.imageUrl, 36);
  if (!mark) return `<div style="margin:0 0 18px;font-family:${FONT};">${name}</div>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;"><tr><td style="padding-right:10px;vertical-align:middle;">${mark}</td><td style="font-family:${FONT};">${name}</td></tr></table>`;
}

export function renderArtistEmail(email) {
  const home = String(process.env.BASE_URL || "https://giginmusic.com").replace(/\/$/, "");
  const styles = `body{margin:0;padding:0;}
a{text-decoration:underline;}
@media (max-width:620px){.card{padding:24px 18px !important;}.btn,.btn td,.btn a{display:block !important;width:100% !important;text-align:center !important;box-sizing:border-box;}}`;
  const paragraph = (text, cls, style) => `<p class="${cls}" style="margin:0 0 14px;font-family:${FONT};${style}">${text}</p>`;
  const paras = (email.paras || []).map((text) => paragraph(text, "ink", "font-size:16px;line-height:24px;color:#0F1115;")).join("");
  const boxes = (email.boxes || []).map((box) => {
    const rows = box.rows.filter((row) => row && row[1] != null && row[1] !== "").map(([label, value, strike], index) => `<tr><td class="muted${index ? " rule" : ""}" valign="top" style="padding:9px 12px 9px 0;width:118px;font-family:${FONT};font-size:14px;line-height:20px;color:#6B7280;${index ? "border-top:1px solid #E5E7EB;" : ""}">${label}</td><td class="${strike ? "muted" : "ink"}${index ? " rule" : ""}" valign="top" style="padding:9px 0;font-family:${FONT};font-size:14.5px;line-height:20px;font-weight:500;color:${strike ? "#6B7280" : "#0F1115"};${strike ? "text-decoration:line-through;" : ""}${index ? "border-top:1px solid #E5E7EB;" : ""}">${value}</td></tr>`).join("");
    if (!rows) return "";
    const green = box.green;
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="${green ? "boxg" : "box"}" style="margin:6px 0 18px;background:${green ? "#F3FAF5" : "#F6F7F9"};border:1px solid ${green ? "#D3EBDB" : "#F0F1F3"};border-radius:12px;"><tr><td style="padding:14px 16px 6px;"><div class="${green ? "labg" : "muted"}" style="font-family:${MONO};font-size:11.5px;letter-spacing:0.06em;font-weight:500;color:${green ? "#2F7A4B" : "#6B7280"};padding-bottom:4px;">${box.label}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table></td></tr></table>`;
  }).join("");
  const quote = email.quote?.text
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="box" style="margin:4px 0 18px;background:#F6F7F9;border:1px solid #F0F1F3;border-radius:12px;"><tr><td style="padding:14px 16px;font-family:${FONT};"><div class="muted" style="font-size:13px;line-height:18px;color:#6B7280;">${escapeEmail(email.quote.label)}</div><div class="ink" style="font-size:16px;line-height:24px;font-weight:500;color:#0F1115;padding-top:4px;">“${escapeEmail(email.quote.text)}”</div></td></tr></table>`
    : "";
  const openGigs = Array.isArray(email.openGigs) ? email.openGigs.filter((gig) => gig?.url && gig?.name) : [];
  const listings = openGigs.length
    ? `<div class="ink" style="margin:4px 0 10px;font-family:${FONT};font-size:16px;line-height:22px;font-weight:600;color:#0F1115;">Gigs looking for acts like you</div>${openGigs.map((gig) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="box" style="margin:0 0 8px;background:#F6F7F9;border:1px solid #F0F1F3;border-radius:16px;"><tr><td style="padding:12px 14px;font-family:${FONT};"><a class="ink" href="${escapeEmail(gig.url)}" style="color:#0F1115;text-decoration:none;font-weight:600;">${escapeEmail(gig.name)}</a><div class="muted" style="font-size:13.5px;line-height:18px;color:#6B7280;padding-top:2px;">${escapeEmail([gig.when, gig.place].filter(Boolean).join(" · "))}</div></td><td align="right" style="padding-right:14px;"><span style="display:inline-block;background:#FDE6DF;color:#FF6C4B;border-radius:999px;padding:3px 8px;font-family:${FONT};font-size:12px;font-weight:600;">Open</span></td></tr></table>`).join("")}`
    : "";
  const callout = email.callout?.body
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 18px;background:#FDF2EC;border-radius:12px;"><tr><td style="padding:14px 16px;font-family:${FONT};"><div class="ink" style="font-size:15px;line-height:22px;font-weight:600;color:#0F1115;">${escapeEmail(email.callout.title || "")}</div><div class="ink" style="font-size:15px;line-height:22px;color:#4B5160;padding-top:4px;">${email.callout.body}</div></td></tr></table>`
    : "";
  const pre = email.pre ? paragraph(email.pre, "ink", "font-size:15px;line-height:22px;color:#0F1115;") : "";
  const button = email.button ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn btnd" style="margin:4px 0 18px;"><tr><td class="btnd" style="background:#111317;border-radius:999px;"><a href="${email.button[1]}" style="display:inline-block;padding:14px 22px;font-family:${FONT};font-size:15px;line-height:20px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:999px;min-width:200px;text-align:center;">${email.button[0]}</a></td></tr></table>` : "";
  const after = email.after ? paragraph(`${email.after[0]} <a class="link" href="${email.after[2]}" style="color:#B5462C;font-weight:500;">${email.after[1]}</a>`, "ink", "font-size:14.5px;line-height:22px;color:#0F1115;") : "";
  const extra = email.extra ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="box" style="margin:4px 0 18px;background:#F6F7F9;border:1px solid #F0F1F3;border-radius:12px;"><tr><td style="padding:14px 16px;font-family:${FONT};"><div class="ink" style="font-size:15px;line-height:22px;font-weight:600;color:#0F1115;">${email.extra.title}</div><div class="muted" style="font-size:14px;line-height:21px;color:#4B5160;padding:2px 0 8px;">${email.extra.body}</div><a class="link" href="${email.extra.link[1]}" style="font-size:14.5px;font-weight:600;color:#B5462C;">${email.extra.link[0]} →</a></td></tr></table>` : "";
  const small = email.small ? paragraph(email.small, "muted", "font-size:13.5px;line-height:20px;color:#6B7280;margin:0;") : "";
  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${strip(email.subject)}</title>
<style>
${styles}
</style>
</head>
<body class="bg" style="margin:0;padding:0;background:#ECEFF4;">
<div style="display:none;max-height:0;overflow:hidden;">${email.preheader || ""}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg" style="background:#ECEFF4;">
<tr><td align="center" style="padding:28px 12px 32px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td class="card" style="background:#FFFFFF;border:0;border-radius:24px;padding:32px 28px;">
${brandBlock(email)}
<h1 class="ink" style="margin:0 0 18px;font-family:${HEAD};font-size:36px;line-height:40px;font-weight:300;letter-spacing:-0.02em;color:#0F1115;">${email.heading || ""}</h1>
${bookerFace(email)}
${paras}${boxes}${quote}${listings}${callout}${pre}${button}${after}${extra}${small}
</td></tr>
<tr><td class="muted" style="padding:16px 10px 0;font-family:${FONT};font-size:12.5px;line-height:19px;color:#6B7280;">${email.footer || ""}<br>Gigin · <a class="link" href="${home}" style="color:#6B7280;">giginmusic.com</a> · <a class="link" href="${home}/privacy-policy" style="color:#6B7280;">Privacy</a></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  const lines = ["gigin.", "", email.eyebrow || "", strip(email.heading), ""];
  (email.paras || []).forEach((text) => lines.push(strip(text), ""));
  (email.boxes || []).forEach((box) => {
    const rows = (box.rows || []).filter((row) => row && row[1]);
    if (!rows.length) return;
    lines.push(box.label);
    rows.forEach(([label, value, strike]) => lines.push(`${label}: ${strike ? `(was) ${strip(value)}` : strip(value)}`));
    lines.push("");
  });
  if (email.quote?.text) lines.push(strip(email.quote.label), `“${strip(email.quote.text)}”`, "");
  if (openGigs.length) {
    lines.push("Gigs looking for acts like you");
    openGigs.forEach((gig) => lines.push(`${gig.when ? `${strip(gig.when)} · ` : ""}${strip(gig.name)}${gig.place ? ` — ${strip(gig.place)}` : ""}`, gig.url));
    lines.push("");
  }
  if (email.callout?.body) lines.push(strip(email.callout.title), strip(email.callout.body), "");
  if (email.pre) lines.push(strip(email.pre), "");
  if (email.button) lines.push(`${email.button[0]}:`, email.button[1], "");
  if (email.after) lines.push(`${email.after[0]} ${email.after[1]}:`, email.after[2], "");
  if (email.extra) lines.push(email.extra.title, email.extra.body, `${email.extra.link[0]}: ${email.extra.link[1]}`, "");
  if (email.small) lines.push(strip(email.small), "");
  lines.push("--", strip(email.footer), `Gigin · ${home}`);
  return { subject: strip(email.subject), html, text: lines.join("\n") };
}

function stamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function icsEvent({ uid, sequence = 0, summary, start, end, location, description }) {
  if (!start || !end) return "";
  const fold = (value) => String(value || "").replace(/[\r\n]+/g, " ");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Gigin//EN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `SEQUENCE:${Number(sequence) || 0}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${fold(summary)}`,
    location ? `LOCATION:${fold(location)}` : "",
    description ? `DESCRIPTION:${fold(description)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

export function icsAttachment(ics) {
  if (!ics) return [];
  return [{
    filename: "gigin-set.ics",
    content: Buffer.from(ics, "utf8").toString("base64"),
    encoding: "base64",
    contentType: "text/calendar; charset=utf-8; method=REQUEST",
  }];
}
