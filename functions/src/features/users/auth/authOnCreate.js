/* eslint-disable */
import * as functions from "firebase-functions/v1";
import { db, FieldValue } from "../../../lib/admin.js";

export const authOnCreate = functions
  .region("europe-west3")
  .auth
  .user()
  .onCreate(async (user) => {
    try {
      const ref = db.doc(`users/${user.uid}`);
      await ref.set(
        {
          email: (user.email || "").toLowerCase(),
          createdAt: FieldValue.serverTimestamp(),
          firstTimeInFinances: true,
          termsAcceptedAt: FieldValue.serverTimestamp(),
          termsAccepted: true,
          lastLoginAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      console.log(`[authOnCreate] Created user doc for ${user.uid}`);
    } catch (err) {
      console.error("[authOnCreate] Error creating user doc:", err);
    }
  });