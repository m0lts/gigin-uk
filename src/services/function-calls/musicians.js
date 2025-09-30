import { httpsCallable } from 'firebase/functions';
import { functions } from '@lib/firebase';


export async function markPendingFeeInDispute({ musicianId, docId, gigId, disputeReason, details }) {
    const fn = httpsCallable(functions, "markPendingFeeInDispute");
    const { data } = await fn({ musicianId, docId, gigId, disputeReason, details });
    return data;
}