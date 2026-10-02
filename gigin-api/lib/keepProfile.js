/* eslint-disable */
import crypto from "crypto";
import { db, admin, FieldValue } from "../config/admin.js";
import { queueMail } from "./queueMail.js";
import { renderArtistEmail } from "./artistEmails.js";
import {
  APP_ORIGIN,
  MAIL_FROM,
  artistContactDecision,
  bookText,
  capacityMatches,
  confirmClaimDecision,
  passwordAcceptable,
  dealText,
  enabledSections,
  firstName,
  isPubliclyReadableStatus,
  maskEmail,
  nextSlug,
  ogDescription,
  pressKitDecision,
  profileUrl,
  reminderEligible,
  slugify,
  toPublicProfile,
  toEditorProfile,
  venueContactDecision,
  LISTED_VENUE_EMPTY,
} from "./keepProfileLogic.js";
import { forgetProfileEmail, profileIdForEmail, rememberProfileEmail } from "./profileEmailIndex.js";

export {
  artistContactDecision,
  pressKitDecision,
  venueContactDecision,
  toPublicProfile,
  toEditorProfile,
  reminderEligible,
  maskEmail,
  slugify,
};

const COOKIE = "gigin_profile";
const DEVICE_DAYS = 180;
const EDITOR_DAYS = 30;
const CONFIRM_DAYS = 7;

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function emailNorm(value) {
  const email = String(value || "").trim().toLowerCase();
  return email.includes("@") ? email : "";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || "").split(";").forEach((part) => {
    const index = part.indexOf("=");
    if (index > 0) out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  });
  return out;
}

function cookieHeader(token, maxAgeSec) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const domain = process.env.COOKIE_DOMAIN ? `; Domain=${process.env.COOKIE_DOMAIN}` : "";
  return `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSec}${secure}${domain}`;
}

export function setProfileCookie(res, token, days = DEVICE_DAYS) {
  res.append("Set-Cookie", cookieHeader(token, days * 24 * 60 * 60));
}

export function clearProfileCookie(res) {
  res.append("Set-Cookie", cookieHeader("", 0));
}

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function buildGuestTechRider({ needs = [], bringOwn = [], members = [] } = {}) {
  return {
    mode: "guest",
    guestNeeds: (Array.isArray(needs) ? needs : []).filter(Boolean),
    bringOwn: (Array.isArray(bringOwn) ? bringOwn : []).map((item) => String(item || "").trim()).filter(Boolean),
    members: Array.isArray(members) ? members : [],
  };
}

