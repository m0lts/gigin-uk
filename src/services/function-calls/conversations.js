import { httpsCallable } from 'firebase/functions';
import { functions } from '@lib/firebase';

/**
 * Fetches an existing conversation (band/musician + gig) or creates it.
 * @param {Object} musicianProfile
 * @param {Object} gigData
 * @param {Object} venueProfile
 * @param {'application'|'negotiation'|'invitation'|'dispute'} [type='application']
 * @returns {Promise<string>} conversationId
 */
export async function getOrCreateConversation(musicianProfile, gigData, venueProfile, type = 'application') {
    const fn = httpsCallable(functions, "getOrCreateConversation");
    const { data } = await fn({ musicianProfile, gigData, venueProfile, type });
    return data?.conversationId;
}

/**
 * Updates a conversation document via Cloud Function.
 * @param {string} convId
 * @param {Object} updates
 * @returns {Promise<boolean>} success
 */
export async function updateConversationDocument(convId, updates) {
    const fn = httpsCallable(functions, "updateConversationDocument");
    const { data } = await fn({ convId, updates });
    return !!data?.success;
}

/**
 * Mark gig applicant as viewed via Cloud Function.
 * @param {string} gigId
 * @param {string} musicianId
 * @returns {Promise<boolean>}
 */
export async function markGigApplicantAsViewed(gigId, musicianId) {
    const fn = httpsCallable(functions, "markGigApplicantAsViewed");
    const { data } = await fn({ gigId, musicianId });
    return !!data?.success;
}

/**
 * Declines other applicants and updates related conversations via Cloud Function.
 * Returns the newApplicants array (others declined, accepted unchanged).
 *
 * @param {{ gigId: string, venueId: string, applicants?: Array<Object> }} gigData
 * @param {string} acceptedMusicianId
 * @returns {Promise<Array<Object>>} newApplicants
 */
export async function notifyOtherApplicantsGigConfirmed(gigData, acceptedMusicianId) {
    const fn = httpsCallable(functions, "notifyOtherApplicantsGigConfirmed");
    const { data } = await fn({ gigData, acceptedMusicianId });
    return data?.newApplicants || [];
}

/**
 * Deletes a conversation via Cloud Function.
 * @param {string} conversationId
 * @returns {Promise<boolean>} success
 */
export async function deleteConversation(conversationId) {
    const fn = httpsCallable(functions, "deleteConversation");
    const { data } = await fn({ conversationId });
    return !!data?.success;
  }