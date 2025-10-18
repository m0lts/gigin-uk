import { firestore } from '@lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  onSnapshot,
  Timestamp,
  orderBy,
  setDoc,
  runTransaction,
  GeoPoint,
  writeBatch,
  serverTimestamp,
  limit
} from 'firebase/firestore';
import { distanceBetween } from 'geofire-common';
import { PERM_DEFAULTS, sanitizePermissions } from '../utils/permissions';
import { v4 as uuid } from "uuid";

/*** CREATE OPERATIONS ***/

/**
 * Creates or updates a venue profile in Firestore and ensures the creator is a member.
 */
export const createVenueProfile = async (venueId, data, userId) => {
  try {
    const venueRef = doc(firestore, "venueProfiles", venueId);
    const memberRef = doc(firestore, "venueProfiles", venueId, "members", userId);

    await setDoc(
      venueRef,
      { ...data, userId, createdBy: userId },
      { merge: true }
    );

    const snap = await getDoc(memberRef);
    if (!snap.exists()) {
      const allTruePermissions = Object.fromEntries(
        Object.keys(PERM_DEFAULTS).map((k) => [k, true])
      );
      await setDoc(
        memberRef,
        {
          status: "active",
          permissions: {
            ...allTruePermissions,
            "gigs.read": true,
          },
          addedBy: userId,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          role: "owner",
        },
        { merge: false }
      );
    }
  } catch (error) {
    console.error("[Firestore Error] createVenueProfile:", error);
  }
};

/**
 * Create a venue invite with optional initial permissions.
 * @returns {Promise<string|null>} inviteId or null on error
 */
export async function createVenueInvite(
  venueId,
  invitedByUid,
  email,
  permissionsInput = PERM_DEFAULTS,
  invitedByName
) {
  try {
    const inviteId = uuid();
    const permissions = sanitizePermissions(permissionsInput);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await setDoc(doc(firestore, "venueInvites", inviteId), {
      venueId,
      invitedBy: invitedByUid,
      invitedByName,
      email: email?.trim().toLowerCase() || null,
      permissions,
      createdAt: Timestamp.now(),
      expiresAt,
      status: "pending",
    });

    return inviteId;
  } catch (error) {
    console.error("[Firestore Error] createVenueInvite:", error);
  }
}

/*** READ OPERATIONS ***/

/**
 * Fetches venues near the specified location, filters by precise radius and sorts by distance.
 */
export const fetchNearbyVenues = async ({
  location,
  radiusInKm = 50,
  limitCount = 50,
  lastDoc = null,
}) => {
  try {
    const center = [location.latitude, location.longitude];
    const lat = location.latitude;
    const lng = location.longitude;
    const latDelta = radiusInKm / 111;
    const lngDelta = radiusInKm / (111 * Math.cos((lat * Math.PI) / 180));
    const minLat = lat - latDelta;
    const maxLat = lat + latDelta;
    const minLng = lng - lngDelta;
    const maxLng = lng + lngDelta;

    const venuesRef = collection(firestore, "venueProfiles");
    let q = query(
      venuesRef,
      where("geopoint", ">=", new GeoPoint(minLat, minLng)),
      where("geopoint", "<=", new GeoPoint(maxLat, maxLng)),
      orderBy("geopoint")
    );

    const snapshot = await getDocs(q);

    const enriched = snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .map((v) => {
        const gp = v.geopoint;
        const distKm = gp ? distanceBetween(center, [gp.latitude, gp.longitude]) : Infinity;
        return { ...v, _distanceKm: distKm };
      })
      .filter((v) => v._distanceKm <= radiusInKm)
      .sort((a, b) => a._distanceKm - b._distanceKm)
      .slice(0, limitCount);

    const venues = enriched.map((v) => ({ ...v }));
    const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;

    return { venues, lastVisible };
  } catch (error) {
    console.error("[Firestore Error] fetchNearbyVenues:", error);
  }
};

/**
 * Fetches a single venue profile by ID.
 */
