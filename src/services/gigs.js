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
  serverTimestamp
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

/*** CREATE OPERATIONS ***/

/**
 * Posts multiple gigs to Firestore and updates the venue's profile with their IDs.
 *
 * @param {string} venueId - The ID of the venue posting the gigs.
 * @param {Array<Object>} gigDocuments - An array of gig objects, each containing a `gigId` field.
 * @returns {Promise<void>}
 */
export const postMultipleGigs = async (venueId, gigDocuments) => {
  try {
    const gigIds = gigDocuments.map(gig => gig.gigId);
    const writePromises = gigDocuments.map(gig => {
      const gigRef = doc(firestore, 'gigs', gig.gigId);
      return setDoc(gigRef, gig, { merge: true });
    });
    await Promise.all(writePromises);
    const venueRef = doc(firestore, 'venueProfiles', venueId);
    await updateDoc(venueRef, {
      gigs: arrayUnion(...gigIds),
    });
  } catch (error) {
    console.error('Error posting multiple gigs for venue:', error);
    throw error;
  }
};

/**
 * Saves a gig template and updates the associated venue's template list.
 *
 * @param {Object} formData - The gig template form data.
 * @param {string} templateName - The name of the template.
 * @returns {Promise<string>} - The ID of the saved template.
 */
export const saveGigTemplate = async (templateData) => {
  try {
    const templateRef = doc(firestore, 'templates', templateData.templateId);
    await setDoc(templateRef, templateData, { merge: true });
    const venueRef = doc(firestore, 'venueProfiles', templateData.venueId);
    await updateDoc(venueRef, {
      templates: arrayUnion(templateData.templateId),
    });
    return templateData;
  } catch (error) {
    console.error('Error saving gig template:', error);
    throw error;
  }
};

/**
 * Logs the cancellation event in a dedicated 'cancellations' collection.
 * @param {string} gigId - The ID of the cancelled gig.
 * @param {string} musicianId - The ID of the cancelling musician.
 * @param {string} reason - The cancellation reason.
 * @returns {Promise<void>}
 */
export const logGigCancellation = async (gigId, musicianId, reason) => {
  const cancellationRef = collection(firestore, 'cancellations');
  await addDoc(cancellationRef, {
    gigId,
    musicianId,
    reason,
    timestamp: Timestamp.now(),
  });
};

/**
 * Duplicates a gig document in Firestore, creating a new gig with a fresh ID and no applicants.
 * Also adds the new gig ID to the related venue profile's gigs array.
 *
 * @param {string} gigId - The ID of the gig to duplicate.
 * @returns {Promise<string>} - The ID of the newly created gig.
 */
export const duplicateGig = async (gigId) => {
  try {
    const originalRef = doc(firestore, 'gigs', gigId);
    const originalSnap = await getDoc(originalRef);

    if (!originalSnap.exists()) {
      throw new Error(`Gig with ID ${gigId} does not exist.`);
    }

    const originalData = originalSnap.data();

    // Generate new gig ID
    const newGigId = uuidv4();

    const newGig = {
      ...originalData,
      gigId: newGigId,
      applicants: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: 'open',
    };

    // Remove old Firestore metadata fields
    delete newGig.id;

    // Create the new gig document
    await setDoc(doc(firestore, 'gigs', newGigId), newGig);

    // Add new gigId to the venue profile's gigs array
    if (originalData.venueId) {
      const venueRef = doc(firestore, 'venueProfiles', originalData.venueId);
      await updateDoc(venueRef, {
        gigs: arrayUnion(newGigId),
      });
    }

    return newGigId;
  } catch (error) {
    console.error('Failed to duplicate gig:', error);
    throw error;
  }
};

/*** READ OPERATIONS ***/

/**
 * Subscribes to real-time updates for all gigs in the Firestore 'gigs' collection.
 * 
 * @param {function} callback - A function to execute with the updated list of gigs.
 * @returns {function} - An unsubscribe function to stop listening to changes.
 */
export const subscribeToGigs = (callback) => {
  const gigsRef = collection(firestore, 'gigs');
  return onSnapshot(gigsRef, (snapshot) => {
    const gigs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(gigs);
  });
};


/**
 * Subscribes to real-time updates for gigs that are upcoming or within the last 48 hours,
 * for a specific set of venue IDs.
 *
 * @param {string[]} venueIds - The venue IDs to filter gigs by.
 * @param {function} callback - Callback to receive the updated list of gigs.
 * @returns {function} - Unsubscribe function to stop all listeners.
 */
