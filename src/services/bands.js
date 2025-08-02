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
  runTransaction,
  serverTimestamp,
  arrayUnion,
  writeBatch
} from 'firebase/firestore';

/*** CREATE OPERATIONS ***/

/**
 * Creates a band document and adds the initial musician to the members subcollection.
 *
 * @param {string} bandId - The band ID
 * @param {Object} data - Fully prepared band data (name, picture URL, admin, members, etc.)
 * @param {string} userId - The Firebase Auth user ID of the creator
 * @param {Object} musicianProfile - The musician profile object of the creator
 */
export const createBandProfile = async (bandId, data, userId, musicianProfile) => {
    try {
      const bandRef = doc(firestore, 'bands', bandId);
      await setDoc(bandRef, {
        ...data,
        userId,
      }, { merge: true });
      const memberRef = doc(firestore, `bands/${bandId}/members/${musicianProfile.id}`);
      await setDoc(memberRef, {
        musicianProfileId: musicianProfile.id,
        memberName: musicianProfile.name,
        memberImg: musicianProfile.picture,
        memberUserId: musicianProfile.userId,
        joinedAt: new Date(),
        isAdmin: true,
        role: 'Band Leader',
        split: 100,
      });
    } catch (error) {
      console.error('Error creating band profile:', error);
      throw error;
    }
  };


/**
 * Creates a new band invite in the global bandInvites collection
 * @param {string} bandId
 * @param {string} invitedBy - musicianProfileId
 * @param {string} invitedEmail - optional
 * @returns {Promise<string>} inviteId
 */
export const createBandInvite = async (bandId, invitedBy, invitedEmail = '') => {
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    const docRef = await addDoc(collection(firestore, 'bandInvites'), {
      bandId,
      invitedBy,
      invitedEmail,
      status: 'pending',
      createdAt: Timestamp.now(),
      expiresAt,
    });
    return docRef.id;
};

/**
 * Joins a band using its password.
 * @param {string} bandId - Band document ID.
 * @param {string} musicianProfileId - ID of the musician profile.
 * @returns {Promise<void>}
 */
export const joinBandByPassword = async (bandId, musicianProfile) => {
    const bandRef = doc(firestore, 'bands', bandId);
    const memberRef = doc(firestore, `bands/${bandId}/members`, musicianProfile.musicianId);
    const musicianRef = doc(firestore, 'musicianProfiles', musicianProfile.musicianId);
    const userRef = doc(firestore, 'users', musicianProfile.userId);
  
    await runTransaction(firestore, async (transaction) => {
      const bandSnap = await transaction.get(bandRef);
      if (!bandSnap.exists()) {
        throw new Error('Band not found.');
      }
      transaction.set(memberRef, {
        musicianProfileId: musicianProfile.musicianId,
        memberName: musicianProfile.name,
        memberImg: musicianProfile.picture || '',
        joinedAt: serverTimestamp(),
        isAdmin: false,
        role: 'Band Member',
        memberUserId: musicianProfile.userId,
        split: 0,
      });
      transaction.update(bandRef, {
        members: arrayUnion(musicianProfile.musicianId),
      });
      transaction.update(musicianRef, {
        bands: arrayUnion(bandId),
      });
      transaction.update(userRef, {
        bands: arrayUnion(bandId),
      });
    });
    const membersCollection = collection(firestore, `bands/${bandId}/members`);
    const membersSnapshot = await getDocs(membersCollection);
    const totalMembers = membersSnapshot.size;
    if (totalMembers === 0) return;
    const evenSplit = Math.floor(100 / totalMembers);
    const remainder = 100 - evenSplit * totalMembers;
    let index = 0;
    const updatePromises = membersSnapshot.docs.map((docSnap) => {
      const split = index === 0 ? evenSplit + remainder : evenSplit;
      index++;
      return updateDoc(docSnap.ref, { split });
    });
    await Promise.all(updatePromises);
  };

/*** READ OPERATIONS ***/

/**
 * Subscribes to real-time updates for a band profile document.
 *
 * @param {string} bandId - The Firestore document ID of the band profile.
 * @param {function(Object|null):void} callback - Called with the profile data or `null` if not found.
 * @param {function(Error):void} [onError] - Optional error handler.
 * @returns {function():void} Unsubscribe function to stop listening.
 */
