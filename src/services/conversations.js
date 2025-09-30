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
  writeBatch,
  limit,
  startAfter,
  serverTimestamp
} from 'firebase/firestore';
import { formatDate } from './utils/dates';
import { getBandMembers } from './bands';

/*** HELPERS ***/
async function fetchActiveVenueMembersSlim(venueId) {
  const qMembers = query(
    collection(firestore, "venueProfiles", venueId, "members"),
    where("status", "==", "active")
  );
  const memSnap = await getDocs(qMembers);
  if (memSnap.empty) return [];
  // return a slim list with what you stored on the member doc
  return memSnap.docs.map(d => ({
    uid: d.id,
    ...d.data(), // e.g. { displayName, picture, role, permissions, ... }
  }));
}

/*** CREATE OPERATIONS ***/

/**
 * Fetches an existing conversation by musicianId and gigId, or creates one if it doesn't exist.
 *
 * @param {Object} musicianProfile - The musician profile object.
 * @param {Object} gigData - The gig object, must include `gigId`, `venueId`, `date`, and `venue`.
 * @param {Object} venueProfile - The venue profile object.
 * @param {'application'|'negotiation'} type - Type of message to set an appropriate `lastMessage`.
 * @returns {Promise<string>} - The ID of the existing or newly created conversation.
 */
export const getOrCreateConversation = async (musicianProfile, gigData, venueProfile, type = 'application') => {
  const isBand = !!musicianProfile.bandProfile;
  const bandId = musicianProfile.musicianId;

  // Step 1: Check if conversation already exists
  const conversationsRef = collection(firestore, 'conversations');
  const conversationQuery = query(
    conversationsRef,
    where('participants', 'array-contains', bandId),
    where('gigId', '==', gigData.gigId)
  );
  const conversationSnapshot = await getDocs(conversationQuery);
  if (!conversationSnapshot.empty) {
    return conversationSnapshot.docs[0].id;
  }

  // Step 2: Build participants + accountNames
  let participants = [gigData.venueId];
  let accountNames = [];

  // 2a) If the venue has multiple members, add each active member (as venue staff) to accountNames
  try {
    const activeMembers = await fetchActiveVenueMembersSlim(gigData.venueId);
    const existingIds = new Set(accountNames.map(a => a.accountId).filter(Boolean));

    for (const m of activeMembers) {
      const uid = m.uid;
      if (existingIds.has(uid)) continue;
      accountNames.push({
        participantId: gigData.venueId,   // they speak “as the venue”
        accountName: m.displayName || m.name || venueProfile.accountName || "Venue Staff",
        accountId: uid,                   // real userId used for auth checks
        role: "venue",
        accountImg: m.picture || null,
      });
      existingIds.add(uid);
    }
  } catch (e) {
    // Non-fatal—if members fetch fails, we still create the conversation
    console.warn("Failed to append venue members to accountNames:", e);
  }

  if (isBand) {
    const bandMembers = await getBandMembers(bandId);
    const memberIds = bandMembers.map((m) => m.musicianProfileId);
    participants.push(...memberIds, bandId);

    accountNames.push({
      participantId: bandId,
      accountName: musicianProfile.name,
      accountId: musicianProfile.userId,
      role: 'band',
      musicianImg: musicianProfile.picture || null,
    });

    for (const member of bandMembers) {
      accountNames.push({
        participantId: member.musicianProfileId,
        accountName: member.memberName,
        accountId: member.memberUserId,
        role: member.role || 'Band Member',
        musicianImg: member.memberImg || null,
      });
    }
  } else {
    participants.push(musicianProfile.musicianId);
    accountNames.push({
      participantId: musicianProfile.musicianId,
      accountName: musicianProfile.name,
      accountId: musicianProfile.userId,
      role: 'musician',
      musicianImg: musicianProfile.picture || null,
    });
  }

  // Step 3: Construct message
  const lastMessage =
    type === 'negotiation'
      ? `${musicianProfile.name} wants to negotiate the fee on ${formatDate(gigData.date)} at ${gigData.venue.venueName}.`
      : type === 'application'
      ? `${musicianProfile.name} applied to the gig on ${formatDate(gigData.date)} at ${gigData.venue.venueName}.`
      : type === 'invitation'
      ? `${venueProfile.accountName} has invited you to play at their gig on ${formatDate(gigData.date)}.`
      : type === 'dispute'
      ? `${venueProfile.accountName} has disputed the gig performed on ${formatDate(gigData.date)}.`
      : '';

  // Step 4: Save to Firestore
  const conversationPayload = {
    participants,
    venueImg: venueProfile.photos?.[0] || null,
    venueName: gigData.venue.venueName,
    accountNames,
    gigDate: gigData.date,
    gigId: gigData.gigId,
    lastMessage,
    lastMessageTimestamp: Timestamp.now(),
    status: 'open',
    createdAt: Timestamp.now(),
    bandConversation: isBand ? true : false,
  };
  const conversationDocRef = await addDoc(conversationsRef, conversationPayload);
  return conversationDocRef.id;
};

