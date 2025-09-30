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

/**
 * Accepts a venue invite for the current authenticated user.
 * Creates member doc with default permissions and deletes the invite.
 *
 * @param {string} inviteId
 * @returns {Promise<{ ok: boolean, venueId?: string, message?: string }>}
 */
export async function acceptVenueInvite(inviteId) {
    const fn = httpsCallable(functions, "acceptVenueInvite");
    const res = await fn({ inviteId });
    return res.data;
}

// Update permissions
export async function updateVenueMemberPermissions(venueId, memberUid, newPerms) {
    const fn = httpsCallable(functions, "updateVenueMemberPermissions");
    const { data } = await fn({ venueId, memberUid, permissions: newPerms });
    return !!data?.ok;
}

// Remove member
export async function removeVenueMember(venueId, memberUid) {
    const fn = httpsCallable(functions, "removeVenueMember");
    const { data } = await fn({ venueId, memberUid });
    return !!data?.ok;
}