export const subscribeToBandProfileWithMusicianProfile = (bandId, callback, onError) => {
  const bandRef = doc(firestore, 'bands', bandId);
  const musicianRef = doc(firestore, 'musicianProfiles', bandId); // bandId is used as the musicianProfile ID

  const unsubBand = onSnapshot(
    bandRef,
    async (bandSnap) => {
      if (!bandSnap.exists()) return callback(null);

      try {
        const bandData = { id: bandSnap.id, ref: bandRef, ...bandSnap.data() };
        const musicianSnap = await getDoc(musicianRef);

        const bandMusicianProfile = musicianSnap.exists() && musicianSnap.data().bandProfile
          ? { id: musicianSnap.id, ...musicianSnap.data() }
          : null;

        callback({ band: bandData, bandMusicianProfile });
      } catch (error) {
        onError ? onError(error) : console.error('subscribeToBandProfileWithMusicianProfile error:', error);
      }
    },
    (error) => onError ? onError(error) : console.error('subscribeToBandProfile error:', error)
  );

  return unsubBand;
};

/**
 * Fetches a band profile by its Firestore document ID without its corresponding musician profile.
 *
 * @param {string} bandId - The document ID of the band profile.
 * @returns {Promise<Object|null>} An object containing the profile data (`{ id, ref, ...data }`) or `null` if not found.
 */
export const getBandDataOnly = async (bandId) => {
  const bandRef = doc(firestore, 'bands', bandId);
  const bandSnap = await getDoc(bandRef);

  if (!bandSnap.exists()) return null;

  const bandData = { id: bandSnap.id, ...bandSnap.data() };
  return bandData;
};

/**
 * Fetches the bands a musician is a member of
 *
 * @param {string} musicianId - The musician's id of the user.
 * @returns {Promise<Object|null>} An object containing the profile data (`{ id, ref, ...data }`) or `null` if not found.
 */
export const getBandsByMusicianId = async (musicianId) => {
  const bandQuery = query(
    collection(firestore, 'bands'),
    where('members', 'array-contains', musicianId)
  );
  const snapshot = await getDocs(bandQuery);

  const results = await Promise.all(
    snapshot.docs.map(async (docSnap) => {
      const bandData = { id: docSnap.id, ref: docSnap.ref, ...docSnap.data() };

      const musicianProfileRef = doc(firestore, 'musicianProfiles', docSnap.id);
      const musicianSnap = await getDoc(musicianProfileRef);

      const bandProfile = musicianSnap.exists() && musicianSnap.data().bandProfile
        ? { id: musicianSnap.id, ...musicianSnap.data() }
        : null;

      return { ...bandData, bandProfile };
    })
  );

  return results;
};

/**
 * Fetches a band profile by its Firestore document ID.
 *
 * @param {string} bandId - The document ID of the band profile.
 * @returns {Promise<Object|null>} An object containing the profile data (`{ id, ref, ...data }`) or `null` if not found.
 */
export const getBandProfileByBandId = async (bandId) => {
  const bandRef = doc(firestore, 'bands', bandId);
  const bandSnap = await getDoc(bandRef);

  if (!bandSnap.exists()) return null;

  const bandData = { id: bandSnap.id, ref: bandRef, ...bandSnap.data() };

  const musicianRef = doc(firestore, 'musicianProfiles', bandId);
  const musicianSnap = await getDoc(musicianRef);

  const bandProfile = musicianSnap.exists() && musicianSnap.data().bandProfile
    ? { id: musicianSnap.id, ref: musicianRef, ...musicianSnap.data() }
    : null;

  return { band: bandData, bandProfile };
};

/**
 * Fetches multiple band profiles by their Firestore document IDs.
 *
 * @param {string[]} bandIds - An array of band profile document IDs.
 * @returns {Promise<Array<Object>>} An array of band profile objects.
 */
export const getBandProfilesByIds = async (bandIds) => {
  if (!bandIds || bandIds.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < bandIds.length; i += 10) {
    chunks.push(bandIds.slice(i, i + 10));
  }
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const q = query(
        collection(firestore, 'bands'),
        where(documentId(), 'in', chunk)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }));
    })
  );
  return results.flat();
};

/**
 * Fetches all band profiles from Firestore.
 *
 * @returns {Promise<Array<Object>>} - Array of band profile objects with IDs.
 */