export const getVenueProfileById = async (venueId) => {
  try {
    const ref = doc(firestore, "venueProfiles", venueId);
    const snap = await getDoc(ref);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (error) {
    console.error("[Firestore Error] getVenueProfileById:", error);
  }
};

/**
 * Fetches all venue profiles for a specific user.
 */
export const getVenueProfilesByUserId = async (userId) => {
  try {
    const qy = query(collection(firestore, "venueProfiles"), where("userId", "==", userId));
    const snapshot = await getDocs(qy);
    return snapshot.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
  } catch (error) {
    console.error("[Firestore Error] getVenueProfilesByUserId:", error);
  }
};

/**
 * Fetches all venue requests for a given array of venue IDs.
 */
export const getVenueRequestsByVenueIds = async (venueIds) => {
  try {
    if (!venueIds || venueIds.length === 0) return [];
    const requestsRef = collection(firestore, "venueRequests");

    const chunks = [];
    for (let i = 0; i < venueIds.length; i += 10) {
      chunks.push(venueIds.slice(i, i + 10));
    }

    const allResults = [];
    for (const chunk of chunks) {
      const qy = query(requestsRef, where("venueId", "in", chunk));
      const snapshot = await getDocs(qy);
      snapshot.forEach((d) => {
        allResults.push({ id: d.id, ...d.data() });
      });
    }

    return allResults;
  } catch (error) {
    console.error("[Firestore Error] getVenueRequestsByVenueIds:", error);
  }
};

/**
 * Real-time listeners for templates belonging to the provided venue IDs.
 */
export const listenToTemplatesByVenueIds = (venueIds, onUpdate) => {
  try {
    if (!Array.isArray(venueIds) || venueIds.length === 0) return () => {};
    const chunkArray = (arr, size) => {
      const chunks = [];
      for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
      return chunks;
    };

    const chunks = chunkArray(venueIds, 10);
    const unsubscribers = [];
    const allTemplatesMap = new Map();
    const onErr = (e) => console.error("[Firestore Error] listenToTemplatesByVenueIds snapshot:", e);

    chunks.forEach((chunk) => {
      const templatesRef = collection(firestore, "templates");
      const templatesQuery = query(templatesRef, where("venueId", "in", chunk));
      const unsubscribe = onSnapshot(
        templatesQuery,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            const docData = change.doc.data();
            const docId = change.doc.id;
            if (change.type === "removed") allTemplatesMap.delete(docId);
            else allTemplatesMap.set(docId, docData);
          });
          onUpdate(Array.from(allTemplatesMap.values()));
        },
        onErr
      );
      unsubscribers.push(unsubscribe);
    });

    return () => unsubscribers.forEach((unsub) => unsub());
  } catch (error) {
    console.error("[Firestore Error] listenToTemplatesByVenueIds init:", error);
  }
};

export const getTemplatesByVenueIds = async (venueIds) => {
  try {
    const templatesCol = collection(firestore, "templates");
    const qy = query(templatesCol, where("venueId", "in", venueIds));
    const snapshot = await getDocs(qy);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error("[Firestore Error] getTemplatesByVenueIds:", error);
  }
};

/**
 * Fetches a venue invite by inviteId.
 */
