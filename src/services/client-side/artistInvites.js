import { collection, doc, getDoc } from 'firebase/firestore';
import { firestore } from '@lib/firebase';

export const getArtistInviteById = async (inviteId) => {
  if (!inviteId) return null;
  try {
    const ref = doc(firestore, 'artistInvites', inviteId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch (error) {
    console.error('[Firestore Error] getArtistInviteById:', error);
  }
};