export const getAllBandProfiles = async () => {
  try {
    const bandsRef = collection(firestore, 'bands');
    const snapshot = await getDocs(bandsRef);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error fetching band profiles:', error);
    throw error;
  }
};

/**
 * Fetches a band document by its join password.
 * @param {string} password - The 3-word join password.
 * @returns {Promise<Object>} - The band document.
 */
export const getBandByPassword = async (password) => {
    const q = query(collection(firestore, 'bands'), where('joinPassword', '==', password));
    const snapshot = await getDocs(q);
  
    if (snapshot.empty) {
      throw new Error('No band found with that password.');
    }
  
    const docSnap = snapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() };
};

/**
 * Fetches all members of a given band.
 * @param {string} bandId - The ID of the band document.
 * @returns {Promise<Array<{ id: string, [key: string]: any }>>} - List of member docs with IDs.
 */
export const getBandMembers = async (bandId) => {
  if (!bandId) throw new Error('Band ID is required.');

  const membersRef = collection(firestore, `bands/${bandId}/members`);
  const snapshot = await getDocs(membersRef);

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));
};

/*** UPDATE OPERATIONS ***/

/**
 * Updates the band profile document with the provided data.
 *
 * @param {string} bandId - Firestore document ID of the band profile.
 * @param {Object} data - The data to update.
 * @returns {Promise<void>}
 */
export const updateBandProfile = async (bandId, data) => {
  try {
    const ref = doc(firestore, 'bands', bandId);
    await updateDoc(ref, data);
  } catch (error) {
    console.error('Error updating band profile:', error);
    throw error;
  }
};

/**
 * Adds the gigId to the band's list of applied gigs.
 */
export const updateBandGigApplications = async (bandProfile, gigId) => {
    const bandRef = doc(firestore, 'bands', bandProfile.bandId);
    const updatedArray = bandProfile.gigApplications
      ? [...bandProfile.gigApplications, gigId]
      : [gigId];
    await updateDoc(bandRef, { gigApplications: updatedArray });
  };

/**
 * Removes the gig from the band's profile data.
 * @param {string} bandId - The ID of the cancelling band.
 * @param {string} gigId - The gig ID to remove.
 * @returns {Promise<void>}
 */
export const updateBandCancelledGig = async (bandId, gigId) => {
  const bandRef = doc(firestore, 'bands', bandId);
  await updateDoc(bandRef, {
    gigApplications: arrayRemove(gigId),
    confirmedGigs: arrayRemove(gigId),
  });
};


/**
 * Accepts a band invite and updates Firestore accordingly.
 * @param {string} inviteId - The ID of the invite.
 * @param {string} musicianProfileId - The musician's profile ID.
 * @returns {Promise<string>} - Returns the bandId joined.
 */
export const acceptBandInvite = async (inviteId, musicianProfile) => {
  const inviteRef = doc(firestore, 'bandInvites', inviteId);
  const inviteSnap = await getDoc(inviteRef);
  if (!inviteSnap.exists()) throw new Error('Invite not found');
  const invite = inviteSnap.data();
  const now = new Date();
  if (invite.status !== 'pending') throw new Error('This invite has already been used or cancelled.');
  if (invite.expiresAt.toDate() < now) throw new Error('This invite has expired.');
  const bandId = invite.bandId;
  const bandRef = doc(firestore, 'bands', bandId);
  const memberRef = doc(firestore, `bands/${bandId}/members`, musicianProfile.musicianId);
  const musicianRef = doc(firestore, 'musicianProfiles', musicianProfile.musicianId);
  await runTransaction(firestore, async (transaction) => {
    transaction.set(memberRef, {
      musicianProfileId: musicianProfile.musicianId,
      joinedAt: serverTimestamp(),
      isAdmin: false,
      role: 'Band Member',
      memberName: musicianProfile.name,
      memberImg: musicianProfile.picture || '',
      memberUserId: musicianProfile.userId,
      split: 0,
    });
    transaction.update(bandRef, {
      members: arrayUnion(musicianProfile.musicianId),
    });
    transaction.update(musicianRef, {
      bands: arrayUnion(bandId),
    });
    transaction.update(inviteRef, {
      status: 'accepted',
    });
  });
  const membersCollection = collection(firestore, `bands/${bandId}/members`);
  const membersSnapshot = await getDocs(membersCollection);
  const totalMembers = membersSnapshot.size;
  if (totalMembers === 0) return;
  const evenSplit = Math.floor(100 / totalMembers);
  const remainder = 100 - evenSplit * totalMembers;
  let index = 0;
  const updatePromises = membersSnapshot.docs.map((docSnap) => {
    const split = index === 0 ? evenSplit + remainder : evenSplit;
    index++;
    return updateDoc(docSnap.ref, { split });
  });
  await Promise.all(updatePromises);
  return bandId;
};