function emailShell({ title, inner, buttonLabel, buttonUrl, footer, orange = false }) {
  const bg = orange ? "#FF6C4B" : "#111317";
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F6F7F9;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="600" style="max-width:600px;background:#fff;border:1px solid #E5E7EB;border-radius:16px;">
          <tr><td style="padding:28px 28px 0;font-family:Geist,Inter,Arial,sans-serif;font-size:20px;font-weight:700;">gigin.</td></tr>
          <tr><td style="padding:16px 28px 0;font-family:Geist,Inter,Arial,sans-serif;font-size:22px;font-weight:650;color:#0F1115;">${title}</td></tr>
          <tr><td style="padding:12px 28px 0;font-family:Geist,Inter,Arial,sans-serif;font-size:15px;line-height:1.55;color:#4B5160;">${inner}</td></tr>
          ${buttonUrl ? `<tr><td style="padding:22px 28px 0;"><a href="${buttonUrl}" style="display:inline-block;background:${bg};color:#fff;text-decoration:none;font-family:Geist,Inter,Arial,sans-serif;font-size:15px;font-weight:600;padding:14px 18px;border-radius:10px;">${buttonLabel}</a></td></tr>` : ""}
          <tr><td style="padding:18px 28px 28px;font-family:Geist,Inter,Arial,sans-serif;font-size:12.5px;line-height:1.5;color:#6B7280;">${footer || ""}<br><br>Gigin · You're getting this because you applied to a gig on giginmusic.com and asked to keep your details as a profile.</td></tr>
        </table>
      </td></tr>
    </table>`;
}

async function sendMail({ to, subject, text, html, replyTo }) {
  const doc = {
    to,
    from: MAIL_FROM,
    message: { subject, text, html },
  };
  if (replyTo) doc.replyTo = replyTo;
  return queueMail(doc);
}

async function uniqueSlug(name) {
  const root = slugify(name);
  const snap = await db.collection("artistProfiles").where("slug", ">=", root).where("slug", "<=", `${root}\uf8ff`).limit(20).get();
  const taken = new Set(snap.docs.map((doc) => doc.data()?.slug).filter(Boolean));
  return nextSlug(root, taken);
}

export async function issueToken(fields, days = CONFIRM_DAYS) {
  const raw = crypto.randomBytes(32).toString("hex");
  const hash = hashToken(raw);
  await db.doc(`profileTokens/${hash}`).set({
    hash,
    ...fields,
    expiresAt: daysFromNow(days),
    usedAt: null,
    createdAt: new Date().toISOString(),
  });
  return raw;
}

export async function readToken(raw) {
  if (!raw || String(raw).length < 32) return null;
  const snap = await db.doc(`profileTokens/${hashToken(raw)}`).get();
  if (!snap.exists) return null;
  return { id: snap.id, ref: snap.ref, ...(snap.data() || {}) };
}

function tokenState(token) {
  if (!token) return "missing";
  if (token.usedAt) return "used";
  if (token.expiresAt && new Date(token.expiresAt).getTime() < Date.now()) return "expired";
  return "ok";
}

async function loadProfile(id) {
  if (!id) return null;
  const snap = await db.doc(`artistProfiles/${id}`).get();
  if (!snap.exists) return null;
  return { id: snap.id, ref: snap.ref, ...(snap.data() || {}) };
}

async function loadBySlugOrId(key) {
  const bySlug = await db.collection("artistProfiles").where("slug", "==", String(key || "")).limit(1).get();
  if (!bySlug.empty) return { id: bySlug.docs[0].id, ref: bySlug.docs[0].ref, ...(bySlug.docs[0].data() || {}) };
  return loadProfile(key);
}

async function loadContact(profileId) {
  const snap = await db.doc(`artistProfiles/${profileId}/private/contact`).get();
  return snap.exists ? snap.data() || {} : {};
}

async function loadRelationships(profileId) {
  const snap = await db.doc(`artistProfiles/${profileId}/private/relationships`).get();
  return snap.exists ? snap.data() || {} : {};
}

async function signPath(path, minutes = 60 * 24 * 7) {
  if (!path) return "";
  try {
    const [url] = await admin.storage().bucket().file(path).getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + minutes * 60 * 1000,
    });
    return url;
  } catch {
    return "";
  }
}

async function withHeroUrl(profile) {
  if (profile?.heroMedia?.path) {
    profile.heroMedia = { ...profile.heroMedia, url: await signPath(profile.heroMedia.path) };
  }
  return profile;
}

export async function publicProfileView(key) {
  const doc = await loadBySlugOrId(key);
  if (!doc || !isPubliclyReadableStatus(doc.status) || doc.status === "deleted" || doc.status === "hidden" || doc.status === "pending") {
    return null;
  }
  if (doc.status && doc.status !== "live") return null;
  const profile = await withHeroUrl(toPublicProfile(doc, doc.id));
  return profile;
}

function namedMembers(members) {
  return (Array.isArray(members) ? members : []).filter((member) => String(member?.name || "").trim());
}

function profileBodyFromGuest(guest, email) {
  const links = guest.links || {};
  const members = namedMembers(guest.members);
  const photo = guest.photo || null;
  const tech = buildGuestTechRider({ needs: guest.needs, bringOwn: guest.bringOwn, members });
  const hasTech = (tech.guestNeeds || []).length > 0 || (tech.bringOwn || []).length > 0;
  return {
    name: guest.name || guest.actName || guest.artistName || "Artist",
    heroMedia: photo?.path ? { path: photo.path, name: photo.name || "", contentType: photo.contentType || "" } : null,
    bio: "",
    spotifyUrl: links.spotify || "",
    youtubeUrl: links.youtube || "",
    instagramUrl: links.instagram || guest.instagram || "",
    websiteUrl: links.website || "",
    members,
    techRider: hasTech ? tech : null,
    publicFields: {
      photo: Boolean(photo?.path),
      bio: false,
      links: Boolean(links.spotify || links.youtube || links.instagram || links.website || guest.instagram),
      members: members.length > 0,
      tech: hasTech,
    },
    contact: {
      email: emailNorm(email || guest.email),
      phone: guest.phone || null,
      whatsapp: guest.whatsapp === true,
      contactName: guest.contactName || "",
    },
  };
}

async function writeProfileDocs(profileId, body, guest) {
  const slug = await uniqueSlug(body.name);
  const venueId = guest.venueId || null;
  await db.doc(`artistProfiles/${profileId}`).set({
    name: body.name,
    slug,
    source: "guest_keep",
    status: "pending",
    publicFields: body.publicFields,
    heroMedia: body.heroMedia,
    bio: body.bio || "",
    spotifyUrl: body.spotifyUrl || "",
    youtubeUrl: body.youtubeUrl || "",
    instagramUrl: body.instagramUrl || "",
    websiteUrl: body.websiteUrl || "",
    members: body.members || [],
    techRider: body.techRider || null,
    playedAt: [],
    guestApplicationIds: guest.id ? [{ id: guest.id, gigId: guest.gigId || null }] : [],
    userId: null,
    venueName: guest.venueName || "",
    createdAt: new Date().toISOString(),
    confirmedAt: null,
  });
  await db.doc(`artistProfiles/${profileId}/private/contact`).set(body.contact);
  await rememberProfileEmail(db, profileId, body.contact.email);
  const venues = {};
  if (venueId) venues[venueId] = { applied: true, bookings: [] };
  await db.doc(`artistProfiles/${profileId}/private/relationships`).set({
    venues,
    invitedVenueIds: guest.inviteId && venueId ? [venueId] : [],
  });
  return slug;
}

async function stampGuest(gigId, applicantId, patch) {
  if (!gigId || !applicantId) return;
  await db.doc(`gigs/${gigId}/guestApplicants/${applicantId}`).set(patch, { merge: true });
  const ref = db.doc(`gigs/${gigId}`);
  const snap = await ref.get();
  if (!snap.exists) return;
  const applicants = Array.isArray(snap.data()?.applicants) ? snap.data().applicants : [];
  if (!applicants.some((entry) => entry?.id === applicantId)) return;
  await ref.update({
    applicants: applicants.map((entry) => (entry?.id === applicantId ? { ...entry, artistProfileId: patch.artistProfileId || entry.artistProfileId, profileSlug: patch.profileSlug || entry.profileSlug } : entry)),
  });
}

async function confirmEmail({ to, actName, venueName, contactName, sections, token }) {
  const confirmUrl = `${APP_ORIGIN}/profile/confirm/${token}`;
  const chooseUrl = `${APP_ORIGIN}/profile/keep?t=${token}`;
  const list = sections.length ? sections.join(", ") : "Act name";
  const message = renderArtistEmail({
    subject: `Confirm your Gigin profile for ${actName}`,
    preheader: "Tap the link to confirm your email and create a password. Nothing is public until you do.",
    eyebrow: "CONFIRM YOUR PROFILE",
    heading: "Confirm your Gigin profile",
    paras: [
      `Hi ${escapeHtml(firstName(contactName || actName))},`,
      `You asked to keep the details from your application to ${escapeHtml(venueName || "the venue")} as a Gigin profile. Tap the button to confirm your email and create a password. Nothing is public until you do.`,
    ],
    boxes: [
      { label: "PUBLIC ON YOUR PROFILE", rows: [[escapeHtml(actName), escapeHtml(list || "Photo, links, band and tech rider")]] },
      { label: "PRIVATE", rows: [["Contact", "Your email and phone number. Venues contact you through Gigin."]] },
    ],
    button: ["Confirm my profile", confirmUrl],
    orange: true,
    after: ["Want to change what's public first?", "Choose what's public", chooseUrl],
    small: "This link works once and expires in 7 days. If you didn't ask for this, ignore this email and nothing will be published.",
    footer: "You're getting this because you applied to a gig on giginmusic.com and asked to keep your details as a profile.",
  });
  await sendMail({ to, ...message });
}

export async function keepProfileForGuest({ guest, gigId, email }) {
  const address = emailNorm(email || guest.email);
  if (!address) {
    const error = new Error("Add an email so we can send the confirm link.");
    error.statusCode = 400;
    throw error;
  }
  if (guest.artistProfileId) {
    const existing = await loadProfile(guest.artistProfileId);
    if (existing && existing.status !== "deleted") {
      if (existing.status === "live") {
        return { status: "live", slug: existing.slug, email: address };
      }
      const token = await issueToken({ profileId: existing.id, kind: "confirm" }, CONFIRM_DAYS);
      await confirmEmail({
        to: address,
        actName: existing.name,
        venueName: guest.venueName,
        contactName: guest.contactName,
        sections: enabledSections(existing),
        token,
      });
      await stampGuest(gigId, guest.id, { artistProfileId: existing.id, profileSlug: existing.slug, keepProfileOffer: "sent" });
      return { status: "sent", email: address, slug: existing.slug, confirmToken: token };
    }
  }
  const body = profileBodyFromGuest(guest, address);
  const profileId = crypto.randomUUID();
  const slug = await writeProfileDocs(profileId, body, { ...guest, gigId });
  const token = await issueToken({ profileId, kind: "confirm", gigId, applicantId: guest.id }, CONFIRM_DAYS);
  await confirmEmail({
    to: address,
    actName: body.name,
    venueName: guest.venueName,
    contactName: guest.contactName,
    sections: enabledSections({ ...body, publicFields: body.publicFields, techRider: body.techRider }),
    token,
  });
  await stampGuest(gigId, guest.id, { artistProfileId: profileId, profileSlug: slug, keepProfileOffer: "sent" });
  return { status: "sent", email: address, slug, profileId, confirmToken: token };
}

export async function dismissKeepOffer({ gigId, applicantId }) {
  await stampGuest(gigId, applicantId, { keepProfileOffer: "dismissed" });
}

export async function pendingChoicesView(rawToken) {
  const token = await readToken(rawToken);
  const state = tokenState(token);
  if (state !== "ok" || token.kind !== "confirm") {
    const error = new Error(state === "expired" ? "expired" : state === "used" ? "used" : "missing");
    error.statusCode = state === "expired" ? 410 : state === "used" ? 409 : 404;
    error.code = error.message;
    throw error;
  }
  const profile = await loadProfile(token.profileId);
  if (!profile || profile.status === "deleted") {
    const error = new Error("missing");
    error.statusCode = 404;
    error.code = "missing";
    throw error;
  }
  const tech = profile.techRider || {};
  const needs = Array.isArray(tech.guestNeeds) ? tech.guestNeeds : [];
  const bring = Array.isArray(tech.bringOwn) ? tech.bringOwn : [];
  return {
    name: profile.name || "",
    venueName: profile.venueName || "the venue",
    photoName: profile.heroMedia?.name || "",
    hasPhoto: Boolean(profile.heroMedia?.path || profile.heroMedia?.url),
    bio: profile.bio || "",
    links: [
      profile.spotifyUrl ? "Spotify" : "",
      profile.youtubeUrl ? "YouTube" : "",
      profile.instagramUrl ? "Instagram" : "",
      profile.websiteUrl ? "Website" : "",
    ].filter(Boolean),
    memberNames: namedMembers(profile.members).map((member) => member.name),
    techLine: [...needs, ...bring].filter(Boolean).slice(0, 6).join(", "),
    publicFields: profile.publicFields || {},
  };
}

export async function savePendingChoices(rawToken, body) {
  const token = await readToken(rawToken);
  const state = tokenState(token);
  if (state !== "ok" || token.kind !== "confirm") {
    const error = new Error(state === "expired" ? "expired" : state === "used" ? "used" : "missing");
    error.statusCode = state === "expired" ? 410 : state === "used" ? 409 : 404;
    error.code = error.message;
    throw error;
  }
  const profile = await loadProfile(token.profileId);
  if (!profile || profile.status === "deleted") {
    const error = new Error("missing");
    error.statusCode = 404;
    throw error;
  }
  const fields = { ...(profile.publicFields || {}) };
  const incoming = body?.publicFields || {};
  for (const key of ["photo", "bio", "links", "members", "tech"]) {
    if (typeof incoming[key] === "boolean") fields[key] = incoming[key];
  }
  const patch = { publicFields: fields };
  if (typeof body?.bio === "string") {
    patch.bio = body.bio.slice(0, 600);
    if (patch.bio.trim()) fields.bio = fields.bio !== false;
  }
  await profile.ref.set(patch, { merge: true });
  return { ok: true };
}

async function openSession(profileId, { editor = false } = {}) {
  const raw = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  await db.doc(`profileSessions/${hashToken(raw)}`).set({
    profileId,
    expiresAt: new Date(now + DEVICE_DAYS * 86400000).toISOString(),
    editorUntil: editor ? new Date(now + EDITOR_DAYS * 86400000).toISOString() : null,
    createdAt: new Date().toISOString(),
  });
  return raw;
}

export async function readSession(req, { editor = false } = {}) {
  const raw = parseCookies(req)[COOKIE];
  if (!raw) return null;
  const snap = await db.doc(`profileSessions/${hashToken(raw)}`).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  if (!data.expiresAt || new Date(data.expiresAt).getTime() < Date.now()) return null;
  if (editor && (!data.editorUntil || new Date(data.editorUntil).getTime() < Date.now())) return null;
  const profile = await loadProfile(data.profileId);
  if (!profile || profile.status === "deleted") return null;
  return { session: data, profile, ref: snap.ref };
}

function authProviders(userRecord) {
  const providers = (userRecord?.providerData || []).map((row) => row.providerId);
  return {
    hasPassword: providers.includes("password"),
    hasGoogle: providers.includes("google.com"),
  };
}

async function authUserByEmail(email) {
  try {
    return await admin.auth().getUserByEmail(email);
  } catch (error) {
    if (error?.code === "auth/user-not-found") return null;
    throw error;
  }
}

function claimError(action, extra = {}) {
  const error = new Error(action);
  error.code = action;
  error.statusCode = action === "expired" ? 410 : action === "weak-password" ? 400 : action === "forbidden" ? 403 : action === "missing" ? 404 : 409;
  Object.assign(error, extra);
  return error;
}

export async function inspectConfirmToken(rawToken) {
  const token = await readToken(rawToken);
  const state = !token || token.kind !== "confirm" ? "missing" : tokenState(token);
  if (state === "missing") {
    const error = claimError("missing");
    throw error;
  }
  const profile = await loadProfile(token.profileId);
  if (!profile) throw claimError("missing");
  if (state === "used") throw claimError("used", { slug: profile.slug || null });
  if (state === "expired") throw claimError("expired");
  const contact = await loadContact(profile.id);
  const email = emailNorm(contact.email);
  const existing = email ? await authUserByEmail(email) : null;
  return {
    actName: profile.name || "",
    email,
    slug: profile.slug || "",
    hasAccount: Boolean(existing),
    ...authProviders(existing),
  };
}

export async function claimProfileAccount({ rawToken, password, authUser }) {
  const token = await readToken(rawToken);
  const state = !token || token.kind !== "confirm" ? "missing" : tokenState(token);
  if (state !== "ok") {
    const profile = token?.profileId ? await loadProfile(token.profileId) : null;
    throw claimError(state === "used" || state === "expired" ? state : "missing", { slug: profile?.slug || null });
  }
  const profile = await loadProfile(token.profileId);
  if (!profile || profile.status === "deleted") throw claimError("missing");
  const contact = await loadContact(profile.id);
  const email = emailNorm(contact.email);
  if (!email) throw claimError("missing");
  const existing = await authUserByEmail(email);
  const decision = confirmClaimDecision({
    tokenState: "ok",
    hasAuthUser: Boolean(existing),
    signedInUid: authUser?.uid || null,
    existingUid: existing?.uid || null,
    signedInEmail: emailNorm(authUser?.email),
    profileEmail: email,
  });
  if (decision.action === "login") throw claimError("account", authProviders(existing));
  if (decision.action === "forbidden") throw claimError("forbidden");
  let userRecord = existing;
  if (decision.action === "create") {
    if (!passwordAcceptable(password)) throw claimError("weak-password");
    try {
      userRecord = await admin.auth().createUser({
        email,
        password: String(password),
        emailVerified: true,
        displayName: contact.contactName || profile.name || "",
      });
    } catch (error) {
      if (error?.code === "auth/email-already-exists") throw claimError("account", { hasPassword: true, hasGoogle: false });
      if (error?.code === "auth/invalid-password" || error?.code === "auth/weak-password") throw claimError("weak-password");
      throw error;
    }
  }
  const uid = userRecord.uid;
  await db.doc(`users/${uid}`).set({
    name: contact.contactName || profile.name || "",
    artistProfiles: FieldValue.arrayUnion(profile.id),
  }, { merge: true });
  await profile.ref.set({
    userId: uid,
    status: "live",
    confirmedAt: new Date().toISOString(),
  }, { merge: true });
  await token.ref.set({ usedAt: new Date().toISOString() }, { merge: true });
  if (token.gigId && token.applicantId) {
    await stampGuest(token.gigId, token.applicantId, {
      artistProfileId: profile.id,
      profileSlug: profile.slug,
      keepProfileOffer: "confirmed",
    });
  }
  return { slug: profile.slug, url: profileUrl(profile.slug), profileId: profile.id, email };
}

export async function resendConfirm(rawToken) {
  const token = await readToken(rawToken);
  if (!token?.profileId) return { ok: true, maskedEmail: "" };
  const profile = await loadProfile(token.profileId);
  const contact = profile ? await loadContact(profile.id) : {};
  const email = emailNorm(contact.email);
  if (profile && email && profile.status === "pending") {
    const next = await issueToken({ profileId: profile.id, kind: "confirm", gigId: token.gigId || null, applicantId: token.applicantId || null }, CONFIRM_DAYS);
    await confirmEmail({
      to: email,
      actName: profile.name,
      venueName: "the venue",
      contactName: contact.contactName,
      sections: enabledSections(profile),
      token: next,
    });
  }
  return { ok: true, maskedEmail: maskEmail(email) };
}

export async function sendEditLink({ email, profileId }) {
  let target = null;
  const address = emailNorm(email);
  if (profileId) target = await loadProfile(profileId);
  if (!target && address) target = await profileByEmail(address);
  if (!target || target.status === "deleted") return { ok: true };
  const contact = await loadContact(target.id);
  const to = emailNorm(contact.email || address);
  if (!to) return { ok: true };
  const token = await issueToken({ profileId: target.id, kind: "edit" }, CONFIRM_DAYS);
  const url = `${APP_ORIGIN}/profile/edit/${token}`;
  await sendMail({
    to,
    subject: `Edit your Gigin profile for ${target.name || "your act"}`,
    text: `Edit your profile: ${url}`,
    html: emailShell({
      title: "Edit your Gigin profile",
      inner: `<p>Hi ${escapeHtml(firstName(contact.contactName || target.name))},</p><p>Use this link to edit, hide or delete your profile. It works once.</p>`,
      buttonLabel: "Edit my profile",
      buttonUrl: url,
      orange: true,
      footer: "This link works once. Hide or delete your profile from the editor.",
    }),
  });
  return { ok: true };
}

export async function consumeEditToken(rawToken) {
  const token = await readToken(rawToken);
  const state = tokenState(token);
  if (!token || token.kind !== "edit") {
    const error = new Error("missing");
    error.statusCode = 404;
    error.code = "missing";
    throw error;
  }
  if (state === "used" || state === "expired") {
    const error = new Error(state);
    error.statusCode = state === "expired" ? 410 : 409;
    error.code = state;
    throw error;
  }
  await token.ref.set({ usedAt: new Date().toISOString() }, { merge: true });
  const cookie = await openSession(token.profileId, { editor: true });
  return { cookie, profileId: token.profileId };
}

export async function editorFromRequest(req) {
  const session = await readSession(req, { editor: true });
  if (session?.profile) return session.profile;
  if (!req.auth?.uid) return null;
  const snap = await db.collection("artistProfiles").where("userId", "==", req.auth.uid).limit(1).get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ref: snap.docs[0].ref, ...(snap.docs[0].data() || {}) };
}

export async function sessionProfile(req, { editor = false } = {}) {
  const found = await readSession(req, { editor });
  if (!found) return null;
  const contact = await loadContact(found.profile.id);
  const relationships = await loadRelationships(found.profile.id);
  const profile = await withHeroUrl(toEditorProfile(found.profile, found.profile.id));
  return {
    profile,
    contact: {
      email: contact.email || "",
      phone: contact.phone || "",
      whatsapp: contact.whatsapp === true,
      contactName: contact.contactName || "",
    },
    invitedVenueIds: relationships.invitedVenueIds || [],
    status: found.profile.status,
    editor: Boolean(found.session.editorUntil) && new Date(found.session.editorUntil).getTime() > Date.now(),
    pressKitRightsConfirmedAt: found.profile.pressKitRightsConfirmedAt || null,
    homeWelcomeDismissedAt: found.profile.homeWelcomeDismissedAt || null,
  };
}

export async function ownerPayload(profile) {
  const contact = await loadContact(profile.id);
  return {
    profile: await withHeroUrl(toEditorProfile(profile, profile.id)),
    contact: {
      email: contact.email || "",
      phone: contact.phone || "",
      whatsapp: contact.whatsapp === true,
      contactName: contact.contactName || "",
    },
    editor: true,
    status: profile.status || "live",
    pressKitRightsConfirmedAt: profile.pressKitRightsConfirmedAt || null,
    homeWelcomeDismissedAt: profile.homeWelcomeDismissedAt || null,
  };
}

export async function updateOwnProfile(profile, body) {
  const patch = {};
  if (typeof body.bio === "string") patch.bio = body.bio.slice(0, 600);
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 80);
  for (const key of ["spotifyUrl", "youtubeUrl", "instagramUrl", "websiteUrl"]) {
    if (typeof body[key] === "string") patch[key] = body[key].slice(0, 300);
  }
  if (Array.isArray(body.members)) {
    patch.members = body.members
      .filter((member) => member && String(member.name || "").trim())
      .map((member) => ({ name: String(member.name).slice(0, 80), instruments: Array.isArray(member.instruments) ? member.instruments.slice(0, 12) : [] }));
  }
  if (body.techRider) patch.techRider = body.techRider;
  if (body.heroMedia && body.heroMedia.path) patch.heroMedia = { path: body.heroMedia.path, name: body.heroMedia.name || "", contentType: body.heroMedia.contentType || "" };
  if (body.removePhoto) patch.heroMedia = null;
  if (body.publicFields && typeof body.publicFields === "object") patch.publicFields = { ...(profile.publicFields || {}), ...body.publicFields };
  if (body.visibility === "hidden") patch.status = "hidden";
  if (body.visibility === "public" && profile.status !== "deleted" && profile.status !== "pending") patch.status = "live";
  if (body.homeWelcomeDismissed) patch.homeWelcomeDismissedAt = new Date().toISOString();
  if (body.pressKitRights) patch.pressKitRightsConfirmedAt = new Date().toISOString();
  await profile.ref.set(patch, { merge: true });
  if (body.contact && typeof body.contact === "object") {
    const next = {};
    if (typeof body.contact.phone === "string") next.phone = body.contact.phone;
    if (typeof body.contact.whatsapp === "boolean") next.whatsapp = body.contact.whatsapp;
    if (typeof body.contact.contactName === "string") next.contactName = body.contact.contactName.slice(0, 80);
    if (Object.keys(next).length) await db.doc(`artistProfiles/${profile.id}/private/contact`).set(next, { merge: true });
  }
  return loadProfile(profile.id);
}

export async function hideProfile(profile) {
  await profile.ref.set({ status: "hidden" }, { merge: true });
}

export async function deleteProfile(profile) {
  const contact = await loadContact(profile.id);
  await forgetProfileEmail(db, contact.email);
  await profile.ref.set({
    status: "deleted",
    bio: "",
    heroMedia: null,
    members: [],
    techRider: null,
    spotifyUrl: "",
    youtubeUrl: "",
    instagramUrl: "",
    websiteUrl: "",
    contactEmailHash: FieldValue.delete(),
    deletedAt: new Date().toISOString(),
  }, { merge: true });
  await db.doc(`artistProfiles/${profile.id}/private/contact`).delete().catch(() => {});
}

export async function forgetSession(req) {
  const raw = parseCookies(req)[COOKIE];
  if (!raw) return;
  await db.doc(`profileSessions/${hashToken(raw)}`).delete().catch(() => {});
}

async function relationshipFor(profileId, venueId, email) {
  const stored = (await loadRelationships(profileId)).venues?.[venueId] || {};
  let applied = stored.applied === true;
  let booked = (stored.bookings || []).some((row) => row.status === "confirmed");
  let cancelled = (stored.bookings || []).some((row) => row.status === "cancelled");
  let bookedDate = (stored.bookings || []).find((row) => row.status === "confirmed")?.date || null;
  let cancelledDate = (stored.bookings || []).find((row) => row.status === "cancelled")?.date || null;
  const invited = ((await loadRelationships(profileId)).invitedVenueIds || []).includes(venueId);
  const gigs = await db.collection("gigs").where("venueId", "==", venueId).limit(80).get();
  for (const doc of gigs.docs) {
    const data = doc.data() || {};
    const applicants = Array.isArray(data.applicants) ? data.applicants : [];
    for (const applicant of applicants) {
      let hit = applicant?.id === profileId || applicant?.linkedArtistId === profileId || applicant?.artistProfileId === profileId;
      if (!hit && email && (applicant?.type === "guest" || applicant?.guest)) {
        const priv = await db.doc(`gigs/${doc.id}/guestApplicants/${applicant.id}`).get();
        hit = emailNorm(priv.data()?.email) === email;
      }
      if (!hit) continue;
      applied = true;
      const status = String(applicant.status || "").toLowerCase();
      if (["confirmed", "accepted", "paid"].includes(status) && !applicant.withdrawnAfterAccept) {
        booked = true;
        bookedDate = bookedDate || data.date || data.startDateTime || null;
      }
      if (applicant.withdrawnAfterAccept) {
        cancelled = true;
        cancelledDate = cancelledDate || data.date || null;
      }
    }
  }
  return { applied, booked, cancelled, bookedDate, cancelledDate, invited };
}

export async function artistContactForVenue({ profileId, venueId }) {
  const profile = await loadProfile(profileId);
  if (!profile || profile.status === "pending" || profile.status === "deleted") {
    const error = new Error("not_found");
    error.statusCode = 404;
    throw error;
  }
  const contact = await loadContact(profileId);
  const rel = await relationshipFor(profileId, venueId, emailNorm(contact.email));
  const decision = artistContactDecision(rel);
  if (!decision.allow) {
    const error = new Error("forbidden");
    error.statusCode = 403;
    throw error;
  }
  return {
    email: contact.email || "",
    phone: contact.phone || "",
    whatsapp: contact.whatsapp === true,
    reason: decision.reason,
    bookedDate: rel.bookedDate || null,
    venueName: "",
  };
}

export async function pressKitAccess(profileId, venueId) {
  const profile = await loadProfile(profileId);
  if (!profile) return { state: "locked", http: 404, reason: "not_booked", files: [] };
  const contact = await loadContact(profileId);
  const rel = await relationshipFor(profileId, venueId, emailNorm(contact.email));
  const assets = await db.collection(`artistProfiles/${profileId}/pressKit`).get();
  const shared = assets.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter((asset) => asset.shareWithBookedVenues !== false && (asset.kind === "bio" || asset.path || asset.bioText));
  const decision = pressKitDecision({
    booked: rel.booked && !rel.cancelled,
    cancelled: rel.cancelled && !rel.booked,
    empty: shared.length === 0,
  });
  return { ...decision, files: decision.state === "active" || decision.state === "empty" ? shared : [], cancelledDate: rel.cancelledDate, actName: profile.name, slug: profile.slug };
}

export async function listOwnPressKit(profileId) {
  const snap = await db.collection(`artistProfiles/${profileId}/pressKit`).get();
  const files = [];
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    files.push({
      id: doc.id,
      ...data,
      url: data.path ? await signPath(data.path, 30) : "",
    });
  }
  return files;
}

const PRESS_LIMITS = {
  logo: { types: ["image/png", "image/svg+xml"], max: 25 * 1024 * 1024, count: 1 },
  photo: { types: ["image/jpeg", "image/png"], max: 25 * 1024 * 1024, count: 8 },
  video: { types: ["video/mp4", "video/quicktime"], max: 500 * 1024 * 1024, count: 4 },
  bio: { count: 1 },
};

export function pressKitKindOk(kind, contentType, size, existingCount) {
  const rule = PRESS_LIMITS[kind];
  if (!rule) return "Unknown press kit file.";
  if (existingCount >= rule.count) return "That section is full.";
  if (kind === "bio") return "";
  if (!rule.types.includes(String(contentType || "").toLowerCase())) return "That file type isn't allowed here.";
  if (Number(size) > rule.max) return "That file is too large.";
  return "";
}

export async function savePressAsset(profileId, asset) {
  const id = asset.id || crypto.randomUUID();
  await db.doc(`artistProfiles/${profileId}/pressKit/${id}`).set({
    kind: asset.kind,
    name: asset.name || "",
    size: Number(asset.size) || 0,
    contentType: asset.contentType || "",
    path: asset.path || null,
    width: asset.width || null,
    height: asset.height || null,
    durationSec: asset.durationSec || null,
    credit: asset.credit || "",
    bioText: asset.bioText || "",
    shareWithBookedVenues: asset.shareWithBookedVenues !== false,
    uploadedAt: new Date().toISOString(),
  }, { merge: true });
  return id;
}

export async function removePressAsset(profileId, assetId) {
  const ref = db.doc(`artistProfiles/${profileId}/pressKit/${assetId}`);
  const snap = await ref.get();
  if (snap.exists && snap.data()?.path) {
    await admin.storage().bucket().file(snap.data().path).delete().catch(() => {});
  }
  await ref.delete();
}

export async function logPressDownload({ profileId, venueId, userId }) {
  await db.collection(`artistProfiles/${profileId}/pressKitDownloads`).add({
    venueId,
    userId: userId || null,
    at: new Date().toISOString(),
  });
}

export async function askForPressKit({ profileId, venueId }) {
  const key = hashToken(`${venueId}:${profileId}`);
  const ref = db.doc(`pressKitRequests/${key}`);
  const prev = await ref.get();
  if (prev.exists) {
    const at = new Date(prev.data()?.at || 0).getTime();
    if (Date.now() - at < 30 * 86400000) return { ok: true, already: true };
  }
  const contact = await loadContact(profileId);
  const profile = await loadProfile(profileId);
  if (contact.email && profile) {
    await sendMail({
      to: contact.email,
      subject: `A venue asked for your press kit`,
      text: "A venue that has booked you asked for a press kit on Gigin.",
      html: emailShell({
        title: "A venue asked for your press kit",
        inner: `<p>Hi ${escapeHtml(firstName(contact.contactName || profile.name))},</p><p>A venue you've been booked by asked for files they can use to promote the gig. Add them from your press kit. Only venues who have booked you can download what you switch on.</p>`,
        buttonLabel: "Set up press kit",
        buttonUrl: `${APP_ORIGIN}/profile/press-kit`,
        orange: true,
        footer: "",
      }),
    });
  }
  await ref.set({ venueId, profileId, at: new Date().toISOString() });
  return { ok: true };
}