export const getVenueInviteById = async (inviteId) => {
  if (!inviteId) return null;
  try {
    const ref = doc(firestore, "venueInvites", inviteId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch (error) {
    console.error("[Firestore Error] getVenueInviteById:", error);
  }
};

/**
 * Ensures a venue has a Stripe Customer ID.
 * Fetches and returns the existing stripeCustomerId if present.
 * Returns null if not found or if the document does not exist.
 *
 * @param {string} venueId - The venue's Firestore document ID.
 * @returns {Promise<string|null>} The stripeCustomerId or null.
 */
export const ensureVenueStripeCustomerId = async (venueId) => {
  if (!venueId) {
    console.error("[ensureVenueStripeCustomerId] Missing venueId");
    return null;
  }

  try {
    const ref = doc(firestore, "venueProfiles", venueId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      console.warn(`[ensureVenueStripeCustomerId] Venue ${venueId} does not exist.`);
      return null;
    }

    const data = snap.data();
    return data?.stripeCustomerId || null;
  } catch (error) {
    console.error("[Firestore Error] ensureVenueStripeCustomerId:", error);
    return null;
  }
};

/**
 * Fetches the current user's membership document for a given venue profile.
 *
 * Use this when you already have the venue profile data (to avoid
 * duplicate Firestore reads) but still need the logged-in user’s
 * membership details (permissions, status, etc.).
 *
 * @async
 * @function fetchMyVenueMembership
 * @param {Object} venue - The venue profile object that has already been fetched.
 * @param {string} uid - The UID of the current authenticated user.
 * @returns {Promise<Object>} A copy of the venue object with `myMembership` added:
 *   {
 *     ...venue,                 // all existing venue fields passed in
 *     myMembership: {           // current user's membership doc (if exists)
 *       id: string,
 *       status: string,
 *       permissions: Object,
 *       createdAt: Timestamp,
 *       updatedAt: Timestamp,
 *       ...etc
 *     } | null
 *   }
 *
 * @example
 * const venueProfilesWithMembership = await Promise.all(
 *   completeVenues.map((venue) => fetchMyVenueMembership(venue, currentUser.uid))
 * );
 */
export async function fetchMyVenueMembership(venue, uid) {
  try {
    if (!venue?.venueId) return null;
    const myMemberRef = doc(firestore, "venueProfiles", venue.venueId, "members", uid);
    const myMemberSnap = await getDoc(myMemberRef);
    const myMembership = myMemberSnap.exists()
      ? { id: myMemberSnap.id, ...myMemberSnap.data() }
      : null;
    return { ...venue, myMembership };
  } catch (error) {
    console.error("[Firestore Error] fetchMyVenueMembership:", error);
  }
}

/*** UPDATE OPERATIONS ***/

/**
 * Updates the account name on all venue profile documents associated with a user.
 *
 * @param {string} userId - The UID of the user.
 * @param {string[]} venueProfileIds - Array of venue profile document IDs.
 * @param {string} newAccountName - The new account name to set.
 * @returns {Promise<void>} Resolves when the update is complete.
 * @throws Will throw an error if the update operation fails.
 */
export const updateVenueProfileAccountNames = async (userId, venueProfileIds, newAccountName) => {
  try {
    if (!userId || !venueProfileIds?.length || !newAccountName) return;
    const batch = writeBatch(firestore);
    venueProfileIds.forEach((profile) => {
      const profileRef = doc(firestore, 'venueProfiles', profile.id);
      batch.update(profileRef, { accountName: newAccountName });
    });
    await batch.commit();
  } catch (error) {
    console.error('[Firestore Error] updateVenueProfileAccountNames:', error);
  }
};

/**
 * Marks a venue request as viewed.
 * @param {string} requestId - The ID of the request to update.
 * @returns {Promise<void>}
 */
export const markRequestAsViewed = async (requestId) => {
  try {
    const docRef = doc(firestore, 'venueRequests', requestId);
    await updateDoc(docRef, { viewed: true });
  } catch (error) {
    console.error('[Firestore Error] markRequestAsViewed:', error);
  }
};

/**
 * Marks a venue request as removed by setting `removed: true`.
 * @param {string} requestId - The Firestore document ID of the request.
 * @returns {Promise<void>}
 */
export const removeVenueRequest = async (requestId) => {
  try {
    if (!requestId) throw new Error('Invalid request ID');
    const requestRef = doc(firestore, 'venueRequests', requestId);
    await updateDoc(requestRef, {
      removed: true,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('[Firestore Error] removeVenueRequest:', error);
  }
};

/*** DELETE OPERATIONS ***/

/**
 * Deletes a venue profile from Firestore.
 *
 * @param {string} venueId - Firestore document ID of the venue profile to delete.
 * @returns {Promise<void>}
 */
export const deleteVenueProfile = async (venueId) => {
  try {
    if (!venueId) return;

    const venueRef = doc(firestore, 'venueProfiles', venueId);
    const membersCol = collection(firestore, 'venueProfiles', venueId, 'members');
    // Batch-delete members in pages to avoid 500-op limit
    while (true) {
      const page = await getDocs(query(membersCol, limit(500)));
      if (page.empty) break;
      const batch = writeBatch(firestore);
      page.docs.forEach((snap) => batch.delete(snap.ref));
      await batch.commit();
    }
    await deleteDoc(venueRef);
  } catch (error) {
    console.error('[Firestore Error] deleteVenueProfile:', error);
  }
};

/**
 * Removes a gig ID from the gigs array in a venue's profile.
 *
 * @param {string} venueId - Firestore document ID of the venue.
 * @param {string} gigId - ID of the gig to remove.
 * @returns {Promise<void>}
 */
export const removeGigFromVenue = async (venueId, gigId) => {
  try {
    const ref = doc(firestore, 'venueProfiles', venueId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const updated = (snap.data().gigs || []).filter(id => id !== gigId);
      await updateDoc(ref, { gigs: updated });
    }
  } catch (error) {
    console.error('[Firestore Error] removeGigFromVenue:', error);
  }
};

/**
 * Deletes all templates associated with a specific venue ID.
 *
 * @param {string} venueId - The Firestore document ID of the venue.
 * @returns {Promise<void>}
 */
export const deleteTemplatesByVenueId = async (venueId) => {
  try {
    const templatesQuery = query(
      collection(firestore, 'templates'),
      where('venueId', '==', venueId)
    );
    const templatesSnapshot = await getDocs(templatesQuery);
    const deletionPromises = templatesSnapshot.docs.map((doc) => deleteDoc(doc.ref));
    await Promise.all(deletionPromises);
  } catch (error) {
    console.error('[Firestore Error] deleteTemplatesByVenueId:', error);
  }
};



