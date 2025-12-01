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
  setDoc,
  deleteDoc,
  onSnapshot,
  Timestamp,
  orderBy,
  arrayRemove,
  documentId,
  writeBatch,
  limit,
  startAfter,
  arrayUnion
} from 'firebase/firestore';
import { getMostRecentMessage } from './messages';
import { updateGigDocument } from '../api/gigs';
import { getOrCreateConversation } from '../api/conversations';
import { updateMessageDoc } from '../api/messages';
import { v4 as uuidv4 } from 'uuid';
import { updateArtistProfile, updateArtistMemberPermissions } from '../api/artists';


/*** CREATE OPERATIONS ***/

/**
 * Generates a new Firestore document reference ID for the artistProfiles collection.
 */
export const generateArtistProfileId = () => uuidv4();

/**
 * Creates (or overwrites) an artist profile document with the provided data.
 *
 * @param {Object} params
 * @param {string} params.profileId - The Firestore document ID to use.
 * @param {string} params.userId - The UID of the user who owns the profile.
 * @param {Object} [params.initialData={}] - Optional overrides for the default payload.
 * @returns {Promise<string>} - The profile ID that was written.
 */
export const createArtistProfileDocument = async ({ profileId, userId, initialData = {}, darkMode = false, userData = null }) => {
  if (!profileId) throw new Error('[createArtistProfileDocument] profileId is required');
  if (!userId) throw new Error('[createArtistProfileDocument] userId is required');

  const now = Timestamp.now();
  const defaultData = {
    userId,
    status: 'draft',
    onboardingStep: 'hero-image',
    isComplete: false,
    darkMode,
    name: '',
    bio: '',
    location: null,
    genres: [],
    videos: [],
    tracks: [],
    heroMedia: null,
    heroBrightness: 100,
    heroPositionY: 50,
    createdAt: now,
    updatedAt: now,
  };

  const payload = { ...defaultData, ...initialData };
  const docRef = doc(firestore, 'artistProfiles', profileId);
  await setDoc(docRef, payload, { merge: false });

  // Check if user has Stripe Connect account
  const userRef = doc(firestore, 'users', userId);
  const userSnap = await getDoc(userRef);
  const userDoc = userSnap.exists() ? userSnap.data() : {};
  const hasStripeConnect = !!userDoc.stripeConnectId;

  // Initialize members sub-collection with creator as owner
  const memberRef = doc(firestore, 'artistProfiles', profileId, 'members', userId);
  const ownerPermissions = {
    'profile.viewer': true,
    'profile.edit': true,
    'gigs.book': true,
    'finances.edit': true,
  };
  
  await setDoc(memberRef, {
    status: 'active',
    role: 'owner',
    permissions: ownerPermissions,
    addedBy: userId,
    userId: userId,
    userName: userData?.name || null,
    userEmail: userData?.email || null,
    payoutSharePercent: 100, // Owner gets 100% by default
    payoutsEnabled: hasStripeConnect, // Enabled if user has Stripe Connect account
    createdAt: now,
    updatedAt: now,
  }, { merge: false });

  return profileId;
};

export const updateArtistProfileDocument = async (profileId, updates = {}) => {
  if (!profileId) throw new Error('[updateArtistProfileDocument] profileId is required');
  try {
    await updateArtistProfile({ artistProfileId: profileId, updates });
  } catch (error) {
    console.error('[API Error] updateArtistProfileDocument:', error);
    throw error;
  }
};

/**
 * Fetches all members of an artist profile.
 * @param {string} profileId - The artist profile ID
 * @returns {Promise<Array>} Array of member objects
 */
