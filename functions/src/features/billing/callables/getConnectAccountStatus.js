/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db } from "../../../lib/admin.js";
import { REGION_PRIMARY } from "../../../config/regions.js";
import {
  STRIPE_LIVE_KEY as stripeLiveKey,
  STRIPE_TEST_KEY as stripeTestKey,
} from "../../../config/secrets.js";
import { makeStripe } from "../../../lib/stripeClient.js";

/**
 * Callable: get the authenticated user's Stripe Connect account status
 * (based on their primary musician profile), and optionally return a
 * resolve URL for onboarding/update if required.
 *
 * Secrets:
 * - STRIPE_PRODUCTION_KEY
 * - STRIPE_TEST_KEY
 *
 * Region: europe-west3.
 *
 * @function getConnectAccountStatus
 * @param {import("firebase-functions/v2/https").CallableRequest} req
 * @returns {Promise<object>}
 */
export const getConnectAccountStatus = callable(
  {
    region: REGION_PRIMARY,
    secrets: [stripeLiveKey, stripeTestKey],
    timeoutSeconds: 60,
    authRequired: true,
  },
  async (req) => {
    try {
      if (!req.auth) throw new Error("Unauthenticated");
      const uid = req.auth.uid;
      const userSnap = await db.collection("users").doc(uid).get();
      if (!userSnap.exists) throw new Error("User not found");
      const userData = userSnap.data() || {};
      let musicianId = null;
      if (
        Array.isArray(userData.musicianProfile) &&
        userData.musicianProfile.length
      ) {
        musicianId = userData.musicianProfile[0];
      }
      if (!musicianId) {
        return {
          exists: false,
          status: "no_account",
          reason: "no_musician_profile",
        };
      }
      const musicianSnap =
        await db.collection("musicianProfiles").doc(musicianId).get();
      if (!musicianSnap.exists) {
        return {
          exists: false,
          status: "no_account",
          reason: "profile_not_found",
        };
      }
      const musicianProfile = musicianSnap.data() || {};
      if (!musicianProfile.stripeAccountId) {
        return { exists: false, status: "no_account" };
      }
      const accountId = musicianProfile.stripeAccountId;

      // ✅ structural change: use shared Stripe factory
      const stripe = makeStripe();

      const account = await stripe.accounts.retrieve(accountId);
      const reqs = account.requirements;
      const currentlyDueArr = reqs.currently_due;
      const pastDueArr = reqs.past_due;
      const pendingVerificationArr = reqs.pending_verification;
      const eventuallyDueArr = reqs.eventually_due;
      const disabledReason = reqs.disabled_reason;
      const verification = account.individual.verification;
      const verificationStatus = verification.status;
      const verificationDetails = verification.details;
      const verificationCode = verification.details_code;

      let status = "all_good";
      if (
        pastDueArr.length > 0 ||
        disabledReason ||
        currentlyDueArr.length > 0
      ) {
        status = "urgent";
      } else if (
        verificationStatus === "unverified" ||
        eventuallyDueArr.length > 0
      ) {
        status = "warning";
      }

      const actions = Array.from(new Set([
        ...currentlyDueArr,
        ...pastDueArr,
        ...pendingVerificationArr,
        ...eventuallyDueArr,
      ]));

      const needsOnboarding =
        (currentlyDueArr.length > 0) ||
        (pastDueArr.length > 0) ||
        !account.details_submitted;

      let resolveUrl = null;
      if (status !== "all_good" || needsOnboarding) {
        const link = await stripe.accountLinks.create({
          account: accountId,
          refresh_url: "https://giginmusic.com/dashboard/finances?retry=true",
          return_url: "https://giginmusic.com/dashboard/finances?done=true",
          type: needsOnboarding ? "account_onboarding" : "account_update",
        });
        resolveUrl = link.url;
      }

      return {
        exists: true,
        status,
        counts: {
          currentlyDue: currentlyDueArr.length,
          pastDue: pastDueArr.length,
          eventuallyDue: eventuallyDueArr.length,
        },
        payoutsEnabled: !!account.payouts_enabled,
        disabledReason,
        actions,
        verification: {
          status: verificationStatus,
          details: verificationDetails,
          code: verificationCode,
        },
        resolveUrl,
        raw: {
          detailsSubmitted: account.details_submitted,
          capabilities: account.capabilities,
        },
      };
    } catch (error) {
      console.error("getConnectAccountStatus error:", error);
      throw new Error(
        typeof error.message === "string" ? error.message : "Unknown error",
      );
    }
  }
);