/*** READ OPERATIONS ***/

/**
 * Subscribes to real-time updates for all conversations involving the user's musician or venue profiles.
 * 
 * @param {Object} user - The current authenticated user.
 * @param {function} callback - Function to call with the full merged list of updated conversations.
 * @returns {function} - Unsubscribe function to stop listening.
 */
export const listenToUserConversations = (user, callback) => {
  const convoRef = collection(firestore, 'conversations');
  const queries = [];

  if (user.musicianProfile?.musicianId) {
    queries.push(query(convoRef, where('participants', 'array-contains', user.musicianProfile.musicianId)));
  }

  if (user.venueProfiles?.length) {
    user.venueProfiles.forEach(venue => {
      queries.push(query(convoRef, where('participants', 'array-contains', venue.id)));
    });
  }

  const mergedConversations = new Map();

  const unsubFns = queries.map(q =>
    onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(change => {
        const data = { id: change.doc.id, ...change.doc.data() };
        if (change.type === 'removed') {
          mergedConversations.delete(change.doc.id);
        } else {
          mergedConversations.set(change.doc.id, data);
        }
      });

      callback(Array.from(mergedConversations.values()));
    })
  );

  return () => unsubFns.forEach(unsub => unsub());
};

/**
 * Fetches all conversations that include a specific participant ID.
 *
 * @param {string} participantId - The ID of the participant to search for in the conversation.
 * @returns {Promise<Array<Object>>} An array of conversation documents (`{ id, ref, ...data }`).
 */
export const getConversationsByParticipantId = async (participantId) => {
    const q = query(collection(firestore, 'conversations'), where('participants', 'array-contains', participantId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }));
};

/**
 * Fetches all conversations that include a specific participant ID and match a specific gig ID.
 *
 * @param {string} gigId - The ID of the gig to filter conversations by.
 * @param {string} participantId - The ID of the participant to search for in the conversation.
 * @returns {Promise<Array<Object>>} An array of conversation documents (`{ id, ref, ...data }`).
 */
export const getConversationsByParticipantAndGigId = async (gigId, participantId) => {
  const q = query(
    collection(firestore, 'conversations'),
    where('participants', 'array-contains', participantId),
    where('gigId', '==', gigId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }));
};

/**
 * Fetches all conversations that include any of the specified participant IDs.
 *
 * @param {string[]} participantIds - An array of participant IDs.
 * @returns {Promise<Array<Object>>} An array of conversation documents (`{ id, ref, ...data }`).
 */
export const getConversationsByParticipants = async (participantIds) => {
    if (!participantIds.length) return [];
    const q = query(collection(firestore, 'conversations'), where('participants', 'array-contains-any', participantIds));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }));
};

export const getUserRoleInConversation = ({ conversation, currentUserId, currentMusicianProfileId }) => {
  const { accountNames, participants } = conversation;

  // Must be in participants array
  if (!participants.includes(currentMusicianProfileId)) return null;

  // Find user's metadata
  const metadata = accountNames.find(
    (entry) => entry.accountId === currentUserId && entry.participantId === currentMusicianProfileId
  );

  if (!metadata) return null;

  return metadata.role; // e.g., "Band Member", "Band Leader", "musician", "venue"
};


