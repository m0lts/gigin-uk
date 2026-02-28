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
  deleteField,
  documentId,
  setDoc,
  arrayUnion,
  serverTimestamp,
  limit,
  GeoPoint,
  writeBatch,
  startAfter
} from 'firebase/firestore';
import {
  distanceBetween,
} from 'geofire-common';
import { deleteGigAndInformation } from '../api/gigs';
import { getVenueProfileById } from './venues';

/*** READ OPERATIONS ***/

/**
 * Fetches a gig invite by inviteId from the gigInvites collection
 * @param {string} inviteId - The invite document ID
 * @returns {Promise<Object|null>} - The invite document or null if not found
 */
export const getGigInviteById = async (inviteId) => {
  if (!inviteId) return null;
  try {
    const inviteRef = doc(firestore, 'gigInvites', inviteId);
    const inviteSnap = await getDoc(inviteRef);
    if (!inviteSnap.exists()) return null;
    return { inviteId: inviteSnap.id, ...inviteSnap.data() };
  } catch (error) {
    console.error('[Firestore Error] getGigInviteById:', error);
    return null;
  }
};

/**
 * Finds a gig invite for a specific gig and artist
 * @param {string} gigId - The gig ID
 * @param {string} artistId - The artist profile ID
 * @returns {Promise<string|null>} - The invite ID or null if not found
 */
export const findGigInviteForArtist = async (gigId, artistId) => {
  if (!gigId || !artistId) return null;
  try {
    const invitesRef = collection(firestore, 'gigInvites');
    const q = query(
      invitesRef,
      where('gigId', '==', gigId),
      where('artistId', '==', artistId),
      where('active', '==', true)
    );
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;
    // Return the first matching invite ID
    return querySnapshot.docs[0].id;
  } catch (error) {
    console.error('[Firestore Error] findGigInviteForArtist:', error);
    return null;
  }
};

/**
 * Fetches gigs near the specified location from Firestore using geohash range querying.
 */
export const fetchNearbyGigs = async ({
  location,
  radiusInKm = 50,
  limitCount = 50,
  lastDoc = null,
  filters = {},
}) => {
  try {
    const center = [location.latitude, location.longitude];
    const lat = location.latitude;
    const lng = location.longitude;

    // Bounding box calculation
    const latDelta = radiusInKm / 111; // 1 degree latitude ≈ 111km
    const lngDelta = radiusInKm / (111 * Math.cos(lat * Math.PI / 180));



    const minLat = lat - latDelta;
    const maxLat = lat + latDelta;
    const minLng = lng - lngDelta;
    const maxLng = lng + lngDelta;

    const gigsRef = collection(firestore, 'gigs');

    let q = query(
      gigsRef,
      where('geopoint', '>=', new GeoPoint(minLat, minLng)),
      where('geopoint', '<=', new GeoPoint(maxLat, maxLng)),
      where('status', '==', 'open'),
      where('startDateTime', '>=', Timestamp.now()),
      orderBy('geopoint'),
      orderBy('startDateTime')
    );

    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    // Optional filters
    if (filters.musicianType) {
      q = query(q, where('gigType', '==', filters.musicianType));
    }
    if (filters.kind) {
      q = query(q, where('kind', '==', filters.kind));
    }
    if (typeof filters.minBudget === 'number') {
      q = query(q, where('budgetValue', '>=', filters.minBudget));
    }
    if (typeof filters.maxBudget === 'number') {
      q = query(q, where('budgetValue', '<=', filters.maxBudget));
    }
    if (filters.startDate) {
      const startTimestamp = Timestamp.fromDate(new Date(filters.startDate));
      q = query(q, where('startDateTime', '>=', startTimestamp));
    }
    if (filters.endDate) {
      const endTimestamp = Timestamp.fromDate(new Date(filters.endDate));
      q = query(q, where('startDateTime', '<=', endTimestamp));
    }

    const snapshot = await getDocs(q);

    const filterByGenreManually = filters.genres?.length > 0;

    const toMillis = (ts) => {
      if (!ts) return Number.MAX_SAFE_INTEGER;
      if (typeof ts.toMillis === "function") return ts.toMillis();
      if (typeof ts.toDate === "function") return ts.toDate().getTime();
      if (ts instanceof Date) return ts.getTime();
      return Number(ts) || Number.MAX_SAFE_INTEGER;
    };
    

    const gigs = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(gig => {
        const gp = gig.geopoint;
        if (!gp) return false;

        // Handle Firestore GeoPoint (can have _latitude/_longitude or latitude/longitude)
        const lat = gp.latitude ?? gp._latitude;
        const lng = gp.longitude ?? gp._longitude;
        if (typeof lat !== 'number' || typeof lng !== 'number') return false;

        const dist = distanceBetween(center, [lat, lng]);
        if (dist > radiusInKm) return false;

        // Manual genre filter
        if (filterByGenreManually) {
          const genre = gig.genre;
          if (Array.isArray(genre)) {
            if (genre.length === 0) return true; // Treat empty genre as match-all
            return genre.some(g => filters.genres.includes(g));
          }
          return true; // If genre is missing or not an array, allow it
        }

        return true;
      })
      .sort((a, b) => toMillis(a.startDateTime) - toMillis(b.startDateTime))
      .slice(0, limitCount)
      .map(gig => {
        const gp = gig.geopoint;
        const lat = gp?.latitude ?? gp?._latitude ?? gp?._lat;
        const lng = gp?.longitude ?? gp?._longitude ?? gp?._long;
        const coordinates = (typeof lng === 'number' && typeof lat === 'number') ? [lng, lat] : gig.coordinates;
        return {
          ...gig,
          budget: gig.budget === '£' ? 'No Fee' : gig.budget,
          ...(coordinates && { coordinates }),
        };
      });

    const venueIdsToEnrich = [...new Set(
      gigs
        .filter(g => g.venueId && !g.venue?.photo)
        .map(g => g.venueId)
    )];
    const venueMap = new Map();
    await Promise.all(
      venueIdsToEnrich.map(async (venueId) => {
        const v = await getVenueProfileById(venueId);
        if (v) {
          venueMap.set(venueId, {
            venueName: v.name ?? v.venueName ?? '',
            address: v.address ?? '',
            photo: Array.isArray(v.photos) && v.photos.length > 0 ? v.photos[0] : null,
          });
        }
      })
    );
    const enrichedGigs = gigs.map(gig => {
      if (gig.venue?.photo) return gig;
      const venue = gig.venueId ? venueMap.get(gig.venueId) : null;
      if (!venue) return gig;
      return { ...gig, venue: { ...gig.venue, ...venue } };
    });

    const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;

    return { gigs: enrichedGigs, lastVisible };
  } catch (error) {
    console.error('[Firestore Error] fetchNearbyGigs:', error);
    return { gigs: [], lastVisible: null };
  }
};