export const getArtistProfileMembers = async (profileId) => {
  if (!profileId) throw new Error('[getArtistProfileMembers] profileId is required');
  try {
    const membersRef = collection(firestore, 'artistProfiles', profileId, 'members');
    const snapshot = await getDocs(membersRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('[Firestore Error] getArtistProfileMembers:', error);
    throw error;
  }
};

/**
 * Updates a member's permissions in an artist profile.
 * @param {string} profileId - The artist profile ID
 * @param {string} memberId - The member's user ID
 * @param {Object} permissions - The permissions object
 * @returns {Promise<void>}
 */
export const updateArtistProfileMemberPermissions = async (profileId, memberId, permissions) => {
  if (!profileId) throw new Error('[updateArtistProfileMemberPermissions] profileId is required');
  if (!memberId) throw new Error('[updateArtistProfileMemberPermissions] memberId is required');
  try {
    await updateArtistMemberPermissions({
      artistProfileId: profileId,
      memberId,
      permissionsInput: permissions,
    });
  } catch (error) {
    console.error('[API Error] updateArtistProfileMemberPermissions:', error);
    throw error;
  }
};

/**
 * Updates payout settings for a member in an artist profile.
 * @param {string} profileId - The artist profile ID
 * @param {string} memberId - The member's user ID
 * @param {Object} payoutSettings - Object with payoutSharePercent and/or payoutsEnabled
 * @returns {Promise<void>}
 */
export const updateArtistProfileMemberPayoutSettings = async (profileId, memberId, payoutSettings) => {
  if (!profileId) throw new Error('[updateArtistProfileMemberPayoutSettings] profileId is required');
  if (!memberId) throw new Error('[updateArtistProfileMemberPayoutSettings] memberId is required');
  try {
    const memberRef = doc(firestore, 'artistProfiles', profileId, 'members', memberId);
    await updateDoc(memberRef, { 
      ...payoutSettings,
      updatedAt: Timestamp.now() 
    });
  } catch (error) {
    console.error('[Firestore Error] updateArtistProfileMemberPayoutSettings:', error);
    throw error;
  }
};

/**
 * Updates payoutsEnabled for a user across all artistProfiles they are a member of.
 * This is called when a user completes Stripe Connect onboarding.
 * @param {string} userId - The user ID
 * @param {boolean} payoutsEnabled - Whether payouts are enabled
 * @returns {Promise<void>}
 */
export const updateUserPayoutsEnabledAcrossAllProfiles = async (userId, payoutsEnabled) => {
  if (!userId) throw new Error('[updateUserPayoutsEnabledAcrossAllProfiles] userId is required');
  try {
    // Get user document to find all artistProfiles they belong to
    const userRef = doc(firestore, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      console.warn('[updateUserPayoutsEnabledAcrossAllProfiles] User document not found');
      return;
    }
    
    const userData = userSnap.data();
    const artistProfileIds = Array.isArray(userData.artistProfiles) ? userData.artistProfiles : [];
    
    if (artistProfileIds.length === 0) {
      return; // User is not a member of any artist profiles
    }

    // Update all member documents in parallel
    const updatePromises = artistProfileIds.map(async (profileId) => {
      try {
        const memberRef = doc(firestore, 'artistProfiles', profileId, 'members', userId);
        await updateDoc(memberRef, {
          payoutsEnabled,
          updatedAt: Timestamp.now(),
        });
      } catch (error) {
        // Log error but continue with other updates
        console.error(`[updateUserPayoutsEnabledAcrossAllProfiles] Failed to update member in profile ${profileId}:`, error);
      }
    });

    await Promise.all(updatePromises);
  } catch (error) {
    console.error('[Firestore Error] updateUserPayoutsEnabledAcrossAllProfiles:', error);
    throw error;
  }
};

/**
 * Removes a member from an artist profile.
 * @param {string} profileId - The artist profile ID
 * @param {string} memberId - The member's user ID
 * @returns {Promise<void>}
 */
export const removeArtistProfileMember = async (profileId, memberId) => {
  if (!profileId) throw new Error('[removeArtistProfileMember] profileId is required');
  if (!memberId) throw new Error('[removeArtistProfileMember] memberId is required');
  try {
    const memberRef = doc(firestore, 'artistProfiles', profileId, 'members', memberId);
    await deleteDoc(memberRef);
  } catch (error) {
    console.error('[Firestore Error] removeArtistProfileMember:', error);
    throw error;
  }
};

/**
 * Fetches all pending invites for an artist profile.
 * @param {string} profileId - The artist profile ID
 * @returns {Promise<Array>} Array of pending invite objects
 */
export const getArtistProfilePendingInvites = async (profileId) => {
  if (!profileId) throw new Error('[getArtistProfilePendingInvites] profileId is required');
  try {
    const invitesRef = collection(firestore, 'artistInvites');
    const q = query(
      invitesRef,
      where('artistProfileId', '==', profileId),
      where('status', '==', 'pending')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('[Firestore Error] getArtistProfilePendingInvites:', error);
    throw error;
  }
};


/**
 * Creates or updates a musician profile in Firestore.
 */
export const createMusicianProfile = async (musicianId, data, userId) => {
  try {
    const ref = doc(firestore, 'musicianProfiles', musicianId);
    await setDoc(ref, { ...data, userId }, { merge: true });
  } catch (error) {
    console.error('[Firestore Error] createMusicianProfile:', error);
  }
};

/*** READ OPERATIONS ***/

/**
 * Subscribes to real-time updates for a musician profile document.
 */
export const subscribeToMusicianProfile = (musicianId, callback, onError) => {
  try {
    const ref = doc(firestore, 'musicianProfiles', musicianId);
    const onErr = (e) => {
      if (onError) onError(e);
      else console.error('[Firestore Error] subscribeToMusicianProfile snapshot:', e);
    };
    return onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) callback({ id: snap.id, ...snap.data() });
        else callback(null);
      },
      onErr
    );
  } catch (error) {
    console.error('[Firestore Error] subscribeToMusicianProfile init:', error);
  }
};

