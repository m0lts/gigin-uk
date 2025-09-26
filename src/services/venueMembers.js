// src/services/venues/members.js
import {
    doc, getDoc, getDocs, collection, query, where, writeBatch, updateDoc, serverTimestamp, arrayRemove,
  } from "firebase/firestore";
  import { firestore } from "@lib/firebase";
  import { PERM_KEYS, PERM_DEFAULTS } from "@services/utils/permissions";
  
  /**
   * Fetch active members of a venue and their linked user documents.
   *
   * @param {string} venueId
   * @returns {Promise<Array<{ uid: string, status: string, permissions: Object, createdAt?: any, updatedAt?: any, user?: { id: string, name?: string, email?: string, photoURL?: string } }>>}
   */
  export async function fetchVenueMembersWithUsers(venueId) {
    const membersCol = collection(firestore, "venueProfiles", venueId, "members");
    const q = query(membersCol, where("status", "==", "active"));
    const snap = await getDocs(q);
    const members = await Promise.all(
      snap.docs.map(async (d) => {
        const uid = d.id;
        const data = d.data() || {};
        const userSnap = await getDoc(doc(firestore, "users", uid));
        const user = userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } : null;
        const userName = user ? user.name : null;
        const userEmail = user ? user.email : null;
        return {
          uid,
          status: data.status || "active",
          permissions: normalizePermissions(data.permissions),
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null,
          userName,
          userEmail,
          user,
          role: data.role || "member",
        };
      })
    );
    return members;
  }
  
  /**
   * Ensure the permissions object always has the full PERM_DEFAULTS shape.
   * @param {Object|undefined} incoming
   * @returns {Object} full map of booleans
   */
  export function normalizePermissions(incoming) {
    const base = { ...PERM_DEFAULTS };
    if (incoming && typeof incoming === "object") {
      for (const k of PERM_KEYS) {
        if (Object.prototype.hasOwnProperty.call(incoming, k)) {
          base[k] = !!incoming[k];
        }
      }
      // Always enforce view gigs = true
      base["gigs.read"] = true;
    }
    return base;
}