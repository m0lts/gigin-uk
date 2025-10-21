/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, FieldValue } from "../../../lib/admin.js";
import { assertVenuePerm } from "../../../lib/utils/permissions.js";

/**
 * Mark a musician's pending fee as "in dispute".
 * Expects: { musicianId, docId? , gigId?, disputeReason?, details? }
 * Auth: required. Verifies caller owns the musician profile.
 */
export const markPendingFeeInDispute = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const callerUid = req.auth.uid;
    const {
      musicianId,
      docId,
      gigId,
      disputeReason,
      details,
      venueId,
    } = req.data || {};
    if (!musicianId || typeof musicianId !== "string") {
      console.error("[markPendingFeeInDispute] Missing or invalid musicianId");
      const e = new Error("INVALID_ARGUMENT: musicianId is required");
      e.code = "invalid-argument";
      throw e;
    }
    if (!docId && !gigId) {
      console.error("[markPendingFeeInDispute] Missing docId or gigId");
      const e = new Error("INVALID_ARGUMENT: provide docId or gigId to locate the pending fee");
      e.code = "invalid-argument";
      throw e;
    }
    const safeExtras = {};
    if (typeof disputeReason === "string") {
      safeExtras.disputeReason = disputeReason.trim().slice(0, 2000);
    }
    if (typeof details === "string") {
      safeExtras.details = details.trim().slice(0, 5000);
    }
    if (venueId) {
      await assertVenuePerm(callerUid, venueId, 'reviews.create');
    } else {
      const userSnap = await db.doc(`users/${callerUid}`).get();
      const user = userSnap.data() || {};
      const callerMusicianIds = Array.isArray(user.musicianProfile)
        ? user.musicianProfile
        : user.musicianProfile
          ? [user.musicianProfile]
          : [];
      const ownsMusician = callerMusicianIds.includes(musicianId);
      if (!ownsMusician) {
        const e = new Error("PERMISSION_DENIED: caller must own musician profile or provide venueId with permission");
        e.code = "permission-denied";
        throw e;
      }
    }
    const musicianRef = db.doc(`musicianProfiles/${musicianId}`);
    const pendingCol = musicianRef.collection("pendingFees");
    const result = await db.runTransaction(async (tx) => {
      const musicianSnap = await tx.get(musicianRef);
      if (!musicianSnap.exists) {
        console.error("[markPendingFeeInDispute] Musician profile not found");
        const e = new Error("NOT_FOUND: musician profile");
        e.code = "not-found";
        throw e;
      }
      let pfRef = null;
      let pfSnap = null;
      if (docId) {
        pfRef = pendingCol.doc(docId);
        pfSnap = await tx.get(pfRef);
        if (!pfSnap.exists) {
          console.error("[markPendingFeeInDispute] Pending fee not found via docId");
          const e = new Error("NOT_FOUND: pending fee (docId not found)");
          e.code = "not-found";
          throw e;
        }
      } else {
        const q = pendingCol.where("gigId", "==", gigId).limit(1);
        const qSnap = await tx.get(q);
        if (qSnap.empty) {
          console.error("[markPendingFeeInDispute] Pending fee not found via gigId");
          const e = new Error("NOT_FOUND: pending fee (gigId not found)");
          e.code = "not-found";
          throw e;
        }
        pfSnap = qSnap.docs[0];
        pfRef = pfSnap.ref;
      }
      const before = pfSnap.data() || {};
      const currentStatus = String(before.status || "").toLowerCase();
      if (currentStatus === "in dispute") {
        console.warn("[markPendingFeeInDispute] Fee already marked in dispute");
        return {
          alreadyInDispute: true,
          pendingFeeId: pfSnap.id,
          status: "in dispute",
        };
      }
      tx.update(pfRef, {
        disputeLogged: true,
        status: "in dispute",
        disputeClearingTime: null,
        updatedAt: FieldValue.serverTimestamp(),
        ...safeExtras,
      });
      const disputeRef = db.collection("disputes").doc();
      tx.set(disputeRef, {
        type: "pendingFeeDispute",
        musicianId,
        pendingFeeId: pfSnap.id,
        gigId: before.gigId || null,
        raisedByUid: callerUid,
        disputeReason: safeExtras.disputeReason ?? null,
        details: safeExtras.details ?? null,
        createdAt: FieldValue.serverTimestamp(),
      });
      return {
        alreadyInDispute: false,
        pendingFeeId: pfSnap.id,
        status: "in dispute",
        disputeDocId: disputeRef.id,
      };
    });
    return {
      success: true,
      ...result,
      message: result.alreadyInDispute
        ? 'This fee is already marked as "in dispute".'
        : "Dispute submitted. We’ll review it and pause clearing.",
    };
  }
);