import { httpsCallable } from 'firebase/functions';
import { functions } from '@lib/firebase';

export const transferVenueOwnership = async (venueToTransfer, recipientEmail) => {
    const CF = httpsCallable(functions, "transferVenueOwnership");
    const response = await CF({ venueId: venueToTransfer.id, recipientEmail });
    const data = response.data;
    return data;
};

export async function fetchVenueMembersWithUsers(venueId) {
    const fn = httpsCallable(functions, "fetchVenueMembersWithUsers");
    const res = await fn({ venueId });
    return res.data || [];
}