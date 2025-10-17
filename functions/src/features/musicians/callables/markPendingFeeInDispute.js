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
        console.log("[markPendingFeeInDispute] Looking up pending fee by docId", docId);
        pfRef = pendingCol.doc(docId);
        pfSnap = await tx.get(pfRef);
        if (!pfSnap.exists) {
          console.error("[markPendingFeeInDispute] Pending fee not found via docId");
          const e = new Error("NOT_FOUND: pending fee (docId not found)");
          e.code = "not-found";
          throw e;
        }
      } else {
        console.log("[markPendingFeeInDispute] Looking up pending fee by gigId", gigId);
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
      console.log("[markPendingFeeInDispute] Pending fee data", {
        id: pfSnap.id,
        currentStatus: before.status,
      });

      const currentStatus = String(before.status || "").toLowerCase();
      if (currentStatus === "in dispute") {
        console.warn("[markPendingFeeInDispute] Fee already marked in dispute");
        return {
          alreadyInDispute: true,
          pendingFeeId: pfSnap.id,
          status: "in dispute",
        };
      }

      console.log("[markPendingFeeInDispute] Updating pending fee to 'in dispute'");

      tx.update(pfRef, {
        disputeLogged: true,
        status: "in dispute",
        disputeClearingTime: null,
        updatedAt: FieldValue.serverTimestamp(),
        ...safeExtras,
      });

      const disputeRef = db.collection("disputes").doc();
      console.log("[markPendingFeeInDispute] Creating dispute doc", disputeRef.id);

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

      console.log("[markPendingFeeInDispute] Dispute successfully created", {
        pendingFeeId: pfSnap.id,
        disputeDocId: disputeRef.id,
      });

      return {
        alreadyInDispute: false,
        pendingFeeId: pfSnap.id,
        status: "in dispute",
        disputeDocId: disputeRef.id,
      };
    });

    console.log("[markPendingFeeInDispute] Transaction complete", result);

    return {
      success: true,
      ...result,
      message: result.alreadyInDispute
        ? 'This fee is already marked as "in dispute".'
        : "Dispute submitted. We’ll review it and pause clearing.",
    };
  }
);