export const subscribeToUpcomingOrRecentGigs = (venueIds, callback) => {
  if (!venueIds || venueIds.length === 0) {
    console.warn('No venueIds provided to subscribeToUpcomingOrRecentGigs.');
    return () => {};
  }

  const now = new Date();
  const pastCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000); // 48 hours ago
  const futureCutoff = Timestamp.fromDate(pastCutoff);

  const batchSize = 10;
  const allGigs = new Map();
  const unsubscribers = [];

  for (let i = 0; i < venueIds.length; i += batchSize) {
    const batch = venueIds.slice(i, i + batchSize);

    const gigsRef = collection(firestore, 'gigs');

    // Query 1: future gigs
    const futureQuery = query(
      gigsRef,
      where('venueId', 'in', batch),
      where('date', '>=', futureCutoff)
    );

    // Query 2: recent past gigs (within 48 hours)
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

    unsubscribers.push(onSnapshot(futureQuery, handleSnapshot));
    unsubscribers.push(onSnapshot(pastQuery, handleSnapshot));
  }

  return () => unsubscribers.forEach((unsub) => unsub());
};


/**
 * Fetches a single gig document by its ID.
 * 
 * @param {string} gigId - The ID of the gig to retrieve.
 * @returns {Promise<Object|null>} - The gig data with ID if found, otherwise null.
 */
export const getGigById = async (gigId) => {
  const gigRef = doc(firestore, 'gigs', gigId);
  const snap = await getDoc(gigRef);
  return snap.exists() ? { id: snap.id, ref: gigRef, ...snap.data() } : null;
};

/**
 * Fetches multiple gig documents based on an array of gig IDs.
 *
 * @param {string[]} gigIds - Array of gig document IDs to fetch.
 * @returns {Promise<Array<Object>>} - Array of gig objects (with `id` and data), or empty array if none found.
 */
export const getGigsByIds = async (gigIds) => {
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
};

/**
 * Retrieves all gigs created by a specific venue.
 * 
 * @param {string} venueId - The ID of the venue.
 * @returns {Promise<Array>} - An array of gig objects with Firestore refs.
 */
export const getGigsByVenueId = async (venueId) => {
    const q = query(collection(firestore, 'gigs'), where('venueId', '==', venueId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }));
};

/**
 * Retrieves all gigs created by a list of venue IDs.
 * 
 * @param {string[]} venueIds - An array of venue IDs.
 * @returns {Promise<Array>} - An array of gig objects with Firestore refs.
 */
export const getGigsByVenueIds = async (venueIds) => {
    if (!venueIds.length) return [];
    const q = query(collection(firestore, 'gigs'), where('venueId', 'in', venueIds));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};



/*** UPDATE OPERATIONS ***/

/**
 * Updates a gig document with provided data.
 *
 * @param {string} gigId - ID of the gig document.
 * @param {Object} updates - Partial updates to apply.
 * @returns {Promise<void>}
 */
export const updateGigDocument = async (gigId, updates) => {
  const gigRef = doc(firestore, 'gigs', gigId);
  await updateDoc(gigRef, updates);
};

/**
 * Adds a musician's application to the specified gig.
 *
 * @param {string} gigId - The ID of the gig to apply to.
 * @param {Object} musicianProfile - The musician's profile object.
 * @returns {Promise<Object[]|null>} - The updated applicants array or null if the gig doesn't exist.
 */
export const applyToGig = async (gigId, musicianProfile) => {
    const gig = await getGigById(gigId);
    if (!gig) return null;
    const newApplication = {
        id: musicianProfile.musicianId,
        timestamp: Timestamp.now(),
        fee: gig.budget || '£0',
        status: 'pending',
        type: musicianProfile.bandProfile ? 'band' : 'musician',
    };
    const updatedApplicants = [...(gig.applicants || []), newApplication];
    await updateGigApplicants(gigId, updatedApplicants);
    return updatedApplicants;
};


/**
 * Adds a musician's application to the specified gig, as an invite from the venue.
 *
 * @param {string} gigId - The ID of the gig to apply to.
 * @param {Object} musicianProfile - The musician's profile object.
 * @returns {Promise<Object[]|null>} - The updated applicants array or null if the gig doesn't exist.
 */
export const inviteToGig = async (gigId, musicianProfile) => {
  const gig = await getGigById(gigId);
  if (!gig) return null;
  const newApplication = {
      id: musicianProfile.musicianId,
      timestamp: Timestamp.now(),
      fee: gig.budget || '£0',
      status: 'pending',
      invited: true,
  };
  const updatedApplicants = [...(gig.applicants || []), newApplication];
  await updateGigApplicants(gigId, updatedApplicants);
  return updatedApplicants;
};