export async function noteProfileApplication({ profileId, venueId, gigId, applicantId, inviteId }) {
  const profile = await loadProfile(profileId);
  if (!profile || profile.status === "deleted") return;
  const rel = await loadRelationships(profileId);
  const venues = { ...(rel.venues || {}) };
  if (venueId) {
    venues[venueId] = { ...(venues[venueId] || {}), applied: true, bookings: venues[venueId]?.bookings || [] };
  }
  const invitedVenueIds = Array.isArray(rel.invitedVenueIds) ? [...rel.invitedVenueIds] : [];
  if (inviteId && venueId && !invitedVenueIds.includes(venueId)) invitedVenueIds.push(venueId);
  await db.doc(`artistProfiles/${profileId}/private/relationships`).set({ venues, invitedVenueIds }, { merge: true });
  const existing = Array.isArray(profile.guestApplicationIds) ? profile.guestApplicationIds : [];
  if (!existing.some((entry) => (entry?.id || entry) === applicantId)) {
    existing.push({ id: applicantId, gigId: gigId || null });
    await profile.ref.set({ guestApplicationIds: existing }, { merge: true });
  }
}

export async function appendPlayedAt({ profileId, venueId, venueName, city, gigId, date }) {
  if (!profileId) return;
  const profile = await loadProfile(profileId);
  if (!profile || profile.status === "deleted") return;
  const playedAt = Array.isArray(profile.playedAt) ? profile.playedAt : [];
  if (!playedAt.some((row) => row.gigId === gigId)) {
    playedAt.push({ venueId: venueId || null, venueName: venueName || "", city: city || "", gigId, date: date || null, confirmedAt: new Date().toISOString() });
    await profile.ref.set({ playedAt }, { merge: true });
  }
  if (venueId) {
    const rel = await loadRelationships(profileId);
    const venues = { ...(rel.venues || {}) };
    const current = venues[venueId] || { applied: true, bookings: [] };
    const bookings = Array.isArray(current.bookings) ? current.bookings.filter((row) => row.gigId !== gigId) : [];
    bookings.push({ gigId, date: date || null, status: "confirmed" });
    venues[venueId] = { ...current, applied: true, bookings };
    await db.doc(`artistProfiles/${profileId}/private/relationships`).set({ venues }, { merge: true });
  }
}