/**
 * Fetches the musician profile associated with a given user ID.
 */
export const getMusicianProfileByUserId = async (userId) => {
  try {
    const qy = query(collection(firestore, 'musicianProfiles'), where('userId', '==', userId));
    const snapshot = await getDocs(qy);
    const d = snapshot.docs[0];
    return d ? { id: d.id, ...d.data() } : null;
  } catch (error) {
    console.error('[Firestore Error] getMusicianProfileByUserId:', error);
  }
};

/**
 * Fetches a musician profile by its Firestore document ID.
 */
export const getMusicianProfileByMusicianId = async (musicianId) => {
  try {
    const ref = doc(firestore, 'musicianProfiles', musicianId);
    const snap = await getDoc(ref);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (error) {
    console.error('[Firestore Error] getMusicianProfileByMusicianId:', error);
  }
};

/**
 * Fetches an artist profile by its Firestore document ID.
 */
export const getArtistProfileById = async (artistId) => {
  try {
    const ref = doc(firestore, 'artistProfiles', artistId);
    const snap = await getDoc(ref);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (error) {
    console.error('[Firestore Error] getArtistProfileById:', error);
  }
};

/**
 * Fetches multiple musician profiles by their Firestore document IDs.
 */
export const getMusicianProfilesByIds = async (musicianIds) => {
  try {
    if (!musicianIds || musicianIds.length === 0) return [];
    const chunks = [];
    for (let i = 0; i < musicianIds.length; i += 10) chunks.push(musicianIds.slice(i, i + 10));

    const results = await Promise.all(
      chunks.map(async (chunk) => {
        const qy = query(collection(firestore, 'musicianProfiles'), where(documentId(), 'in', chunk));
        const snapshot = await getDocs(qy);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      })
    );
    return results.flat();
  } catch (error) {
    console.error('[Firestore Error] getMusicianProfilesByIds:', error);
  }
};

/**
 * Fetches musician profiles with simple pagination & filters.
 */
// Legacy musicians search (kept for backwards compatibility)
export const fetchMusiciansPaginated = async ({ lastDocId, limitCount = 50, type, genres, location, search }) => {
  try {
    let base = collection(firestore, 'musicianProfiles');
    const constraints = [];

    if (type === 'Musician') constraints.push(where('musicianType', '==', 'Musician'));
    else if (type === 'Band') constraints.push(where('musicianType', '==', 'Band'));
    else if (type === 'DJ') constraints.push(where('musicianType', '==', 'DJ'));

    if (genres?.length) constraints.push(where('genres', 'array-contains-any', genres));
    // if (location) constraints.push(where('location.city', '==', location));
    if (search) constraints.push(where('searchKeywords', 'array-contains', search.toLowerCase()));

    if (lastDocId) {
      const lastDocSnap = await getDoc(doc(firestore, 'musicianProfiles', lastDocId));
      if (lastDocSnap.exists()) constraints.push(startAfter(lastDocSnap));
    }

    constraints.push(limit(limitCount));
    const qy = query(base, ...constraints);

    const snap = await getDocs(qy);
    const musicians = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const lastDoc = snap.docs.at(-1)?.id || null;

    return { musicians, lastDocId: lastDoc };
  } catch (error) {
    console.error('[Firestore Error] fetchMusiciansPaginated:', error);
  }
};

// New artists search for venue "Find Artists" using artistProfiles
export const fetchArtistsPaginated = async ({ lastDocId, limitCount = 50, genres, search, type }) => {
  try {
    const base = collection(firestore, 'artistProfiles');
    const constraints = [];

    if (genres?.length) {
      constraints.push(where('genres', 'array-contains-any', genres));
    }

    if (type === 'Musician/Band' || type === 'DJ') {
      constraints.push(where('artistType', '==', type));
    }

    if (lastDocId) {
      const lastDocSnap = await getDoc(doc(firestore, 'artistProfiles', lastDocId));
      if (lastDocSnap.exists()) constraints.push(startAfter(lastDocSnap));
    }

    constraints.push(limit(limitCount));
    const qy = query(base, ...constraints);
    const snap = await getDocs(qy);

    let artists = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Apply search filtering client-side on name to avoid requiring new indexes
    if (search) {
      const term = search.toLowerCase();
      artists = artists.filter((artist) =>
        (artist.name || '').toLowerCase().includes(term)
      );
    }

    const last = snap.docs.at(-1)?.id || null;
    return { artists, lastDocId: last };
  } catch (error) {
    console.error('[Firestore Error] fetchArtistsPaginated:', error);
    return { artists: [], lastDocId: null };
  }
};

/**
 * Fetches the cleared and pending fees for a given musician profile.
 */
export const getMusicianFees = async (musicianProfileId) => {
  try {
    if (!musicianProfileId) {
      console.error('[Firestore Error] getMusicianFees: missing musicianProfileId');
      return { clearedFees: [], pendingFees: [] };
    }
    const clearedFeesRef = collection(firestore, `musicianProfiles/${musicianProfileId}/clearedFees`);
    const pendingFeesRef = collection(firestore, `musicianProfiles/${musicianProfileId}/pendingFees`);
    const [clearedSnapshot, pendingSnapshot] = await Promise.all([getDocs(clearedFeesRef), getDocs(pendingFeesRef)]);
    const clearedFees = clearedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const pendingFees = pendingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { clearedFees, pendingFees };
  } catch (error) {
    console.error('[Firestore Error] getMusicianFees:', error);
  }
};

/**
 * Fetches the cleared and pending fees for a given artist profile.
 * Uses the new artistProfiles collection (mirrors getMusicianFees for backwards compatibility).
 */
export const getArtistProfileFees = async (artistProfileId) => {
  try {
    if (!artistProfileId) {
      console.error('[Firestore Error] getArtistProfileFees: missing artistProfileId');
      return { clearedFees: [], pendingFees: [] };
    }
    const clearedFeesRef = collection(firestore, `artistProfiles/${artistProfileId}/clearedFees`);
    const pendingFeesRef = collection(firestore, `artistProfiles/${artistProfileId}/pendingFees`);
    const [clearedSnapshot, pendingSnapshot] = await Promise.all([
      getDocs(clearedFeesRef),
      getDocs(pendingFeesRef),
    ]);
    const clearedFees = clearedSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const pendingFees = pendingSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return { clearedFees, pendingFees };
  } catch (error) {
    console.error('[Firestore Error] getArtistProfileFees:', error);
  }
};


/*** UPDATE OPERATIONS ***/

/**
 * Updates the musician profile document with the provided data.
 */
export const updateMusicianProfile = async (musicianId, data) => {
  try {
    const ref = doc(firestore, 'musicianProfiles', musicianId);
    await updateDoc(ref, data);
  } catch (error) {
    console.error('[Firestore Error] updateMusicianProfile:', error);
  }
};

/**
 * Adds an application record to a musician’s profile.
 */
export const updateMusicianGigApplications = async (profile, gigId) => {
  try {
    const musicianRef = doc(firestore, 'musicianProfiles', profile.musicianId);
    const entry = { gigId, profileId: profile.musicianId, name: profile.name };
    await updateDoc(musicianRef, { gigApplications: arrayUnion(entry) });
  } catch (error) {
    console.error('[Firestore Error] updateMusicianGigApplications:', error);
  }
};

/**
 * Adds an application record to an artist profile.
 */
export const updateArtistGigApplications = async (profile, gigId) => {
  try {
    const artistId = profile?.id || profile?.profileId || profile?.musicianId;
    if (!artistId) {
      console.error('[Firestore Error] updateArtistGigApplications: missing profile.id');
      return;
    }
    const artistRef = doc(firestore, 'artistProfiles', artistId);
    const entry = { gigId, profileId: artistId, name: profile.name };
    await updateDoc(artistRef, { gigApplications: arrayUnion(entry) });
  } catch (error) {
    console.error('[Firestore Error] updateArtistGigApplications:', error);
  }
};

/**
 * Adds a gig application record to the band profile.
 */
export const updateBandMembersGigApplications = async (band, gigId) => {
  try {
    const batch = writeBatch(firestore);
    const bandEntry = { gigId, profileId: band.musicianId, name: band.name };
    const bandRef = doc(firestore, 'musicianProfiles', band.musicianId);
    batch.update(bandRef, { gigApplications: arrayUnion(bandEntry) });
    await batch.commit();
  } catch (error) {
    console.error('[Firestore Error] updateBandMembersGigApplications:', error);
  }
};

/*** DELETE OPERATIONS ***/

/**
 * Deletes a musician profile from Firestore.
 */
export const deleteMusicianProfile = async (musicianId) => {
  try {
    const musicianRef = doc(firestore, 'musicianProfiles', musicianId);
    await deleteDoc(musicianRef);
  } catch (error) {
    console.error('[Firestore Error] deleteMusicianProfile:', error);
  }
};

/**
 * Withdraw a musician/band application from a gig.
 * @returns {Promise<Object[]|null>} Updated applicants array, or null on error/not found.
 */
export async function withdrawMusicianApplication(gigId, profile, userId) {
  try {

    if (!gigId || !profile?.musicianId) {
      console.error('[Firestore Error] withdrawMusicianApplication: missing gigId or profile.musicianId');
      return null;
    }

    const applicantId = profile.musicianId;
    const gigRef = doc(firestore, 'gigs', gigId);
    const gigSnap = await getDoc(gigRef);

    if (!gigSnap.exists()) return null;

    const gig = gigSnap.data() || {};

    const applicants = Array.isArray(gig.applicants) ? gig.applicants : [];

    const hasApplied = applicants.some(a => a?.id === applicantId);
    if (!hasApplied) return applicants;

    const target = applicants.find(a => a?.id === applicantId);

    if (target?.status === 'accepted' || target?.status === 'confirmed') {
      console.error('[Firestore Error] withdrawMusicianApplication: cannot withdraw accepted/confirmed application');
      return applicants;
    }

    const updatedApplicants = applicants.map(a =>
      a?.id === applicantId ? { ...a, status: 'withdrawn' } : a
    );

    await updateGigDocument({ gigId, action: 'musician.withdraw.application', updates: { applicants: updatedApplicants } });

    const batch = writeBatch(firestore);
    const pruneApps = (apps = []) =>
      apps.filter(entry => !(entry?.gigId === gigId && entry?.profileId === applicantId));

    const musicianRef = doc(firestore, 'musicianProfiles', applicantId);
    let apps = Array.isArray(profile.gigApplications) ? profile.gigApplications : null;
    if (!apps) {
      const musSnap = await getDoc(musicianRef);
      apps = Array.isArray(musSnap.data()?.gigApplications) ? musSnap.data().gigApplications : [];
    }
    batch.update(musicianRef, { gigApplications: pruneApps(apps) });


    await batch.commit();

    const venueRef = doc(firestore, 'venueProfiles', gig.venueId);
    const venueSnap = await getDoc(venueRef);
    const venueProfile = venueSnap.exists() ? (venueSnap.data() || {}) : {};

    const { conversationId } = await getOrCreateConversation({
      profile,
      gig: { ...gig, gigId },
      venueProfile,
      type: 'withdrawal'
    });

    const lastAppMsg = await getMostRecentMessage(conversationId, 'application');
    const lastNegMsg = await getMostRecentMessage(conversationId, 'negotiation');

    if (lastAppMsg?.id) {
      await updateMessageDoc({
        conversationId,
        messageId: lastAppMsg.id,
        updates: { status: "withdrawn" },
        conversationUpdates: {
          lastMessage: `${profile.name} has withdrawn their application.`,
          lastMessageSenderId: "system",
        },
      });
    }
    
    // Do the same for negotiation, if present
    if (lastNegMsg?.id) {
      await updateMessageDoc({
        conversationId,
        messageId: lastNegMsg.id,
        updates: { status: "withdrawn" },
        conversationUpdates: {
          lastMessage: `${profile.name} has withdrawn their application.`,
          lastMessageSenderId: "system",
        },
      });
    }

    return updatedApplicants;
  } catch (error) {
    console.error('[Firestore Error] withdrawMusicianApplication:', error);
  }
}

export async function withdrawArtistApplication(gigId, profile) {
  try {
    const applicantId = profile?.id || profile?.profileId || profile?.musicianId;
    if (!gigId || !applicantId) {
      console.error('[Firestore Error] withdrawArtistApplication: missing gigId or profile.id');
      return null;
    }

    const gigRef = doc(firestore, 'gigs', gigId);
    const gigSnap = await getDoc(gigRef);
    if (!gigSnap.exists()) return null;

    const gig = gigSnap.data() || {};
    const applicants = Array.isArray(gig.applicants) ? gig.applicants : [];
    const hasApplied = applicants.some((a) => a?.id === applicantId);
    if (!hasApplied) return applicants;

    const target = applicants.find((a) => a?.id === applicantId);
    if (target?.status === 'accepted' || target?.status === 'confirmed') {
      console.error('[Firestore Error] withdrawArtistApplication: cannot withdraw accepted/confirmed application');
      return applicants;
    }

    const updatedApplicants = applicants.map((a) =>
      a?.id === applicantId ? { ...a, status: 'withdrawn' } : a
    );

    await updateGigDocument({
      gigId,
      action: 'artist.withdraw.application',
      updates: { applicants: updatedApplicants },
    });

    const batch = writeBatch(firestore);
    const pruneApps = (entries = []) =>
      entries.filter((entry) => !(entry?.gigId === gigId && (entry?.profileId === applicantId || !entry?.profileId)));

    const artistRef = doc(firestore, 'artistProfiles', applicantId);
    let apps = Array.isArray(profile?.gigApplications) ? profile.gigApplications : null;
    if (!apps) {
      const artistSnap = await getDoc(artistRef);
      apps = Array.isArray(artistSnap.data()?.gigApplications) ? artistSnap.data().gigApplications : [];
    }
    batch.update(artistRef, { gigApplications: pruneApps(apps) });
    await batch.commit();

    const venueRef = doc(firestore, 'venueProfiles', gig.venueId);
    const venueSnap = await getDoc(venueRef);
    const venueProfile = venueSnap.exists() ? (venueSnap.data() || {}) : {};

    const conversationProfile = {
      ...profile,
      musicianId: applicantId,
      profileId: applicantId,
    };

    const { conversationId } = await getOrCreateConversation({
      musicianProfile: conversationProfile,
      gigData: { ...gig, gigId },
      venueProfile,
      type: 'withdrawal',
    });

    const lastAppMsg = await getMostRecentMessage(conversationId, 'application');
    const lastNegMsg = await getMostRecentMessage(conversationId, 'negotiation');

    if (lastAppMsg?.id) {
      await updateMessageDoc({
        conversationId,
        messageId: lastAppMsg.id,
        updates: { status: 'withdrawn' },
        conversationUpdates: {
          lastMessage: `${profile.name} has withdrawn their application.`,
          lastMessageSenderId: 'system',
        },
      });
    }

    if (lastNegMsg?.id) {
      await updateMessageDoc({
        conversationId,
        messageId: lastNegMsg.id,
        updates: { status: 'withdrawn' },
        conversationUpdates: {
          lastMessage: `${profile.name} has withdrawn their application.`,
          lastMessageSenderId: 'system',
        },
      });
    }

    return updatedApplicants;
  } catch (error) {
    console.error('[Firestore Error] withdrawArtistApplication:', error);
    throw error;
  }
}