/**
 * Submits a fee negotiation by updating the applicants array with the proposed new fee.
 * 
 * @param {string} gigId - The ID of the gig.
 * @param {Object} musicianProfile - Musician profile object.
 * @param {string|number} newFee - The proposed new fee.
 * @returns {Promise<Array>} - The updated applicants array.
 */
export const negotiateGigFee = async (gigId, musicianProfile, newFee) => {
    const gig = await getGigById(gigId);
    if (!gig) return [];
    const newApplication = {
        id: musicianProfile.musicianId,
        timestamp: Timestamp.now(),
        fee: newFee || '£0',
        status: 'pending',
    };
    const updatedApplicants = [...(gig.applicants || []), newApplication];
    await updateGigApplicants(gigId, updatedApplicants);
    return updatedApplicants;
};

/**
 * Updates the 'applicants' array for a specific gig.
 * 
 * @param {string} gigId - The ID of the gig to update.
 * @param {string[]} updatedApplicants - The new list of applicant IDs.
 * @returns {Promise<void>}
 */
export const updateGigApplicants = async (gigId, updatedApplicants) => {
  const gigRef = doc(firestore, 'gigs', gigId);
  await updateDoc(gigRef, { applicants: updatedApplicants });
};

/**
 * Sets the agreed fee for a gig and resets the payment status.
 * 
 * @param {string} gigId - The ID of the gig.
 * @param {string[]} updatedApplicants - Updated list of applicants.
 * @param {string|number} agreedFee - The agreed payment amount for the gig.
 * @returns {Promise<void>}
 */
export const setGigAgreement = async (gigId, updatedApplicants, agreedFee) => {
    const gig = await getGigById(gigId);
    await updateDoc(gig.ref, {
        applicants: updatedApplicants,
        agreedFee: `${agreedFee}`,
        paid: false
    });
};

/**
 * Accepts the gig offer and writes the agreedFee to the gig.
 * @param {string} gigData - The gig data.
 * @param {Array} musicianProfileId - The musician's profile ID.
 * @returns {Promise<void>}
 */
export const acceptGigOffer = async (gigData, musicianProfileId) => {
    let agreedFee;
    const updatedApplicants = gigData.applicants.map(applicant => {
      if (applicant.id === musicianProfileId) {
        agreedFee = applicant.fee;
        return { ...applicant, status: 'accepted' };
      }
      return { ...applicant, status: 'declined' };
    });
    const gig = await getGigById(gigData.gigId);
    await updateDoc(gig.ref, {
      applicants: updatedApplicants,
      agreedFee: `${agreedFee}`,
      paid: false,
    });
    return { updatedApplicants, agreedFee };
};

/**
 * Declines a gig offer by updating the applicant status to 'declined'.
 * @param {object} gigData - The full gig object.
 * @param {string} musicianProfileId - The ID of the musician to decline.
 * @returns {Promise<Array>} - The updated applicants array.
 */
export const declineGigApplication = async (gigData, musicianProfileId) => {
    const updatedApplicants = gigData.applicants.map(applicant =>
      applicant.id === musicianProfileId
        ? { ...applicant, status: 'declined' }
        : { ...applicant }
    );
    const gig = await getGigById(gigData.gigId);
    await updateDoc(gig.ref, { applicants: updatedApplicants });
    return updatedApplicants;
};

/**
 * Updates the applicant's proposed fee and status on the gig document.
 * @param {object} gigData - The full gig object.
 * @param {string} musicianProfileId - The musician's profile ID.
 * @param {number} newFee - The newly proposed fee.
 * @returns {Promise<Array>} Updated applicants array.
 */
export const updateGigWithCounterOffer = async (gigData, musicianProfileId, newFee) => {
    const updatedApplicants = gigData.applicants.map(applicant => {
      if (applicant.id === musicianProfileId) {
        return {
          ...applicant,
          fee: newFee,
          timestamp: Timestamp.now(),
          status: 'pending',
        };
      }
      return { ...applicant };
    });
    const gig = await getGigById(gigData.gigId);
    await updateDoc(gig.ref, { applicants: updatedApplicants });
    return updatedApplicants;
  };


/*** DELETE OPERATIONS ***/

/**
 * Removes a specific musician from the list of gig applicants.
 * 
 * @param {string} gigId - The ID of the gig.
 * @param {string} musicianId - The ID of the musician to remove.
 * @returns {Promise<void>}
 */
export const removeGigApplicant = async (gigId, musicianId) => {
  const gig = await getGigById(gigId);
  if (!gig || !gig.applicants) return;
  const updatedApplicants = gig.applicants.filter(applicant => applicant.id !== musicianId);
  const gigRef = doc(firestore, 'gigs', gigId);
  await updateDoc(gigRef, { applicants: updatedApplicants });
};

