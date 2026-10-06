/** Server-side venue signup, approval tokens, and the pending-venue gate. */

import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { db, admin, FieldValue } from "../config/admin.js";
import { queueMail } from "./queueMail.js";
import { MAIL_FROM, notifyAddress } from "./accessRequest.js";
import { PERM_KEYS } from "../utils/permissions.js";
import {
  APPROVAL_DAYS,
  SIGNUP_LIMIT,
  SIGNUP_WINDOW_MS,
  SERVER_VENUE_FIELDS,
  cityFromAddress,
  tokenState,
  venueIsApproved,
} from "./venueApprovalPolicy.js";

export { venueIsApproved, SERVER_VENUE_FIELDS };

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function appOrigin() {
  return String(process.env.PUBLIC_APP_URL || process.env.APP_ORIGIN || "https://giginmusic.com").replace(/\/$/, "");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function text(value, max) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function ownerPermissions() {
  return Object.fromEntries(PERM_KEYS.map((key) => [key, true]));
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function assertVenueCanOperate(venueId) {
  if (!venueId) return;
  const snap = await db.doc(`venueProfiles/${venueId}`).get();
  if (!snap.exists) return;
  if (!venueIsApproved(snap.data() || {})) {
    throw httpError(403, "This venue is waiting for approval.");
  }
}

async function reserveSignupSlot(uid) {
  const ref = db.doc(`venueSignupRate/${uid}`);
  let failure = null;
  await db.runTransaction(async (tx) => {
    failure = null;
    const snap = await tx.get(ref);
    const now = Date.now();
    const stamps = (Array.isArray(snap.data()?.stamps) ? snap.data().stamps : [])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && now - value < SIGNUP_WINDOW_MS);
    if (stamps.length >= SIGNUP_LIMIT) {
      failure = httpError(429, "Too many venue signups. Try again tomorrow.");
      return;
    }
    stamps.push(now);
    tx.set(ref, { stamps, updatedAt: new Date(now).toISOString() });
  });
  if (failure) throw failure;
}

function profileFromBody(body, uid) {
  const source = body && typeof body === "object" ? body : {};
  const name = text(source.name, 120);
  if (name.length < 2) throw httpError(400, "Add the venue name.");
  const address = text(source.address, 300);
  const city = text(source.city, 80) || cityFromAddress(address);
  const venueId = /^[0-9a-f-]{36}$/i.test(String(source.venueId || ""))
    ? String(source.venueId)
    : uuidv4();
  const typedEmail = text(source.email, 160);
  const profile = {
    venueId,
    name,
    address,
    city,
    type: text(source.type, 80),
    establishment: text(source.establishment, 120),
    description: text(source.description, 5000),
    extraInformation: text(source.extraInformation, 5000),
    website: text(source.website, 300),
    capacity: text(source.capacity, 20),
    completed: source.completed === true,
    email: typedEmail,
    createdBy: uid,
    userId: uid,
  };
  SERVER_VENUE_FIELDS.forEach((field) => {
    delete profile[field];
  });
  profile.approvalStatus = "pending";
  profile.approvedAt = null;
  profile.approvedBy = null;
  return profile;
}

async function ownerLoginEmail(venue) {
  const uid = String(venue?.createdBy || venue?.userId || "");
  if (!uid) return "";
  try {
    const user = await admin.auth().getUser(uid);
    return user.email || "";
  } catch (error) {
    console.error("owner email lookup failed", error);
    return "";
  }
}

export async function createPendingVenue({ uid, email, body }) {
  if (!uid) throw httpError(401, "Sign in to create a venue.");
  if (!email) throw httpError(403, "Verify your email before creating a venue.");
  const profile = profileFromBody(body, uid);
  await reserveSignupSlot(uid);

  const venueRef = db.doc(`venueProfiles/${profile.venueId}`);
  const memberRef = venueRef.collection("members").doc(uid);
  const userRef = db.doc(`users/${uid}`);
  const owned = await db.collection("venueProfiles").where("createdBy", "==", uid).limit(1).get();
  if (!owned.empty) throw httpError(409, "You already have a venue.");

  let failure = null;
  await db.runTransaction(async (tx) => {
    failure = null;
    const existing = await tx.get(venueRef);
    if (existing.exists) {
      failure = httpError(409, "That venue already exists.");
      return;
    }
    const again = await tx.get(db.collection("venueProfiles").where("createdBy", "==", uid).limit(1));
    if (!again.empty) {
      failure = httpError(409, "You already have a venue.");
      return;
    }
    tx.set(venueRef, {
      ...profile,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.set(memberRef, {
      status: "active",
      role: "owner",
      permissions: ownerPermissions(),
      addedBy: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.set(userRef, {
      venueProfiles: FieldValue.arrayUnion(profile.venueId),
    }, { merge: true });
  });
  if (failure) throw failure;

  if (profile.completed) {
    try {
      await notifyFounder(profile.venueId);
    } catch (error) {
      console.error("venue approval email failed", error);
    }
  }
  return { venueId: profile.venueId, approvalStatus: "pending" };
}

export async function notifyFounder(venueId) {
  const venueRef = db.doc(`venueProfiles/${venueId}`);
  const raw = crypto.randomBytes(32).toString("hex");
  const hash = hashToken(raw);
  let shouldSend = false;
  let details = null;
  let failure = null;
  await db.runTransaction(async (tx) => {
    failure = null;
    shouldSend = false;
    const snap = await tx.get(venueRef);
    if (!snap.exists) {
      failure = httpError(404, "Venue not found.");
      return;
    }
    const data = snap.data() || {};
    if (data.approvalStatus !== "pending" || data.approvalNotifiedAt) return;
    const expiresAt = new Date(Date.now() + APPROVAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    tx.set(db.doc(`venueApprovalTokens/${hash}`), {
      hash,
      venueId,
      expiresAt,
      usedAt: null,
      createdAt: new Date().toISOString(),
    });
    tx.update(venueRef, { approvalNotifiedAt: new Date().toISOString() });
    shouldSend = true;
    details = { data, expiresAt };
  });
  if (failure) throw failure;
  if (!shouldSend || !details) return { ok: true, skipped: true };
  const data = details.data;
  const link = `${appOrigin()}/admin/venue-approval/${raw}`;
  const lines = [
    `Venue: ${data.name || "Untitled venue"}`,
    `City: ${data.city || cityFromAddress(data.address) || "—"}`,
    `Owner: ${await ownerLoginEmail(data) || "—"}`,
    `Review: ${link}`,
  ];
  await queueMail({
    to: notifyAddress(),
    from: MAIL_FROM,
    message: {
      subject: `New venue waiting for approval: ${data.name || "Untitled venue"}`,
      text: lines.join("\n"),
      html: `<p>${lines.map((line) => escapeHtml(line)).join("<br>")}</p>`,
    },
  });
  return { ok: true, skipped: false };
}

async function emailOwner(venue, decision) {
  const to = await ownerLoginEmail(venue);
  if (!to) return;
  const name = venue.name || "Your venue";
  const approved = decision === "approve";
  const text = approved
    ? `${name} is approved. You can create nights from your Gigin dashboard.`
    : `${name} wasn't approved. You can still edit the profile. Nights stay closed.`;
  await queueMail({
    to,
    from: MAIL_FROM,
    message: {
      subject: approved ? `${name} is approved on Gigin` : `${name} wasn't approved`,
      text,
      html: `<p>${escapeHtml(text)}</p>`,
    },
  });
}

export async function readApproval(raw) {
  if (!raw || String(raw).length < 32) return { state: "missing" };
  const snap = await db.doc(`venueApprovalTokens/${hashToken(raw)}`).get();
  if (!snap.exists) return { state: "missing" };
  const token = snap.data() || {};
  const state = tokenState(token);
  const venueSnap = token.venueId ? await db.doc(`venueProfiles/${token.venueId}`).get() : null;
  const venue = venueSnap?.exists ? venueSnap.data() || {} : {};
  return {
    state,
    venueId: token.venueId || null,
    expiresAt: token.expiresAt || null,
    venueName: venue.name || "",
    city: venue.city || cityFromAddress(venue.address) || "",
    ownerEmail: await ownerLoginEmail(venue),
    approvalStatus: venue.approvalStatus || (venueSnap?.exists ? "approved" : null),
  };
}

export async function decideApproval({ raw, decision, actor }) {
  if (decision !== "approve" && decision !== "reject") {
    throw httpError(400, "Choose approve or reject.");
  }
  if (!raw || String(raw).length < 32) throw httpError(404, "This approval link is not valid.");
  const tokenRef = db.doc(`venueApprovalTokens/${hashToken(raw)}`);
  let venue = null;
  let changed = false;
  let failure = null;
  await db.runTransaction(async (tx) => {
    failure = null;
    changed = false;
    const tokenSnap = await tx.get(tokenRef);
    if (!tokenSnap.exists) {
      failure = httpError(404, "This approval link is not valid.");
      return;
    }
    const token = tokenSnap.data() || {};
    const state = tokenState(token);
    if (state === "used") {
      failure = httpError(409, "This approval link has already been used.");
      return;
    }
    if (state === "expired") {
      failure = httpError(410, "This approval link has expired.");
      return;
    }
    const venueRef = db.doc(`venueProfiles/${token.venueId}`);
    const venueSnap = await tx.get(venueRef);
    if (!venueSnap.exists) {
      failure = httpError(404, "Venue not found.");
      return;
    }
    venue = { venueId: venueSnap.id, ...(venueSnap.data() || {}) };
    const next = decision === "approve" ? "approved" : "rejected";
    if (venue.approvalStatus && venue.approvalStatus !== "pending") {
      tx.update(tokenRef, { usedAt: new Date().toISOString(), decision });
      failure = httpError(409, "This venue has already been decided.");
      return;
    }
    const patch = decision === "approve"
      ? {
        approvalStatus: next,
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        approvedBy: actor || "approval-link",
      }
      : {
        approvalStatus: next,
        approvedAt: null,
        approvedBy: null,
      };
    tx.update(venueRef, patch);
    tx.update(tokenRef, { usedAt: new Date().toISOString(), decision });
    changed = true;
    venue = { ...venue, approvalStatus: next };
  });
  if (failure) throw failure;
  if (changed && venue) {
    try {
      await emailOwner(venue, decision);
    } catch (error) {
      console.error("owner decision email failed", error);
    }
  }
  return { ok: true, approvalStatus: decision === "approve" ? "approved" : "rejected", venueId: venue?.venueId };
}

export async function approveVenueById({ venueId, actor }) {
  const venueRef = db.doc(`venueProfiles/${venueId}`);
  const snap = await venueRef.get();
  if (!snap.exists) throw httpError(404, "Venue not found.");
  const current = snap.data() || {};
  if (venueIsApproved(current)) {
    return { ok: true, already: true, approvalStatus: "approved" };
  }
  await venueRef.update({
    approvalStatus: "approved",
    approvedAt: admin.firestore.FieldValue.serverTimestamp(),
    approvedBy: actor || "cli",
  });
  await emailOwner(current, "approve");
  return { ok: true, approvalStatus: "approved", venueId };
}
