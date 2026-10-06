/* Artist emails. Table markup and inline styles match design_handoff_artist_experience/emails. */

const FONT = "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const DARK = [
  [".bg", "background:#0F1115 !important"],
  [".card", "background:#1A1D22 !important;border-color:#2A2E36 !important"],
  [".ink", "color:#F2F3F5 !important"],
  [".muted", "color:#A3A9B5 !important"],
  [".eyebrow", "color:#FF8A70 !important"],
  [".box", "background:#22262D !important;border-color:#2E333B !important"],
  [".boxg", "background:#1C2A22 !important;border-color:#2B4434 !important"],
  [".labg", "color:#7FD49A !important"],
  [".rule", "border-color:#2E333B !important"],
  [".link", "color:#FF8A70 !important"],
  [".btnd", "background:#F2F3F5 !important"],
  [".btnd a", "color:#0F1115 !important"],
];

function darkCss(prefix) {
  return DARK.map(([selector, rule]) => `${prefix}${selector}{${rule}}`).join("\n");
}

function strip(value) {
  return String(value || "").replace(/<[^>]+>/g, "");
}

export function renderArtistEmail(email) {
  const styles = `:root{color-scheme:light dark;supported-color-schemes:light dark;}
body{margin:0;padding:0;-webkit-text-size-adjust:100%;}
a{text-decoration:underline;}
@media (max-width:620px){.card{padding:24px 18px !important;}.btn,.btn td,.btn a{display:block !important;width:100% !important;text-align:center !important;box-sizing:border-box;}}
@media (prefers-color-scheme: dark){
${darkCss("")}
}
${darkCss("[data-ogsc] ")}`;
  const paragraph = (text, cls, style) => `<p class="${cls}" style="margin:0 0 14px;font-family:${FONT};${style}">${text}</p>`;
  const paras = (email.paras || []).map((text) => paragraph(text, "ink", "font-size:16px;line-height:24px;color:#0F1115;")).join("");
  const boxes = (email.boxes || []).map((box) => {
    const rows = box.rows.filter((row) => row && row[1] != null && row[1] !== "").map(([label, value, strike], index) => `<tr><td class="muted${index ? " rule" : ""}" valign="top" style="padding:9px 12px 9px 0;width:118px;font-family:${FONT};font-size:14px;line-height:20px;color:#6B7280;${index ? "border-top:1px solid #E5E7EB;" : ""}">${label}</td><td class="${strike ? "muted" : "ink"}${index ? " rule" : ""}" valign="top" style="padding:9px 0;font-family:${FONT};font-size:14.5px;line-height:20px;font-weight:500;color:${strike ? "#6B7280" : "#0F1115"};${strike ? "text-decoration:line-through;" : ""}${index ? "border-top:1px solid #E5E7EB;" : ""}">${value}</td></tr>`).join("");
    if (!rows) return "";
    const green = box.green;
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="${green ? "boxg" : "box"}" style="margin:6px 0 18px;background:${green ? "#F3FAF5" : "#F6F7F9"};border:1px solid ${green ? "#D3EBDB" : "#F0F1F3"};border-radius:12px;"><tr><td style="padding:14px 16px 6px;"><div class="${green ? "labg" : "muted"}" style="font-family:${MONO};font-size:11.5px;letter-spacing:0.06em;font-weight:500;color:${green ? "#2F7A4B" : "#6B7280"};padding-bottom:4px;">${box.label}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table></td></tr></table>`;
  }).join("");
  const pre = email.pre ? paragraph(email.pre, "ink", "font-size:15px;line-height:22px;color:#0F1115;") : "";
  const background = email.buttonDark ? "#111317" : "#FF6C4B";
  const button = email.button ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="${email.buttonDark ? "btn btnd" : "btn"}" style="margin:4px 0 18px;"><tr><td class="${email.buttonDark ? "btnd" : ""}" style="background:${background};border-radius:10px;"><a href="${email.button[1]}" style="display:inline-block;padding:14px 22px;font-family:${FONT};font-size:15px;line-height:20px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:10px;min-width:200px;text-align:center;">${email.button[0]}</a></td></tr></table>` : "";
  const after = email.after ? paragraph(`${email.after[0]} <a class="link" href="${email.after[2]}" style="color:#B5462C;font-weight:500;">${email.after[1]}</a>`, "ink", "font-size:14.5px;line-height:22px;color:#0F1115;") : "";
  const extra = email.extra ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="box" style="margin:4px 0 18px;background:#F6F7F9;border:1px solid #F0F1F3;border-radius:12px;"><tr><td style="padding:14px 16px;font-family:${FONT};"><div class="ink" style="font-size:15px;line-height:22px;font-weight:600;color:#0F1115;">${email.extra.title}</div><div class="muted" style="font-size:14px;line-height:21px;color:#4B5160;padding:2px 0 8px;">${email.extra.body}</div><a class="link" href="${email.extra.link[1]}" style="font-size:14.5px;font-weight:600;color:#B5462C;">${email.extra.link[0]} →</a></td></tr></table>` : "";
  const small = email.small ? paragraph(email.small, "muted", "font-size:13.5px;line-height:20px;color:#6B7280;margin:0;") : "";
  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${strip(email.subject)}</title>
<style>
${styles}
</style>
</head>
<body class="bg" style="margin:0;padding:0;background:#F6F7F9;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;">${email.preheader || ""}${"&#847;&zwnj;&nbsp;".repeat(30)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg" style="background:#F6F7F9;">
<tr><td align="center" style="padding:28px 12px 32px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td class="card" style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:16px;padding:32px 28px;">
<div class="ink" style="font-family:${FONT};font-size:24px;line-height:28px;font-weight:700;letter-spacing:-0.01em;color:#0F1115;padding-bottom:22px;">gigin<span style="color:#FF6C4B;">.</span></div>
<div class="eyebrow" style="font-family:${MONO};font-size:12px;line-height:16px;letter-spacing:0.06em;font-weight:500;color:#B5462C;padding-bottom:8px;">${email.eyebrow || ""}</div>
<h1 class="ink" style="margin:0 0 18px;font-family:${FONT};font-size:24px;line-height:30px;font-weight:600;letter-spacing:-0.01em;color:#0F1115;">${email.heading || ""}</h1>
${paras}${boxes}${pre}${button}${after}${extra}${small}
</td></tr>
<tr><td class="muted" style="padding:16px 10px 0;font-family:${FONT};font-size:12.5px;line-height:19px;color:#6B7280;">${email.footer || ""}<br>Gigin · <a class="link" href="https://giginmusic.com" style="color:#6B7280;">giginmusic.com</a> · <a class="link" href="https://giginmusic.com/privacy-policy" style="color:#6B7280;">Privacy</a></td></tr>
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
  if (email.pre) lines.push(strip(email.pre), "");
  if (email.button) lines.push(`${email.button[0]}:`, email.button[1], "");
  if (email.after) lines.push(`${email.after[0]} ${email.after[1]}:`, email.after[2], "");
  if (email.extra) lines.push(email.extra.title, email.extra.body, `${email.extra.link[0]}: ${email.extra.link[1]}`, "");
  if (email.small) lines.push(strip(email.small), "");
  lines.push("--", strip(email.footer), "Gigin · https://giginmusic.com");
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