/*** UPDATE OPERATIONS ***/

/**
 * Updates the 'lastViewed' timestamp for a conversation for a specific user.
 * 
 * @param {string} conversationId 
 * @param {string} userId 
 */
export const updateConversationLastViewed = async (conversationId, userId) => {
    const conversationRef = doc(firestore, 'conversations', conversationId);
    await updateDoc(conversationRef, {
        [`lastViewed.${userId}`]: Timestamp.now()
    });
};

/**
 * Updates a conversation document with provided data.
 *
 * @param {string} convId - ID of the conversation document.
 * @param {Object} updates - Partial updates to apply.
 * @returns {Promise<void>}
 */
export const updateConversationDocument = async (convId, updates) => {
  const convRef = doc(firestore, 'conversations', convId);
  await updateDoc(convRef, updates);
};

/**
 * Updates the specified applicant in a gig to mark their application as viewed.
 * 
 * @param {string} gigId 
 * @param {string} musicianId 
 */
export const markGigApplicantAsViewed = async (gigId, musicianId) => {
    const gigRef = doc(firestore, 'gigs', gigId);
    const gigSnapshot = await getDoc(gigRef);
    if (!gigSnapshot.exists()) return;
    const gigData = gigSnapshot.data();
    const updatedApplicants = gigData.applicants.map(applicant =>
        applicant.id === musicianId ? { ...applicant, viewed: true } : applicant
    );
    await updateDoc(gigRef, { applicants: updatedApplicants });
};

/**
 * For every conversation with this venue in `participants`:
 * - Update `accountNames[]` entry (participantId == venueId):
 *     * accountName -> newAccountName
 *     * accountId   -> toUserId (if it equals fromUserId)
 * - Flip `lastMessageSenderId` if needed.
 * - In subcollection `messages`, rewrite all docs where senderId == fromUserId -> toUserId.
 *
 * @param {Object} params
 * @param {string} params.venueId
 * @param {string} params.fromUserId
 * @param {string} params.toUserId
 * @param {string} params.newAccountName
 * @returns {Promise<{conversationsUpdated:number,messagesUpdated:number}>}
 */
export async function rewriteVenueConversationsAndMessages({
  venueId, fromUserId, toUserId, newAccountName,
}) {
  const convosCol = collection(firestore, 'conversations');
  const pageSize = 100;
  let lastDoc = null;
  let conversationsUpdated = 0;
  let messagesUpdated = 0;
  for (;;) {
    let q = query(convosCol, where('participants', 'array-contains', venueId), limit(pageSize));
    if (lastDoc) q = query(convosCol, where('participants', 'array-contains', venueId), startAfter(lastDoc), limit(pageSize));
    const snap = await getDocs(q);
    if (snap.empty) break;
    const convoBatch = writeBatch(firestore);
    const convoDocs = snap.docs;
    for (const c of convoDocs) {
      const data = c.data() || {};
      let nextAccountNames = data.accountNames;
      if (Array.isArray(nextAccountNames)) {
        nextAccountNames = nextAccountNames.map((entry) => {
          if (entry?.participantId === venueId) {
            const next = { ...entry };
            if (typeof newAccountName === 'string' && newAccountName.length) {
              next.accountName = newAccountName;
            }
            if (next.accountId === fromUserId) {
              next.accountId = toUserId;
            }
            return next;
          }
          return entry;
        });
      }
      const convoUpdate = {};
      if (Array.isArray(nextAccountNames)) convoUpdate.accountNames = nextAccountNames;
      if (data.lastMessageSenderId === fromUserId) {
        convoUpdate.lastMessageSenderId = toUserId;
      }
      if (Object.keys(convoUpdate).length) {
        convoBatch.update(c.ref, convoUpdate);
        conversationsUpdated += 1;
      }
    }
    await convoBatch.commit();
    for (const c of convoDocs) {
      const messagesCol = collection(firestore, 'conversations', c.id, 'messages');
      let mLastDoc = null;
      for (;;) {
        let mq = query(messagesCol, where('senderId', '==', fromUserId), limit(400));
        if (mLastDoc) mq = query(messagesCol, where('senderId', '==', fromUserId), startAfter(mLastDoc), limit(400));
        const mSnap = await getDocs(mq);
        if (mSnap.empty) break;
        const mBatch = writeBatch(firestore);
        mSnap.docs.forEach((m) => {
          mBatch.update(m.ref, { senderId: toUserId });
          messagesUpdated += 1;
        });
        await mBatch.commit();
        mLastDoc = mSnap.docs[mSnap.docs.length - 1];
      }
    }
    lastDoc = snap.docs[snap.docs.length - 1];
  }
  return { conversationsUpdated, messagesUpdated };
}

