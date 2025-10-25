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
 */
export const getBandDataOnly = async (bandId) => {
  try {
    const bandRef = doc(firestore, "bands", bandId);
    const bandSnap = await getDoc(bandRef);

    if (!bandSnap.exists()) return null;

    const bandData = { id: bandSnap.id, ...bandSnap.data() };
    return bandData;
  } catch (error) {
    console.error("[Firestore Error] getBandDataOnly:", error);
  }
};

/**
 * Fetches all members of a given band.
 */
export const getBandMembers = async (bandId) => {
  try {
    if (!bandId) throw new Error("Band ID is required.");

    const membersRef = collection(firestore, `bands/${bandId}/members`);
    const snapshot = await getDocs(membersRef);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("[Firestore Error] getBandMembers:", error);
  }
};