export async function markBookingCancelled({ profileId, venueId, gigId, date }) {
  if (!profileId || !venueId) return;
  const rel = await loadRelationships(profileId);
  const venues = { ...(rel.venues || {}) };
  const current = venues[venueId] || { applied: true, bookings: [] };
  const bookings = (current.bookings || []).map((row) => (row.gigId === gigId ? { ...row, status: "cancelled", date: date || row.date } : row));
  if (!bookings.some((row) => row.gigId === gigId)) bookings.push({ gigId, date: date || null, status: "cancelled" });
  venues[venueId] = { ...current, bookings };
  await db.doc(`artistProfiles/${profileId}/private/relationships`).set({ venues }, { merge: true });
}

export async function profileHasLive(profileId) {
  const profile = await loadProfile(profileId);
  return Boolean(profile && profile.status === "live");
}

export async function reminderCount(email) {
  const address = emailNorm(email);
  if (!address) return 2;
  const snap = await db.doc(`profileReminders/${hashToken(address)}`).get();
  return Number(snap.data()?.count) || 0;
}

export async function keepReminderHtml({ email, artistProfileId, keepProfileOffer, gigId, applicantId, actName, venueName }) {
  const address = emailNorm(email);
  if (!address || !gigId || !applicantId) return "";
  const hasLiveProfile = artistProfileId ? await profileHasLive(artistProfileId) : false;
  const count = await reminderCount(address);
  if (!reminderEligible({ keepProfileOffer, hasLiveProfile, reminderCount: count })) return "";
  const token = await issueToken({ kind: "nudge", gigId, applicantId, email: address }, 30);
  await db.doc(`profileReminders/${hashToken(address)}`).set({ count: count + 1, email: address }, { merge: true });
  const url = `${APP_ORIGIN}/profile/keep-from-email/${token}`;
  return `<table role="presentation" width="100%" style="background:#F6F7F9;border-radius:12px;margin-top:16px;"><tr><td style="padding:14px 16px;font-family:Geist,Inter,Arial,sans-serif;font-size:14px;line-height:1.5;color:#0F1115;"><strong>Keep your details for next time?</strong><br>Turn this application into a Gigin profile with a link you can send to other venues. You'll create a password when you confirm.<br><a href="${url}">Keep my profile</a></td></tr></table>`;
}

