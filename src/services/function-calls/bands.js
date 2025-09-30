import { httpsCallable } from 'firebase/functions';
import { functions } from '@lib/firebase';

/**
 * Creates a band profile via Cloud Function.
 * @param {string} bandId
 * @param {Object} data
 * @param {string} userId
 * @param {{ id?: string, musicianId?: string, name: string, picture?: string, userId: string }} musicianProfile
 * @returns {Promise<string>} bandId
 */
export async function createBandProfile(bandId, data, userId, musicianProfile) {
    const fn = httpsCallable(functions, "createBandProfile");
    const { data: res } = await fn({ bandId, data, userId, musicianProfile });
    return res?.bandId;
}

/**
 * Creates a band invite via Cloud Function.
 * @param {string} bandId
 * @param {string} invitedBy
 * @param {string} [invitedEmail]
 * @returns {Promise<string>} inviteId
 */
export async function createBandInvite(bandId, invitedBy, invitedEmail = "") {
    const fn = httpsCallable(functions, "createBandInvite");
    const { data } = await fn({ bandId, invitedBy, invitedEmail });
    return data?.inviteId;
}

/**
 * Joins a band by password via Cloud Function.
 * (Server performs the same writes and split recalculation as the former client code.)
 *
 * @param {string} bandId
 * @param {{ musicianId: string, name: string, picture?: string, userId: string }} musicianProfile
 * @returns {Promise<boolean>} success
 */
export async function joinBandByPassword(bandId, musicianProfile) {
    const fn = httpsCallable(functions, "joinBandByPassword");
    const { data } = await fn({ bandId, musicianProfile });
    return !!data?.success;
}

/**
 * Fetches a band by its join password via Cloud Function.
 * @param {string} password
 * @returns {Promise<Object>} band object with { id, ...fields }
 */
export async function getBandByPassword(password) {
    const fn = httpsCallable(functions, "getBandByPassword");
    const { data } = await fn({ password });
    return data?.band || null;
}

/**
 * Accepts a band invite via Cloud Function.
 * @param {string} inviteId
 * @param {{ musicianId: string, name: string, picture?: string, userId: string }} musicianProfile
 * @returns {Promise<string>} bandId
 */
export async function acceptBandInvite(inviteId, musicianProfile) {
    const fn = httpsCallable(functions, "acceptBandInvite");
    const { data } = await fn({ inviteId, musicianProfile });
    return data?.bandId;
}

/**
 * Updates a band member's permissions via Cloud Function.
 * @param {string} bandId
 * @param {string} musicianProfileId
 * @param {Object} updates
 * @returns {Promise<{id:string} & Object>} updated member
 */
export async function updateBandMemberPermissions(bandId, musicianProfileId, updates) {
    const fn = httpsCallable(functions, "updateBandMemberPermissions");
    const { data } = await fn({ bandId, musicianProfileId, updates });
    return data?.member || null;
}


/**
 * Transfers band admin via Cloud Function and optionally updates roles.
 * @param {string} bandId
 * @param {{ musicianProfileId: string, memberUserId: string }} newAdminData
 * @param {Object<string, Object>} [roleUpdates={}]
 * @returns {Promise<Array<{id:string} & Object>>} refreshed members
 */
export async function updateBandAdmin(bandId, newAdminData, roleUpdates = {}) {
    const fn = httpsCallable(functions, "updateBandAdmin");
    const { data } = await fn({ bandId, newAdminData, roleUpdates });
    return data?.members || [];
}


/**
 * Updates a musician's image across their bands via Cloud Function.
 * @param {string} musicianProfileId
 * @param {string} pictureUrl
 * @param {string[]} bands
 * @returns {Promise<boolean>} success
 */
export async function updateBandMemberImg(musicianProfileId, pictureUrl, bands) {
    const fn = httpsCallable(functions, "updateBandMemberImg");
    const { data } = await fn({ musicianProfileId, pictureUrl, bands });
    return !!data?.success;
}

/**
 * Removes a band member via Cloud Function and redistributes splits.
 * @param {string} bandId
 * @param {string} musicianProfileId
 * @param {string} userId
 * @returns {Promise<Array<{id:string} & Object>>} refreshed members
 */
export async function removeBandMember(bandId, musicianProfileId, userId) {
    const fn = httpsCallable(functions, "removeBandMember");
    const { data } = await fn({ bandId, musicianProfileId, userId });
    return data?.members || [];
}

/**
 * Leaves a band via Cloud Function (removes membership and updates references).
 * @param {string} bandId
 * @param {string} musicianProfileId
 * @param {string} userId
 * @returns {Promise<boolean>} success
 */
export async function leaveBand(bandId, musicianProfileId, userId) {
    const fn = httpsCallable(functions, "leaveBand");
    const { data } = await fn({ bandId, musicianProfileId, userId });
    return !!data?.success;
}

/**
 * Deletes a band and all associated members/references via Cloud Function.
 * @param {string} bandId
 * @returns {Promise<boolean>} success
 */
export async function deleteBand(bandId) {
    const fn = httpsCallable(functions, "deleteBand");
    const { data } = await fn({ bandId });
    return !!data?.success;
  }