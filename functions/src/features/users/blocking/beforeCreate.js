/* eslint-disable */
import { beforeUserCreated } from "firebase-functions/v2/identity";
import { FieldValue, db } from "../../../lib/admin.js";

export const onBeforeCreate = beforeUserCreated({region: "europe-west1"}, async (event) => {
    const { data: user } = event;
    const email = (user.email || "").toLowerCase();
    const phoneNumber = (user.phoneNumber || "").trim() || null;
    if (phoneNumber) {
      const q = await db.collection("users").where("phoneNumber", "==", phoneNumber).limit(1).get();
      if (!q.empty) {
        throw new Error("auth/phone-already-in-use");
      }
    }
    const userRef = db.doc(`users/${user.uid}`);
    const snap = await userRef.get();
    if (!snap.exists) {
      await userRef.set({
        email,
        phoneNumber: phoneNumber || null,
        createdAt: FieldValue.serverTimestamp(),
        firstTimeInFinances: true,
      });
    }
    return {};
  });