export async function redeemNudge(rawToken) {
  const token = await readToken(rawToken);
  const state = tokenState(token);
  if (!token || token.kind !== "nudge" || state !== "ok") return { ok: true, maskedEmail: "" };
  const privSnap = await db.doc(`gigs/${token.gigId}/guestApplicants/${token.applicantId}`).get();
  const gigSnap = await db.doc(`gigs/${token.gigId}`).get();
  const stub = ((gigSnap.data()?.applicants) || []).find((entry) => entry?.id === token.applicantId) || {};
  const guest = { ...(privSnap.data() || {}), ...stub, id: token.applicantId, gigId: token.gigId };
  const result = await keepProfileForGuest({ guest, gigId: token.gigId, email: token.email || guest.email });
  await token.ref.set({ usedAt: new Date().toISOString() }, { merge: true });
  return { ok: true, maskedEmail: maskEmail(result.email), status: result.status };
}

async function profileByEmail(address) {
  const id = await profileIdForEmail(db, address);
  return id ? loadProfile(id) : null;
}

export async function prefillHint(email) {
  const address = emailNorm(email);
  if (!address) return { hasProfile: false };
  const profile = await profileByEmail(address);
  if (!profile) return { hasProfile: false };
  return { hasProfile: profile.status === "live" || profile.status === "hidden" };
}