/**
 * Reverts a gig to an open state after cancellation and removes the musician from the applicant list.
 * @param {object} gigData - The full gig object.
 * @param {string} musicianId - The ID of the cancelling musician.
 * @param {string} cancellationReason - The cancellation reason provided.
 * @returns {Promise<void>}
 */
export const revertGigAfterCancellation = async (gigData, musicianId, cancellationReason) => {
  const gigRef = doc(firestore, 'gigs', gigData.gigId);
  const updatedApplicants = gigData.applicants.filter(app => app.id !== musicianId);
  await updateDoc(gigRef, {
    applicants: updatedApplicants,
    agreedFee: deleteField(),
    disputeClearingTime: deleteField(),
    disputeLogged: deleteField(),
    musicianFeeStatus: deleteField(),
    paymentStatus: deleteField(),
    clearPendingFeeTaskName: deleteField(),
    automaticMessageTaskName: deleteField(),
    paid: false,
    status: 'open',
    cancellationReason,
  });
};

/**
 * Reverts a gig to a closed state after cancellation and removes the musician from the applicant list.
 * @param {object} gigData - The full gig object.
 * @param {string} musicianId - The ID of the cancelling musician.
 * @param {string} cancellationReason - The cancellation reason provided.
 * @returns {Promise<void>}
 */
export const revertGigAfterCancellationVenue = async (gigData, musicianId, cancellationReason) => {
  const gigRef = doc(firestore, 'gigs', gigData.gigId);
  const updatedApplicants = gigData.applicants.filter(app => app.id !== musicianId);
  await updateDoc(gigRef, {
    applicants: updatedApplicants,
    agreedFee: deleteField(),
    disputeClearingTime: deleteField(),
    disputeLogged: deleteField(),
    musicianFeeStatus: deleteField(),
    paymentStatus: deleteField(),
    clearPendingFeeTaskName: deleteField(),
    automaticMessageTaskName: deleteField(),
    paid: false,
    status: 'closed',
    cancellationReason,
  });
};



/**
 * Deletes a gig from Firestore.
 *
 * @param {string} gigId - Firestore document ID of the gig to delete.
 * @returns {Promise<void>}
 */
export const deleteGig = async (gigId) => {
  try {
    const gigRef = doc(firestore, 'gigs', gigId);
    await deleteDoc(gigRef);
  } catch (error) {
    console.error('Error deleting gig profile:', error);
    throw error;
  }
};

/**
 * Deletes a gig and cleans up references in venue and musician documents.
 *
 * @param {string} gigId - Firestore document ID of the gig to delete.
 * @returns {Promise<void>}
 */
export const deleteGigAndInformation = async (gigId) => {
  const gigRef = doc(firestore, 'gigs', gigId);
  const gigSnap = await getDoc(gigRef);

  if (!gigSnap.exists()) {
    console.warn(`Gig with ID ${gigId} does not exist.`);
    return;
  }

  const gigData = gigSnap.data();
  const batch = writeBatch(firestore);

  // 1. Delete the gig document
  batch.delete(gigRef);

  // 2. Remove gig from the venueProfile.gigs array
  const venueId = gigData.venueId;
  const venueRef = doc(firestore, 'venueProfiles', venueId);
  const venueSnap = await getDoc(venueRef);
  if (venueSnap.exists()) {
    const venueData = venueSnap.data();
    const updatedGigs = (venueData.gigs || []).filter(g => g.gigId !== gigId);
    batch.update(venueRef, { gigs: updatedGigs });
  }

  // 3. Remove gig from each applicant's gigApplications
  const applicants = gigData.applicants || [];
  for (const applicant of applicants) {
    const musicianId = applicant.id;
    if (!musicianId) continue;

    const musicianRef = doc(firestore, 'musicianProfiles', musicianId);
    const musicianSnap = await getDoc(musicianRef);
    if (musicianSnap.exists()) {
      const musicianData = musicianSnap.data();
      const updatedApplications = (musicianData.gigApplications || []).filter(
        (application) => application.gigId !== gigId
      );
      batch.update(musicianRef, { gigApplications: updatedApplications });
    }
  }

  await batch.commit();
};

/**
 * Deletes multiple gigs and cleans up their references.
 *
 * @param {string[]} gigIds - Array of gig document IDs to delete.
 * @returns {Promise<void>}
 */
export const deleteGigsBatch = async (gigIds) => {
  for (const gigId of gigIds) {
    try {
      await deleteGig(gigId);
    } catch (error) {
      console.error(`Failed to delete gig ${gigId}:`, error);
    }
  }
};