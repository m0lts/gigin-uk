import { httpsCallable } from 'firebase/functions';
import { functions } from '@lib/firebase';

/**
 * Creates a band profile via Cloud Function.
 */
export async function createBandProfile(bandId, data, userId, musicianProfile) {
    try {
      const fn = httpsCallable(functions, "createBandProfile");
      const { data: res } = await fn({ bandId, data, userId, musicianProfile });
      return res?.bandId;
    } catch (error) {
      console.error("[CloudFn Error] createBandProfile:", error);
    }
  }
  
  /**
   * Creates a band invite via Cloud Function.
   */
  export async function createBandInvite(bandId, invitedBy, invitedEmail = "") {
    try {
      const fn = httpsCallable(functions, "createBandInvite");
      const { data } = await fn({ bandId, invitedBy, invitedEmail });
      return data?.inviteId;
    } catch (error) {
      console.error("[CloudFn Error] createBandInvite:", error);
    }
  }
  
  /**
   * Joins a band by password via Cloud Function.
   */
  export async function joinBandByPassword(bandId, musicianProfile) {
    try {
      const fn = httpsCallable(functions, "joinBandByPassword");
      const { data } = await fn({ bandId, musicianProfile });
      return !!data?.success;
    } catch (error) {
      console.error("[CloudFn Error] joinBandByPassword:", error);
    }
  }
  
  /**
   * Fetches a band by its join password via Cloud Function.
   */
  export async function getBandByPassword(password) {
    try {
      const fn = httpsCallable(functions, "getBandByPassword");
      const { data } = await fn({ password });
      return data?.band || null;
    } catch (error) {
      console.error("[CloudFn Error] getBandByPassword:", error);
    }
  }
  
  /**
   * Accepts a band invite via Cloud Function.
   */
  export async function acceptBandInvite(inviteId, musicianProfile) {
    try {
      const fn = httpsCallable(functions, "acceptBandInvite");
      const { data } = await fn({ inviteId, musicianProfile });
      return data?.bandId;
    } catch (error) {
      console.error("[CloudFn Error] acceptBandInvite:", error);
    }
  }
  
  /**
   * Updates a band member's permissions via Cloud Function.
   */
  export async function updateBandMemberPermissions(bandId, musicianProfileId, updates) {
    try {
      const fn = httpsCallable(functions, "updateBandMemberPermissions");
      const { data } = await fn({ bandId, musicianProfileId, updates });
      return data?.member || null;
    } catch (error) {
      console.error("[CloudFn Error] updateBandMemberPermissions:", error);
    }
  }
  
  /**
   * Transfers band admin via Cloud Function and optionally updates roles.
   */
  export async function updateBandAdmin(bandId, newAdminData, roleUpdates = {}) {
    try {
      const fn = httpsCallable(functions, "updateBandAdmin");
      const { data } = await fn({ bandId, newAdminData, roleUpdates });
      return data?.members || [];
    } catch (error) {
      console.error("[CloudFn Error] updateBandAdmin:", error);
    }
  }
  
  /**
   * Updates a musician's image across their bands via Cloud Function.
   */
  export async function updateBandMemberImg(musicianProfileId, pictureUrl, bands) {
    try {
      const fn = httpsCallable(functions, "updateBandMemberImg");
      const { data } = await fn({ musicianProfileId, pictureUrl, bands });
      return !!data?.success;
    } catch (error) {
      console.error("[CloudFn Error] updateBandMemberImg:", error);
    }
  }
  
  /**
   * Removes a band member via Cloud Function and redistributes splits.
   */
  export async function removeBandMember(bandId, musicianProfileId, userId) {
    try {
      const fn = httpsCallable(functions, "removeBandMember");
      const { data } = await fn({ bandId, musicianProfileId, userId });
      return data?.members || [];
    } catch (error) {
      console.error("[CloudFn Error] removeBandMember:", error);
    }
  }
  
  /**
   * Leaves a band via Cloud Function.
   */
  export async function leaveBand(bandId, musicianProfileId, userId) {
    try {
      const fn = httpsCallable(functions, "leaveBand");
      const { data } = await fn({ bandId, musicianProfileId, userId });
      return !!data?.success;
    } catch (error) {
      console.error("[CloudFn Error] leaveBand:", error);
    }
  }
  
  /**
   * Deletes a band and all associated members/references via Cloud Function.
   */
  export async function deleteBand(bandId) {
    try {
      const fn = httpsCallable(functions, "deleteBand");
      const { data } = await fn({ bandId });
      return !!data?.success;
    } catch (error) {
      console.error("[CloudFn Error] deleteBand:", error);
    }
  }