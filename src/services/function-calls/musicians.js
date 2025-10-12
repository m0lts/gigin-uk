import { httpsCallable } from 'firebase/functions';
import { functions } from '@lib/firebase';


export async function markPendingFeeInDispute({ musicianId, docId, gigId, disputeReason, details }) {
    try {
      const fn = httpsCallable(functions, "markPendingFeeInDispute");
      const { data } = await fn({ musicianId, docId, gigId, disputeReason, details });
      return data;
    } catch (error) {
      console.error("[CloudFn Error] markPendingFeeInDispute:", error);
    }
}

export async function updateMusicianCancelledGig(musicianId, gigId) {
  try {
    const fn = httpsCallable(functions, "cancelledGigMusicianProfileUpdate");
    const { data } = await fn({musicianId, gigId});
    return data;
  } catch (error) {
    console.error("[CloudFn Error] updateMusicianCancelledGig:", error);
  }
}

export async function markInviteAsViewed(gigId, applicantId) {
  try {
    const fn = httpsCallable(functions, "markInviteAsViewed");
    const { data } = await fn({gigId, applicantId});
    return data;
  } catch (error) {
    console.error("[CloudFn Error] markInviteAsViewed:", error);
  }
}

export async function findPendingFeeByGigId(musicianId, gigId) {
  try {
    const fn = httpsCallable(functions, "findPendingFeeByGigId");
    const { data } = await fn({musicianId, gigId});
    return data;
  } catch (error) {
    console.error("[CloudFn Error] findPendingFeeByGigId:", error);
  }
}