/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, FieldValue } from "../../../lib/admin.js";

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
    } = req.data || {};

    // ---- Input validation
    if (!musicianId || typeof musicianId !== "string") {
      const e = new Error("INVALID_ARGUMENT: musicianId is required");
      e.code = "invalid-argument";
      throw e;
    }
    if (!docId && !gigId) {
      const e = new Error("INVALID_ARGUMENT: provide docId or gigId to locate the pending fee");
      e.code = "invalid-argument";
      throw e;
    }

    // Whitelist optional extras
    const safeExtras = {};
    if (typeof disputeReason === "string") {
      safeExtras.disputeReason = disputeReason.trim().slice(0, 2000);
    }
    if (typeof details === "string") {
      safeExtras.details = details.trim().slice(0, 5000);
    }

    const musicianRef = db.doc(`musicianProfiles/${musicianId}`);
    const pendingCol = musicianRef.collection("pendingFees");

    const result = await db.runTransaction(async (tx) => {
      // 1) Verify ownership
      const musicianSnap = await tx.get(musicianRef);
      if (!musicianSnap.exists) {
        const e = new Error("NOT_FOUND: musician profile");
        e.code = "not-found";
        throw e;
      }
      const ownerUid = musicianSnap.get("userId") || "";
      if (ownerUid !== callerUid) {
        const e = new Error("FORBIDDEN: only the musician profile owner may file disputes");
        e.code = "permission-denied";
        throw e;
      }

      // 2) Locate pending fee doc
      let pfRef = null;
      let pfSnap = null;

      if (docId) {
        pfRef = pendingCol.doc(docId);
        pfSnap = await tx.get(pfRef);
        if (!pfSnap.exists) {
          const e = new Error("NOT_FOUND: pending fee (docId not found)");
          e.code = "not-found";
          throw e;
        }
      } else {
        // lookup by gigId
        const q = pendingCol.where("gigId", "==", gigId).limit(1);
        const qSnap = await tx.get(q);
        if (qSnap.empty) {
          const e = new Error("NOT_FOUND: pending fee (gigId not found)");
          e.code = "not-found";
          throw e;
        }
        pfSnap = qSnap.docs[0];
        pfRef = pfSnap.ref;
      }

      const before = pfSnap.data() || {};
      const currentStatus = String(before.status || "").toLowerCase();

      // Avoid double-dispute
      if (currentStatus === "in dispute") {
        return {
          alreadyInDispute: true,
          pendingFeeId: pfSnap.id,
          status: "in dispute",
        };
      }

      // 3) Update pending fee
      tx.update(pfRef, {
        disputeLogged: true,
        status: "in dispute",
        disputeClearingTime: null,
        updatedAt: FieldValue.serverTimestamp(),
        ...safeExtras,
      });

      // 4) Audit log (server-only writable)
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