/** Venue "request access" form. No Firebase. */

import rateLimit from "express-rate-limit";

export const DEFAULT_NOTIFY_EMAIL = "gardner.b.toby@gmail.com";
export const MAIL_FROM = "Gigin <noreply@giginmusic.com>";
export const RATE_WINDOW_MS = 60 * 60 * 1000;
export const RATE_MAX = 5;

const LIMITS = {
  name: 80,
  venueName: 120,
  city: 80,
  email: 160,
  message: 2000,
};

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textField(value, max) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length > max) return { tooLong: true, value: text };
  return { tooLong: false, value: text };
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Trim and check a public request. A filled honeypot (`company`) looks like
 * success and is not stored.
 */
export function parseAccessRequest(body) {
  const source = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const trap = textField(source.company, 200);
  if (trap.value) return { ok: true, honeypot: true };

  const name = textField(source.name, LIMITS.name);
  const venueName = textField(source.venueName, LIMITS.venueName);
  const city = textField(source.city, LIMITS.city);
  const email = textField(source.email, LIMITS.email);
  const message = textField(source.message, LIMITS.message);
  const nightsRaw = String(source.nightsPerMonth ?? "").trim();
  const nights = Number(nightsRaw);
  const fields = [];
  if (name.tooLong || name.value.length < 2) fields.push("name");
  if (venueName.tooLong || venueName.value.length < 2) fields.push("venueName");
  if (city.tooLong || city.value.length < 2) fields.push("city");
  if (email.tooLong || !validEmail(email.value)) fields.push("email");
  if (message.tooLong) fields.push("message");
  if (!/^\d+$/.test(nightsRaw) || !Number.isInteger(nights) || nights < 1 || nights > 31) {
    fields.push("nightsPerMonth");
  }
  if (fields.length) {
    return { ok: false, error: "Check the form and try again.", fields };
  }
  return {
    ok: true,
    honeypot: false,
    record: {
      name: name.value,
      venueName: venueName.value,
      city: city.value,
      email: email.value.toLowerCase(),
      nightsPerMonth: nights,
      message: message.value,
    },
  };
}

export function notifyAddress(env = process.env) {
  const set = String(env.VENUE_ACCESS_NOTIFY_EMAIL || "").trim();
  return set || DEFAULT_NOTIFY_EMAIL;
}

export function accessRequestEmails(record, { to, createdAt }) {
  const when = createdAt || new Date().toISOString();
  const lines = [
    `Name: ${record.name}`,
    `Venue: ${record.venueName}`,
    `City: ${record.city}`,
    `Email: ${record.email}`,
    `Nights per month: ${record.nightsPerMonth}`,
    `Message: ${record.message || "—"}`,
    `Time: ${when}`,
  ];
  const founderText = lines.join("\n");
  const founderHtml = `<p>${lines.map((line) => escapeHtml(line)).join("<br>")}</p>`;
  const thanks = "Thanks, the founder will be in touch shortly.";
  return [
    {
      to,
      from: MAIL_FROM,
      message: {
        subject: `Venue access request from ${record.venueName}`,
        text: founderText,
        html: founderHtml,
      },
    },
    {
      to: record.email,
      from: MAIL_FROM,
      message: {
        subject: "We received your Gigin access request",
        text: thanks,
        html: `<p>${escapeHtml(thanks)}</p>`,
      },
    },
  ];
}

export function handleAccessRequest({ save, send, notifyTo, now }) {
  return async (req, res) => {
    const parsed = parseAccessRequest(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error, fields: parsed.fields });
    if (parsed.honeypot) return res.json({ ok: true });
    const createdAt = now();
    const record = { ...parsed.record, createdAt };
    try {
      await save(record);
      const emails = accessRequestEmails(parsed.record, { to: notifyTo(), createdAt });
      for (const email of emails) await send(email);
    } catch (error) {
      console.error("access request failed", error);
      return res.status(500).json({ error: "Could not send that request. Please try again." });
    }
    return res.json({ ok: true });
  };
}

export function accessRequestLimiter({ max = RATE_MAX, windowMs = RATE_WINDOW_MS } = {}) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please try again later." },
    validate: { trustProxy: false, xForwardedForHeader: false },
  });
}