export async function sendPrefillLink(email) {
  const address = emailNorm(email);
  const hint = await prefillHint(address);
  if (!hint.hasProfile || !address) return { ok: true };
  const profile = await profileByEmail(address);
  if (!profile) return { ok: true };
  const token = await issueToken({ profileId: profile.id, kind: "prefill" }, CONFIRM_DAYS);
  const url = `${APP_ORIGIN}/profile/prefill/${token}`;
  await sendMail({
    to: address,
    subject: "Fill in your Gigin application from your profile",
    text: `Use your profile to fill in the application: ${url}`,
    html: emailShell({
      title: "Fill this in from your profile",
      inner: `<p>You have a Gigin profile. This link fills the application from it on this phone. It works once.</p>`,
      buttonLabel: "Use my profile",
      buttonUrl: url,
      orange: true,
      footer: "",
    }),
  });
  return { ok: true };
}

export async function consumePrefill(rawToken) {
  const token = await readToken(rawToken);
  if (!token || token.kind !== "prefill" || tokenState(token) !== "ok") {
    const error = new Error(tokenState(token) || "missing");
    error.statusCode = 410;
    throw error;
  }
  await token.ref.set({ usedAt: new Date().toISOString() }, { merge: true });
  const cookie = await openSession(token.profileId, { editor: false });
  return { cookie };
}

