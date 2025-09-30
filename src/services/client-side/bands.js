import { firestore } from '@lib/firebase';
import {
  collection,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';

/*** READ OPERATIONS ***/

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