/**
 * Declines all *other* applicants, updates their conversations, and
 * posts an announcement that the gig was confirmed with another musician.
 * Also sets conversation pending messages (application/invitation/negotiation) -> "declined".
 *
 * @param {object} gigData
 * @param {string} acceptedMusicianId
 * @returns {Promise<Array>} newApplicants array
 */
export const notifyOtherApplicantsGigConfirmed = async (gigData, acceptedMusicianId) => {
  const applicants = Array.isArray(gigData.applicants) ? gigData.applicants : [];
  const otherIds = applicants
    .map(a => a?.id)
    .filter(Boolean)
    .filter(id => id !== acceptedMusicianId);

  // 1) Update applicants: others -> declined (keep accepted as is)
  const newApplicants = applicants.map(a =>
    a?.id === acceptedMusicianId ? a : { ...a, status: "declined" }
  );

  // 2) Flip pending messages to declined + add announcement for other applicants' conversations
  const convSnap = await getDocs(
    query(collection(firestore, "conversations"), where("gigId", "==", gigData.gigId))
  );

  const pendingTypes = ["application", "invitation", "negotiation"];
  const text = "This gig has been confirmed with another musician. Applications are now closed.";

  for (const convDoc of convSnap.docs) {
    const data = convDoc.data() || {};
    const participants = data.participants || [];
    const isVenueAndOtherApplicant =
      participants.includes(gigData.venueId) && otherIds.some(id => participants.includes(id));

    if (!isVenueAndOtherApplicant) continue;

    const messagesRef = collection(firestore, "conversations", convDoc.id, "messages");

    // Fetch all pending application/invitation/negotiation messages
    const pendingSnap = await getDocs(
      query(messagesRef, where("status", "==", "pending"), where("type", "in", pendingTypes))
    );

    const batch = writeBatch(firestore);

    pendingSnap.forEach(m => batch.update(m.ref, { status: "declined" }));

    // Announcement
    const announceRef = doc(messagesRef);
    batch.set(announceRef, {
      senderId: "system",
      text,
      timestamp: Timestamp.now(),
      type: "announcement",
      status: "gig confirmed",
    });

    // Close conversation
    batch.update(convDoc.ref, {
      lastMessage: text,
      lastMessageTimestamp: Timestamp.now(),
      lastMessageSenderId: "system",
      status: "closed",
    });

    await batch.commit();
  }

  return newApplicants;
};

/*** DELETE OPERATIONS ***/

/**
 * Deletes a conversation from Firestore.
 *
 * @param {string} conversationId - Firestore document ID of the conversation to delete.
 * @returns {Promise<void>}
 */
export const deleteConversation = async (conversationId) => {
  try {
    const conversationRef = doc(firestore, 'conversations', conversationId);
    await deleteDoc(conversationRef);
  } catch (error) {
    console.error('Error deleting conversation profile:', error);
    throw error;
  }
};

/**
 * Deletes all conversations associated with a specific gig ID.
 *
 * @param {string} gigId - The gig ID to match conversations against.
 * @returns {Promise<void>}
 */
export const deleteConversationsByGigId = async (gigId) => {
  const q = query(collection(firestore, 'conversations'), where('gigId', '==', gigId));
  const snapshot = await getDocs(q);
  await Promise.all(snapshot.docs.map(doc => deleteConversation(doc.id)));
};