function viewerSignedIn(req, session) {
  return Boolean(req.auth?.uid || session?.profile);
}

export async function finderVenues(req) {
  const session = await readSession(req).catch(() => null);
  const signedIn = viewerSignedIn(req, session);
  let invited = [];
  if (session?.profile) {
    invited = (await loadRelationships(session.profile.id)).invitedVenueIds || [];
  }
  const listedSnap = await db.collection("listedVenues").where("city", "==", "Cambridge").limit(50).get();
  const onSnap = await db.collection("venueProfiles").where("finderListing.listed", "==", true).limit(50).get();
  const rows = [];
  listedSnap.forEach((doc) => {
    const data = doc.data() || {};
    if (!String(data.name || "").trim()) return;
    rows.push(presentVenue({
      id: doc.id,
      listed: true,
      data,
      signedIn,
      invited: false,
    }));
  });
  for (const doc of onSnap.docs) {
    const data = doc.data() || {};
    const city = data.address?.city || data.city || data.finderListing?.city || "";
    if (city && !/cambridge/i.test(city) && !/cambridge/i.test(data.finderListing?.area || "")) continue;
    rows.push(await presentOnGigin(doc.id, data, signedIn, invited.includes(doc.id)));
  }
  return { venues: rows, signedIn: Boolean(signedIn), area: "Cambridge" };
}

function latLng(location) {
  if (!location) return null;
  if (typeof location.latitude === "number") return { lat: location.latitude, lng: location.longitude };
  if (typeof location.lat === "number") return { lat: location.lat, lng: location.lng };
  if (location._latitude != null) return { lat: location._latitude, lng: location._longitude };
  return null;
}

function presentVenue({ id, listed, data, signedIn, invited }) {
  const decision = venueContactDecision({
    visibility: "signed_in",
    signedIn,
    invited,
    listed: true,
  });
  const contact = { state: decision.show, carrot: Boolean(decision.carrot) };
  if (decision.show === "website" && data.websiteEmail) {
    contact.email = data.websiteEmail;
    contact.note = `From ${data.name}'s website. The venue hasn't checked it.`;
  }
  return {
    id,
    kind: "listed",
    name: data.name || "",
    area: data.area || "",
    city: data.city || "Cambridge",
    street: data.street || "",
    location: latLng(data.location),
    hasPA: data.hasPA,
    soundSummary: data.soundSummary || "",
    capacity: data.capacity ?? null,
    dealModel: data.dealModel || "",
    dealLabel: dealText(data.dealModel, data.dealLabel),
    howTheyBook: bookText(data.howTheyBook),
    howTheyBookRaw: data.howTheyBook || "",
    takesOriginals: data.takesOriginals,
    genres: data.genres || [],
    websiteUrl: data.websiteUrl || "",
    source: data.source || "public_info",
    checkedAt: data.checkedAt || null,
    heroPhoto: data.heroPhoto || "",
    contact,
  };
}

async function presentOnGigin(id, data, signedIn, invited) {
  const listing = data.finderListing || {};
  const visibility = data.contactVisibility || "signed_in";
  const decision = venueContactDecision({ visibility, signedIn, invited, listed: false });
  const contact = { state: decision.show, carrot: Boolean(decision.carrot), visibility };
  if (decision.show === "open") {
    const priv = await db.doc(`venueProfiles/${id}/private/finderContact`).get();
    const raw = priv.exists ? priv.data() || {} : {};
    contact.bookerName = raw.bookerName || "";
    contact.role = raw.role || "";
    contact.email = raw.email || "";
    contact.phone = raw.phone || "";
  }
  return {
    id,
    kind: "gigin",
    name: data.name || data.venueName || "",
    area: listing.area || data.address?.city || "",
    city: data.address?.city || data.city || "Cambridge",
    street: listing.street || data.address?.line1 || data.address?.addressLine1 || "",
    location: latLng(data.location || data.coordinates),
    hasPA: listing.hasPA ?? null,
    soundSummary: listing.soundSummary || "",
    capacity: listing.capacity ?? data.capacity ?? null,
    dealModel: listing.dealModel || "",
    dealLabel: dealText(listing.dealModel, listing.dealLabel),
    howTheyBook: bookText(listing.howTheyBook),
    howTheyBookRaw: listing.howTheyBook || "",
    takesOriginals: listing.takesOriginals ?? null,
    genres: listing.genres || [],
    websiteUrl: listing.websiteUrl || data.website || "",
    source: "venue",
    checkedAt: listing.updatedAt || null,
    heroPhoto: data.photoUrl || data.heroImage || "",
    contact,
    contactVisibility: visibility,
  };
}

export async function venueContactPayload(venue, { signedIn, invited, listed }) {
  const decision = venueContactDecision({
    visibility: venue.contactVisibility || "signed_in",
    signedIn,
    invited,
    listed,
  });
  if (decision.show !== "open" && decision.show !== "website") {
    return { state: decision.show, carrot: Boolean(decision.carrot), visibility: venue.contactVisibility || "signed_in" };
  }
  if (listed || decision.show === "website") {
    return {
      state: "website",
      email: venue.websiteEmail || "",
      note: venue.name ? `From ${venue.name}'s website. The venue hasn't checked it.` : "",
    };
  }
  const priv = await db.doc(`venueProfiles/${venue.id}/private/finderContact`).get();
  const raw = priv.exists ? priv.data() || {} : {};
  return {
    state: "open",
    bookerName: raw.bookerName || "",
    role: raw.role || "",
    email: raw.email || "",
    phone: raw.phone || "",
    visibility: venue.contactVisibility || "signed_in",
  };
}

