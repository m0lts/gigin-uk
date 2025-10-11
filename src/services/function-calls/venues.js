import { httpsCallable } from 'firebase/functions';
import { functions } from '@lib/firebase';

export const transferVenueOwnership = async (venueToTransfer, recipientEmail) => {
    try {
      const CF = httpsCallable(functions, "transferVenueOwnership");
      const { data } = await CF({ venueId: venueToTransfer.id, recipientEmail });
      return data;
    } catch (error) {
      console.error("[CloudFn Error] transferVenueOwnership:", error);
    }
  };
  
  export async function fetchVenueMembersWithUsers(venueId) {
    try {
      const fn = httpsCallable(functions, "fetchVenueMembersWithUsers");
      const { data } = await fn({ venueId });
      return data || [];
    } catch (error) {
      console.error("[CloudFn Error] fetchVenueMembersWithUsers:", error);
    }
  }
  
  /**
   * Accepts a venue invite for the current authenticated user.
   */
  export async function acceptVenueInvite(inviteId) {
    try {
      const fn = httpsCallable(functions, "acceptVenueInvite");
      const { data } = await fn({ inviteId });
      return data;
    } catch (error) {
      console.error("[CloudFn Error] acceptVenueInvite:", error);
    }
  }
  
  /**
   * Update venue member permissions.
   */
  export async function updateVenueMemberPermissions(venueId, memberUid, newPerms) {
    try {
      const fn = httpsCallable(functions, "updateVenueMemberPermissions");
      const { data } = await fn({ venueId, memberUid, permissions: newPerms });
      return !!data?.ok;
    } catch (error) {
      console.error("[CloudFn Error] updateVenueMemberPermissions:", error);
    }
  }
  
  /**
   * Remove a venue member.
   */
  export async function removeVenueMember(venueId, memberUid) {
    try {
      const fn = httpsCallable(functions, "removeVenueMember");
      const { data } = await fn({ venueId, memberUid });
      return !!data?.ok;
    } catch (error) {
      console.error("[CloudFn Error] removeVenueMember:", error);
    }
}

/**
 * Delete a venue and all associated data via Cloud Function.
 */
export async function confirmDeleteVenueData(venueId) {
  const fn = httpsCallable(functions, "deleteVenueData");
  return await fn({ venueId, confirm: true });
}