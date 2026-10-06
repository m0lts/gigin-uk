/** Public artist sign-up. Reuses keep-profile tokens, the private email index, and artist emails. */

import crypto from "crypto";
import { admin, db } from "../config/admin.js";
import { queueMail } from "./queueMail.js";
import { renderArtistEmail } from "./artistEmails.js";
import { issueToken } from "./keepProfile.js";
import { profileIdForEmail, rememberProfileEmail } from "./profileEmailIndex.js";
import { APP_ORIGIN, MAIL_FROM, emailIndexKey, firstName, nextSlug, slugify } from "./keepProfileLogic.js";

const WINDOW_MS = 24 * 60 * 60 * 1000;
const SENT = { sent: true };

function emailNorm(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function rateKey(email) {
  return emailIndexKey(email) || crypto.createHash("sha256").update(email).digest("hex");
}

function emailMax() {
  const parsed = Number(process.env.ARTIST_SIGNUP_EMAIL_MAX);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function authUserByEmail(email) {
  try {
    return await admin.auth().getUserByEmail(email);
  } catch (error) {
    if (error?.code === "auth/user-not-found") return null;
    throw error;
  }
}

async function reserveEmailSlot(email) {
  const ref = db.doc(`artistSignupRate/${rateKey(email)}`);
  const max = emailMax();
  let blocked = false;
  await db.runTransaction(async (tx) => {
    blocked = false;
    const snap = await tx.get(ref);
    const now = Date.now();
    const stamps = (Array.isArray(snap.data()?.stamps) ? snap.data().stamps : [])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && now - value < WINDOW_MS);
    if (stamps.length >= max) {
      blocked = true;
      return;
    }
    stamps.push(now);
    tx.set(ref, { stamps, updatedAt: new Date(now).toISOString() });
  });
  if (blocked) {
    const error = new Error("Too many requests. Please try again later.");
    error.statusCode = 429;
    throw error;
  }
}

async function uniqueSlug(name) {
  const root = slugify(name);
  const snap = await db.collection("artistProfiles").where("slug", ">=", root).where("slug", "<=", `${root}\uf8ff`).limit(20).get();
  const taken = new Set(snap.docs.map((doc) => doc.data()?.slug).filter(Boolean));
  return nextSlug(root, taken);
}

async function sendArtistMail(to, email) {
  const message = renderArtistEmail(email);
  await queueMail({ to, from: MAIL_FROM, message });
}

async function sendConfirm({ to, name, profileId }) {
  const token = await issueToken({ profileId, kind: "confirm" }, 7);
  const url = `${APP_ORIGIN}/profile/confirm/${token}`;
  await sendArtistMail(to, {
    subject: "Confirm your Gigin profile",
    preheader: "Tap the link to confirm your email and create a password. Nothing is public until you publish.",
    eyebrow: "CONFIRM YOUR PROFILE",
    heading: "Create your artist profile",
    paras: [
      `Hi ${escapeHtml(firstName(name))},`,
      "You asked to create an artist profile on Gigin. Tap the button to confirm your email and create a password. Your profile stays private until you choose to publish it.",
    ],
    button: ["Confirm my email", url],
    small: "This link works once and expires in 7 days. If you didn't ask for this, ignore this email and nothing will be published.",
    footer: "You're getting this because this address was used to create an artist profile on giginmusic.com.",
  });
}

async function sendSignIn(user, email) {
  const link = await admin.auth().generatePasswordResetLink(email, {
    url: `${APP_ORIGIN}/auth/reset`,
    handleCodeInApp: true,
  });
  const oobCode = new URL(link).searchParams.get("oobCode") || "";
  const resetUrl = `${APP_ORIGIN}/auth/reset?oobCode=${encodeURIComponent(oobCode)}`;
  await sendArtistMail(email, {
    subject: "Sign in to your Gigin profile",
    preheader: "Use this link to sign in. It works once.",
    eyebrow: "SIGN IN",
    heading: "You already have a Gigin account",
    paras: [
      `Hi ${escapeHtml(firstName(user.displayName || ""))},`,
      `Someone asked to create an artist profile for <b>${escapeHtml(email)}</b>. That address already has a Gigin account. Use the button to choose a password and sign in.`,
    ],
    button: ["Sign in", resetUrl],
    buttonDark: true,
    small: "If you didn't ask for this, you can ignore this email. Your password won't change.",
    footer: "You're getting this because this address was used to create an artist profile on giginmusic.com.",
  });
}

async function createPendingProfile(name, email) {
  const profileId = crypto.randomUUID();
  const slug = await uniqueSlug(name);
  await db.doc(`artistProfiles/${profileId}`).set({
    name,
    slug,
    source: "artist_signup",
    status: "pending",
    publicFields: { photo: true, bio: true, links: true, members: true, tech: true },
    bio: "",
    members: [],
    playedAt: [],
    guestApplicationIds: [],
    userId: null,
    createdAt: new Date().toISOString(),
    confirmedAt: null,
  });
  await db.doc(`artistProfiles/${profileId}/private/contact`).set({
    email,
    contactName: name,
    phone: "",
  });
  await db.doc(`artistProfiles/${profileId}/private/relationships`).set({ venues: {}, invitedVenueIds: [] });
  await rememberProfileEmail(db, profileId, email);
  return { profileId, name };
}

/**
 * Always finishes as a sent response for the route, except when the email
 * rate limit throws 429. A filled honeypot, a bad email, and an address that
 * already has an account all look the same to the caller.
 */
export async function startArtistSignup(body) {
  const source = body && typeof body === "object" ? body : {};
  if (String(source.company || "").trim()) return SENT;
  const email = emailNorm(source.email);
  if (!email) return SENT;
  await reserveEmailSlot(email);
  const existingUser = await authUserByEmail(email);
  if (existingUser) {
    await sendSignIn(existingUser, email);
    return SENT;
  }
  const profileId = await profileIdForEmail(db, email);
  if (profileId) {
    const snap = await db.doc(`artistProfiles/${profileId}`).get();
    const profile = snap.exists ? snap.data() || {} : null;
    if (profile && profile.status !== "deleted") {
      await sendConfirm({ to: email, name: profile.name || source.name || "", profileId });
      return SENT;
    }
  }
  const name = String(source.name || "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (name.length < 2) return SENT;
  const created = await createPendingProfile(name, email);
  await sendConfirm({ to: email, name: created.name, profileId: created.profileId });
  return SENT;
}
