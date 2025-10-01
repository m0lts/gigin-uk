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