export async function saveFinderListing(venueId, body) {
  const listing = body.finderListing || {};
  const finderListing = {
    listed: listing.listed === true,
    hasPA: listing.hasPA === true,
    soundSummary: String(listing.soundSummary || "").slice(0, 240),
    capacity: listing.capacity == null || listing.capacity === "" ? null : Number(listing.capacity),
    dealModel: ["door", "fee", "split", "agreed", "room_hire"].includes(listing.dealModel) ? listing.dealModel : "",
    dealLabel: String(listing.dealLabel || "").slice(0, 80),
    howTheyBook: ["gigin", "email", "seasonal", "promoters"].includes(listing.howTheyBook) ? listing.howTheyBook : "",
    takesOriginals: listing.takesOriginals === true,
    genres: Array.isArray(listing.genres) ? listing.genres.map((item) => String(item).slice(0, 40)).slice(0, 12) : [],
    websiteUrl: String(listing.websiteUrl || "").slice(0, 300),
    area: String(listing.area || "").slice(0, 80),
    street: String(listing.street || "").slice(0, 120),
    updatedAt: new Date().toISOString(),
  };
  const visibility = ["signed_in", "invited", "nobody"].includes(body.contactVisibility) ? body.contactVisibility : "signed_in";
  await db.doc(`venueProfiles/${venueId}`).set({ finderListing, contactVisibility: visibility }, { merge: true });
  if (body.finderContact) {
    const contact = body.finderContact;
    await db.doc(`venueProfiles/${venueId}/private/finderContact`).set({
      bookerName: String(contact.bookerName || "").slice(0, 80),
      role: String(contact.role || "").slice(0, 80),
      email: emailNorm(contact.email),
      phone: String(contact.phone || "").slice(0, 40),
    });
  }
  return { ok: true };
}

export async function readFinderSettings(venueId) {
  const snap = await db.doc(`venueProfiles/${venueId}`).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  const priv = await db.doc(`venueProfiles/${venueId}/private/finderContact`).get();
  return {
    name: data.name || data.venueName || "",
    finderListing: data.finderListing || { listed: false },
    contactVisibility: data.contactVisibility || "signed_in",
    finderContact: priv.exists ? priv.data() : { bookerName: "", role: "", email: "", phone: "" },
    techRider: data.techRider || null,
    capacity: data.capacity || null,
  };
}

export async function createProfileRequest({ venueId, profileId, listed }) {
  if (listed) {
    const error = new Error("Listed venues are contacted by the artist directly.");
    error.statusCode = 400;
    throw error;
  }
  const key = hashToken(`${profileId}:${venueId}`);
  const ref = db.doc(`profileRequests/${key}`);
  const prev = await ref.get();
  if (prev.exists && Date.now() - new Date(prev.data()?.at || 0).getTime() < 30 * 86400000) {
    return { ok: true, already: true };
  }
  const profile = await loadProfile(profileId);
  if (!profile || profile.status !== "live") {
    const error = new Error("Your profile isn't live yet.");
    error.statusCode = 400;
    throw error;
  }
  const venue = await db.doc(`venueProfiles/${venueId}`).get();
  const venueData = venue.data() || {};
  const ownerId = venueData.createdBy || venueData.userId;
  if (ownerId) {
    const contact = await loadContact(profileId);
    await db.collection(`users/${ownerId}/artistCRM`).add({
      name: profile.name,
      artistId: profileId,
      email: null,
      phone: null,
      contactType: "artist",
      source: "profile_request",
      notes: contact.contactName ? `Profile request from ${contact.contactName}` : "Profile request",
      profileUrl: profileUrl(profile.slug),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    const priv = await db.doc(`venueProfiles/${venueId}/private/finderContact`).get();
    const to = emailNorm(priv.data()?.email) || emailNorm(venueData.email);
    if (to) {
      await sendMail({
        to,
        subject: `${profile.name} asked to be considered`,
        text: `${profile.name} sent their Gigin profile: ${profileUrl(profile.slug)}`,
        html: emailShell({
          title: `${profile.name} asked to be considered`,
          inner: `<p>${escapeHtml(profile.name)} sent their public profile. Their email and phone aren't included. You can offer them a gig from My Contacts.</p>`,
          buttonLabel: "View profile",
          buttonUrl: profileUrl(profile.slug),
          footer: "",
        }),
      });
    }
  }
  await ref.set({ profileId, venueId, at: new Date().toISOString() });
  return { ok: true };
}

export async function createAreaRequest({ town, email }) {
  const address = emailNorm(email);
  if (!town || !address) {
    const error = new Error("Add a town and an email.");
    error.statusCode = 400;
    throw error;
  }
  await db.collection("finderAreaRequests").add({
    town: String(town).slice(0, 80),
    email: address,
    at: new Date().toISOString(),
  });
  return { ok: true, town: String(town).slice(0, 80) };
}

export async function createVenueClaim({ listedVenueId, name, role, email }) {
  const address = emailNorm(email);
  if (!name || !address) {
    const error = new Error("Add your name and work email.");
    error.statusCode = 400;
    throw error;
  }
  await db.collection("venueClaims").add({
    listedVenueId,
    name: String(name).slice(0, 80),
    role: String(role || "").slice(0, 80),
    email: address,
    status: "pending",
    at: new Date().toISOString(),
  });
  return { ok: true };
}

export async function submitProfileContact({ slug, name, email, venue, message }) {
  const address = emailNorm(email);
  if (!name || !address || !message) {
    const error = new Error("Add your name, email and a message.");
    error.statusCode = 400;
    throw error;
  }
  const profile = await loadBySlugOrId(slug);
  if (!profile || profile.status !== "live") {
    const error = new Error("This profile isn't available.");
    error.statusCode = 404;
    throw error;
  }
  const contact = await loadContact(profile.id);
  if (!contact.email) {
    const error = new Error("This artist can't be reached by email yet.");
    error.statusCode = 400;
    throw error;
  }
  await sendMail({
    to: contact.email,
    replyTo: address,
    subject: `Message about ${profile.name} via Gigin`,
    text: `${name} (${address}) wrote: ${message}`,
    html: emailShell({
      title: `Message for ${profile.name}`,
      inner: `<p>${escapeHtml(name)} (${escapeHtml(address)}) sent this through your Gigin profile${venue ? ` about ${escapeHtml(venue)}` : ""}.</p><p>${escapeHtml(message)}</p><p>Reply to this email and it goes to them. Your address stays private.</p>`,
      footer: "",
    }),
  });
  return { ok: true, actName: profile.name };
}

export async function seedListedVenuesIfEmpty() {
  const existing = await db.collection("listedVenues").limit(1).get();
  if (!existing.empty) return;
  for (let index = 1; index <= 4; index += 1) {
    await db.doc(`listedVenues/cambridge-${index}`).set({ ...LISTED_VENUE_EMPTY });
  }
}

export function filterVenue(venue, { kind, pa, originals, capacity, genre }) {
  if (kind === "gigin" && venue.kind !== "gigin") return false;
  if (kind === "listed" && venue.kind !== "listed") return false;
  if (pa && venue.hasPA !== true) return false;
  if (originals && venue.takesOriginals !== true) return false;
  if (!capacityMatches(venue.capacity, capacity)) return false;
  if (genre && !(venue.genres || []).some((item) => String(item).toLowerCase() === String(genre).toLowerCase())) return false;
  return true;
}

export async function loadGuestForProfile(gigId, applicantId) {
  const priv = await db.doc(`gigs/${gigId}/guestApplicants/${applicantId}`).get();
  const gig = await db.doc(`gigs/${gigId}`).get();
  const stub = ((gig.data()?.applicants) || []).find((entry) => entry?.id === applicantId) || {};
  return { ...(priv.data() || {}), ...stub, id: applicantId, gigId, gig: gig.data() || {} };
}

export { capacityMatches, ogDescription, profileUrl, APP_ORIGIN, enabledSections };
