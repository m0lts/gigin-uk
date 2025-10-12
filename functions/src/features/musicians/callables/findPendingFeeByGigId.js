/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db } from "../../../lib/admin.js";

/**
 * findPendingFeeByGigId (CF)
 * --------------------------
 * Reads the first pending fee doc for a given musician + gig.
 *
 * Input:
 *  {
 *    musicianId: string,
 *    gigId: string
 *  }
 *
 * Output:
 *  {
 *    found: boolean,
 *    docId?: string,
 *    data?: object
 *  }
 */
export const findPendingFeeByGigId = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const { musicianId, gigId } = req.data || {};

    if (!musicianId || !gigId) {
      const e = new Error("INVALID_ARGUMENT: musicianId and gigId are required.");
      e.code = "invalid-argument";
      throw e;
    }

    const snap = await db
      .collection("musicianProfiles")
      .doc(musicianId)
      .collection("pendingFees")
      .where("gigId", "==", gigId)
      .limit(1)
      .get();

    if (snap.empty) {
      return { found: false };
    }

    const d = snap.docs[0];
    return {
      docId: d.id,
      data: d.data() || {},
    };
  }
);