/**
 * Updates split percentages for multiple band members.
 * @param {string} bandId - The ID of the band.
 * @param {Object} splitUpdates - An object mapping musicianProfileId to new split percentage.
 * @returns {Promise<void>}
 */
export const updateBandMemberSplits = async (bandId, splitUpdates) => {
  const updatePromises = Object.entries(splitUpdates).map(([musicianProfileId, split]) => {
    const memberRef = doc(firestore, `bands/${bandId}/members`, musicianProfileId);
    return updateDoc(memberRef, { split });
  });

  await Promise.all(updatePromises);
};

/**
 * Updates a band member's permissions (role and/or admin status).
 * @param {string} bandId - The band document ID.
 * @param {string} musicianProfileId - The member's ID.
 * @param {Object} updates - Fields to update (e.g., { role: 'Band Leader', isAdmin: true }).
 * @returns {Promise<void>}
 */
export const updateBandMemberPermissions = async (bandId, musicianProfileId, updates) => {
  const memberRef = doc(firestore, `bands/${bandId}/members`, musicianProfileId);
  if (updates.isAdmin === true) {
    const membersSnap = await getDocs(collection(firestore, `bands/${bandId}/members`));
    const existingAdmin = membersSnap.docs.find(doc => {
      const data = doc.data();
      return data.isAdmin === true && doc.id !== musicianProfileId;
    });
    if (existingAdmin) {
      throw new Error('Only one admin is allowed. Revoke admin rights from the current admin first.');
    }
  }
  await updateDoc(memberRef, updates);
  const updatedSnap = await getDoc(memberRef);
  return { id: updatedSnap.id, ...updatedSnap.data() };
};

/**
 * Transfers admin rights to a new member and updates any additional role fields.
 * @param {string} bandId - The band ID.
 * @param {string} newAdminId - The musicianProfileId to promote.
 * @param {Object} roleUpdates - Object of musicianProfileId → { role: string }
 */
export const updateBandAdmin = async (bandId, newAdminData, roleUpdates = {}) => {
  const membersRef = collection(firestore, `bands/${bandId}/members`);
  const membersSnap = await getDocs(membersRef);
  const bandDocRef = doc(firestore, 'bands', bandId);
  const updates = [];
  for (const docSnap of membersSnap.docs) {
    const memberId = docSnap.id;
    const isCurrentAdmin = docSnap.data().isAdmin === true;

    if (isCurrentAdmin && memberId !== newAdminData.musicianProfileId) {
      updates.push(updateDoc(doc(firestore, `bands/${bandId}/members`, memberId), {
        isAdmin: false,
      }));
    }
    if (memberId === newAdminData.musicianProfileId) {
      updates.push(updateDoc(doc(firestore, `bands/${bandId}/members`, memberId), {
        isAdmin: true,
        ...(roleUpdates[memberId] || {}),
      }));
    } else if (roleUpdates[memberId]) {
      updates.push(updateDoc(doc(firestore, `bands/${bandId}/members`, memberId), {
        ...roleUpdates[memberId],
      }));
    }
  }
  updates.push(updateDoc(bandDocRef, {
    admin: {
      musicianId: newAdminData.musicianProfileId,
      userId: newAdminData.memberUserId,
    }
  }));
  await Promise.all(updates);
  const refreshedSnap = await getDocs(membersRef);
  return refreshedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
};


/*** DELETE OPERATIONS ***/

/**
 * Deletes a band profile from Firestore.
 *
 * @param {string} bandId - Firestore document ID of the band profile to delete.
 * @returns {Promise<void>}
 */
export const deleteBandProfile = async (bandId) => {
  try {
    const bandRef = doc(firestore, 'bands', bandId);
    await deleteDoc(bandRef);
  } catch (error) {
    console.error('Error deleting band profile:', error);
    throw error;
  }
};