/**
 * Subscribes to real-time updates for gigs that are upcoming or within the last 48 hours,
 * for a specific set of venue IDs.
 */
export const subscribeToUpcomingOrRecentGigs = (venueIds, callback) => {
  try {
    if (!venueIds || venueIds.length === 0) {
      console.warn('No venueIds provided to subscribeToUpcomingOrRecentGigs.');
      return () => {};
    }
    const now = new Date();
    const pastCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const futureCutoff = Timestamp.fromDate(pastCutoff);
    const batchSize = 10;
    const allGigs = new Map();
    const unsubscribers = [];
    const onErr = (e) => console.error('[Firestore Error] subscribeToUpcomingOrRecentGigs snapshot:', e);

    for (let i = 0; i < venueIds.length; i += batchSize) {
      const batch = venueIds.slice(i, i + batchSize);
      const gigsRef = collection(firestore, 'gigs');
      const futureQuery = query(
        gigsRef,
        where('venueId', 'in', batch),
        where('date', '>=', futureCutoff)
      );
      const pastQuery = query(
        gigsRef,
        where('venueId', 'in', batch),
        where('date', '<', futureCutoff)
      );

      const handleSnapshot = (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const gig = { gigId: change.doc.id, ...change.doc.data() };
          if (change.type === 'removed') {
            allGigs.delete(change.doc.id);
          } else {
            allGigs.set(change.doc.id, gig);
          }
        });
        callback(Array.from(allGigs.values()));
      };

      unsubscribers.push(onSnapshot(futureQuery, handleSnapshot, onErr));
      unsubscribers.push(onSnapshot(pastQuery, handleSnapshot, onErr));
    }

    return () => unsubscribers.forEach((unsub) => unsub());
  } catch (error) {
    console.error('[Firestore Error] subscribeToUpcomingOrRecentGigs init:', error);
    return () => {};
  }
};

/**
 * Fetches a single gig document by its ID.
 */
export const getGigById = async (gigId) => {
  try {
    const gigRef = doc(firestore, 'gigs', gigId);
    const snap = await getDoc(gigRef);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (error) {
    console.error('[Firestore Error] getGigById:', error);
    return null;
  }
};

/**
 * Fetches multiple gig documents based on an array of gig IDs.
 */
export const getGigsByIds = async (gigIds) => {
  try {
    if (!Array.isArray(gigIds) || gigIds.length === 0) return [];
    const gigsRef = collection(firestore, 'gigs');
    const chunkedIds = [];
    for (let i = 0; i < gigIds.length; i += 10) {
      chunkedIds.push(gigIds.slice(i, i + 10));
    }
    const gigs = [];
    for (const chunk of chunkedIds) {
      const q = query(gigsRef, where(documentId(), 'in', chunk));
      const snapshot = await getDocs(q);
      snapshot.docs.forEach(doc => {
        gigs.push({ id: doc.id, ...doc.data() });
      });
    }
    return gigs;
  } catch (error) {
    console.error('[Firestore Error] getGigsByIds:', error);
    return [];
  }
};

/**
 * Retrieves all gigs created by a specific venue.
 */
export const getGigsByVenueId = async (venueId) => {
  try {
    const q = query(collection(firestore, 'gigs'), where('venueId', '==', venueId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }));
  } catch (error) {
    console.error('[Firestore Error] getGigsByVenueId:', error);
    return [];
  }
};

/**
 * Retrieves all gigs created by a list of venue IDs.
 */
export const getGigsByVenueIds = async (venueIds) => {
  try {
    if (!venueIds.length) return [];
    const q = query(collection(firestore, 'gigs'), where('venueId', 'in', venueIds));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('[Firestore Error] getGigsByVenueIds:', error);
    return [];
  }
};

/*** DELETE OPERATIONS ***/

/**
 * Deletes multiple gigs and cleans up their references.
 */
export const deleteGigsBatch = async (gigIds) => {
  for (const gigId of gigIds) {
    try {
      await deleteGigAndInformation({ gigId });
    } catch (error) {
      console.error(`[CloudFn Error] deleteGigsBatch (gigId: ${gigId}):`, error);
    }
  }
};