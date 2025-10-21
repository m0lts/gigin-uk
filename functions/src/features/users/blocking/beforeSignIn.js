/* eslint-disable */
import { beforeUserSignedIn } from "firebase-functions/v2/identity";
import { admin } from "../../../lib/admin.js";

export const onBeforeSignIn = beforeUserSignedIn({region: "europe-west1"}, async (event) => {
    const { data: user, credential } = event;
    const providerId = credential?.providerId || user?.providerData?.[0]?.providerId || "password";
    if (providerId === "password" && !user.emailVerified) {
      throw new Error("auth/email-not-verified");
    }
    const snap = await admin.firestore().doc(`users/${user.uid}`).get();
    if (!snap.exists && providerId === "google.com") {
      throw new Error("auth/account-not-registered");
    }
    return {};
  });