/**
 * Removes a gig ID from the gigApplications array in a band's profile.
 *
 * @param {string} bandId - Firestore document ID of the band.
 * @param {string} gigId - ID of the gig to remove.
 * @returns {Promise<void>}
 */
export const removeGigFromBand = async (bandId, gigId) => {
  const ref = doc(firestore, 'bands~', bandId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const updated = (snap.data().gigApplications || []).filter(id => id !== gigId);
    await updateDoc(ref, { gigApplications: updated });
  }
};


/**
 * Removes a band member and redistributes their split among remaining members.
 * @param {string} bandId - The band ID.
 * @param {string} musicianProfileId - The musician's profile ID.
 * @param {string} userId - The corresponding user ID.
 * @returns {Promise<void>}
 */
export const removeBandMember = async (bandId, musicianProfileId, userId) => {
  const bandRef = doc(firestore, 'bands', bandId);
  const memberRef = doc(firestore, `bands/${bandId}/members`, musicianProfileId);
  const musicianRef = doc(firestore, 'musicianProfiles', musicianProfileId);
  const userRef = doc(firestore, 'users', userId);
  const removedSnap = await getDoc(memberRef);
  const removedSplit = removedSnap.exists() ? removedSnap.data().split || 0 : 0;
  const membersRef = collection(firestore, `bands/${bandId}/members`);
  const allMembersSnap = await getDocs(membersRef);
  const remainingMembers = allMembersSnap.docs.filter(doc => doc.id !== musicianProfileId);
  const numRemaining = remainingMembers.length;
  const extraPerMember = numRemaining > 0 ? removedSplit / numRemaining : 0;
  const batch = writeBatch(firestore);
  remainingMembers.forEach(docSnap => {
    const currentSplit = docSnap.data().split || 0;
    const newSplit = currentSplit + extraPerMember;
    batch.update(docSnap.ref, { split: Number(newSplit.toFixed(2)) });
  });
  batch.delete(memberRef);
  batch.update(bandRef, {
    members: arrayRemove(musicianProfileId),
  });
  batch.update(musicianRef, {
    bands: arrayRemove(bandId),
  });
  batch.update(userRef, {
    bands: arrayRemove(bandId),
  });
  await batch.commit();
  const updatedSnap = await getDocs(membersRef);
  return updatedSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));
};

/**
 * Removes a musician from the band and updates all references.
 * @param {string} bandId
 * @param {string} musicianProfileId
 * @param {string} userId
 */
export const leaveBand = async (bandId, musicianProfileId, userId) => {
  const bandRef = doc(firestore, 'bands', bandId);
  const memberRef = doc(firestore, `bands/${bandId}/members`, musicianProfileId);
  const userRef = doc(firestore, 'users', userId);
  const musicianRef = doc(firestore, 'musicianProfiles', musicianProfileId);
  const batch = writeBatch(firestore);
  batch.delete(memberRef);
  batch.update(bandRef, {
    members: arrayRemove(musicianProfileId)
  });
  batch.update(userRef, {
    bands: arrayRemove(bandId)
  });
  batch.update(musicianRef, {
    bands: arrayRemove(bandId)
  });
  await batch.commit();
};

/**
 * Deletes a band and all associated members and references.
 * @param {string} bandId - The band document ID.
 */
export const deleteBand = async (bandId) => {
  try {
    const batch = writeBatch(firestore);
    const bandRef = doc(firestore, 'bands', bandId);
    const membersRef = collection(firestore, `bands/${bandId}/members`);
    const membersSnap = await getDocs(membersRef);
    for (const memberDoc of membersSnap.docs) {
      const member = memberDoc.data();
      const musicianRef = doc(firestore, 'musicianProfiles', member.musicianProfileId);
      const userRef = doc(firestore, 'users', member.memberUserId);
      batch.update(musicianRef, {
        bands: member.musicianProfileId ? arrayRemove(bandId) : [],
      });
      batch.update(userRef, {
        bands: member.memberUserId ? arrayRemove(bandId) : [],
      });
      batch.delete(memberDoc.ref);
    }
    batch.delete(bandRef);
    await batch.commit();
  } catch (error) {
    console.error(error)
  }
};