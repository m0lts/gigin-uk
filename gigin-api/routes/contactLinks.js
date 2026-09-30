/* eslint-disable */
import express from "express";
import { db, admin, FieldValue } from "../config/admin.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = express.Router();

function norm(value) {
  return String(value || "").trim().toLowerCase();
}

async function profileForUser(uid) {
  if (!uid) return null;
  const snap = await db.collection("artistProfiles").where("userId", "==", uid).limit(1).get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...(snap.docs[0].data() || {}) };
}

async function profileByName(name) {
  const exact = String(name || "").trim();
  if (!exact) return null;
  const snap = await db.collection("artistProfiles").where("name", "==", exact).limit(1).get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...(snap.docs[0].data() || {}) };
}

async function venueIdsFor(uid) {
  const [byCreator, byUser] = await Promise.all([
    db.collection("venueProfiles").where("createdBy", "==", uid).get(),
    db.collection("venueProfiles").where("userId", "==", uid).get(),
  ]);
  const ids = new Set();
  byCreator.docs.forEach((doc) => ids.add(doc.id));
  byUser.docs.forEach((doc) => ids.add(doc.id));
  return [...ids];
}

async function repointGuestHistory({ venueIds, fromCrmId, toCrmId, artistId, userId }) {
  for (const venueId of venueIds) {
    const gigs = await db.collection("gigs").where("venueId", "==", venueId).get();
    for (const gig of gigs.docs) {
      const applicants = Array.isArray(gig.data()?.applicants) ? gig.data().applicants : [];
      let changed = false;
      const next = applicants.map((entry) => {
        if (entry?.crmEntryId !== fromCrmId) return entry;
        changed = true;
        return {
          ...entry,
          crmEntryId: toCrmId || entry.crmEntryId,
          linkedArtistId: artistId,
          ...(userId ? { userId } : {}),
        };
      });
      if (changed) await gig.ref.update({ applicants: next });
    }
  }
}

router.get("/suggestions", requireAuth, asyncHandler(async (req, res) => {
  const caller = req.auth.uid;
  const snap = await db.collection("users").doc(caller).collection("artistCRM").limit(400).get();
  const contacts = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
  const suggestions = [];
  for (const contact of contacts) {
    if (contact.artistId) continue;
    let match = null;
    let reason = "";
    const email = norm(contact.email);
    if (email) {
      try {
        const user = await adminAuthUser(email);
        if (user) {
          match = await profileForUser(user.uid);
          reason = "email";
        }
      } catch {
        match = null;
      }
    }
    if (!match && contact.name) {
      const byName = await profileByName(contact.name);
      if (byName && !contacts.some((row) => row.artistId === byName.id && row.id === contact.id)) {
        match = byName;
        reason = "name";
      }
    }
    if (!match) continue;
    suggestions.push({
      crmEntryId: contact.id,
      contactName: contact.name || "This contact",
      matchName: match.name || contact.name || "an artist",
      matchArtistId: match.id,
      reason,
    });
  }
  return res.json({ suggestions });
}));

async function adminAuthUser(email) {
  try {
    return await admin.auth().getUserByEmail(email);
  } catch (err) {
    if (err?.code === "auth/user-not-found") return null;
    throw err;
  }
}

router.post("/merge", requireAuth, asyncHandler(async (req, res) => {
  const caller = req.auth.uid;
  const crmEntryId = String(req.body?.crmEntryId || "");
  const artistId = String(req.body?.artistId || "");
  if (!crmEntryId || !artistId) return res.status(400).json({ error: "A contact and an artist are required." });
  const col = db.collection("users").doc(caller).collection("artistCRM");
  const sourceRef = col.doc(crmEntryId);
  const sourceSnap = await sourceRef.get();
  if (!sourceSnap.exists) return res.status(404).json({ error: "Contact not found." });
  const source = sourceSnap.data() || {};
  const profileSnap = await db.doc(`artistProfiles/${artistId}`).get();
  if (!profileSnap.exists) return res.status(404).json({ error: "Artist profile not found." });
  const profile = profileSnap.data() || {};
  const existing = await col.where("artistId", "==", artistId).limit(1).get();
  const sibling = existing.docs.find((doc) => doc.id !== crmEntryId);
  const venueIds = await venueIdsFor(caller);
  if (sibling) {
    const kept = sibling.data() || {};
    await sibling.ref.set({
      email: kept.email || source.email || null,
      phone: kept.phone || source.phone || null,
      instagram: kept.instagram || source.instagram || null,
      notes: kept.notes || source.notes || "",
      tags: Array.from(new Set([...(kept.tags || []), ...(source.tags || [])])),
      artistId,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await repointGuestHistory({
      venueIds,
      fromCrmId: crmEntryId,
      toCrmId: sibling.id,
      artistId,
      userId: profile.userId || null,
    });
    await sourceRef.delete();
    return res.json({ ok: true, keptId: sibling.id });
  }
  await sourceRef.set({ artistId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await repointGuestHistory({
    venueIds,
    fromCrmId: crmEntryId,
    toCrmId: crmEntryId,
    artistId,
    userId: profile.userId || null,
  });
  return res.json({ ok: true, keptId: crmEntryId });
}));

export default router;
