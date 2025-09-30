import { httpsCallable } from 'firebase/functions';
import { functions } from '@lib/firebase';

/**
 * Posts multiple gigs via Cloud Function (server-side permission + sanitization).
 * @param {string} venueId
 * @param {Array<Object>} gigDocuments
 * @returns {Promise<string[]>} created gig IDs
 */
export async function postMultipleGigs(venueId, gigDocuments) {
    const fn = httpsCallable(functions, "postMultipleGigs");
    const { data } = await fn({ venueId, gigDocuments });
    return data?.gigIds || [];
}

/**
 * Mark applicants viewed for a gig (server-side guarded).
 * @param {string} venueId
 * @param {string} gigId
 * @param {string[]=} applicantIds - optional; if omitted, marks ALL current applicants
 * @returns {Promise<void>}
 */
export async function markApplicantsViewed(venueId, gigId, applicantIds) {
    const fn = httpsCallable(functions, "markApplicantsViewed");
    await fn({ venueId, gigId, applicantIds });
}


/**
 * Closes a gig by setting its status to "closed".
 * @param {string} gigId - The ID of the gig to close.
 * @returns {Promise<void>}
 */
export const handleCloseGig = async (gigId) => {
    const updateGigDocument = httpsCallable(functions, "updateGigDocument");
    await updateGigDocument({ gigId, updates: { status: "closed" } });
};

/**
 * Opens a gig by setting its status to "open".
 * @param {string} gigId - The ID of the gig to open.
 * @returns {Promise<void>}
 */
export const handleOpenGig = async (gigId) => {
    const updateGigDocument = httpsCallable(functions, "updateGigDocument");
    await updateGigDocument({ gigId, updates: { status: "open" } });
};

/**
 * Saves a gig template via Cloud Function.
 * Server enforces authorization (venue owner or active member),
 * sanitizes fields, and ensures correct venue association.
 *
 * @param {Object} templateData - Template details to save
 * @returns {Promise<string>} - The saved templateId
 */
export async function saveGigTemplate(templateData) {
    const fn = httpsCallable(functions, "saveGigTemplate");
    const { data } = await fn(templateData);
    return data?.templateId;
}

/**
 * Logs a gig cancellation via Cloud Function.
 * Server enforces authorization and writes an audit record.
 *
 * @param {Object} params
 * @param {string} params.gigId
 * @param {string} [params.musicianId]                 // required if cancellingParty === 'musician'
 * @param {string} params.reason
 * @param {'musician'|'venue'} [params.cancellingParty='musician']
 * @param {string} [params.venueId]                    // optional; must match gig.venueId if provided
 * @returns {Promise<string>} cancellation doc id
 */
export async function logGigCancellation(params) {
    const fn = httpsCallable(functions, "logGigCancellation");
    const { data } = await fn(params);
    return data?.id;
}

/**
 * Duplicates a gig via Cloud Function.
 * @param {string} gigId
 * @returns {Promise<string>} new gigId
 */
export async function duplicateGig(gigId) {
    const fn = httpsCallable(functions, "duplicateGig");
    const { data } = await fn({ gigId });
    return data?.gigId;
}

/**
 * Updates a gig document via Cloud Function.
 * @param {string} gigId
 * @param {Object} updates
 * @returns {Promise<boolean>} success
 */
export async function updateGigDocument(gigId, updates) {
    const fn = httpsCallable(functions, "updateGigDocument");
    const { data } = await fn({ gigId, updates });
    return !!data?.success;
}

/**
 * Applies to a gig via Cloud Function.
 * @param {string} gigId
 * @param {{ musicianId: string, bandProfile?: boolean }} musicianProfile
 * @returns {Promise<Object[]|null>} updated applicants array (or null if gig not found)
 */
export async function applyToGig(gigId, musicianProfile) {
    const fn = httpsCallable(functions, "applyToGig");
    const { data } = await fn({ gigId, musicianProfile });
    return data?.applicants ?? null;
}

/**
 * Invites a musician to a gig via Cloud Function.
 * @param {string} gigId
 * @param {{ musicianId: string }} musicianProfile
 * @returns {Promise<Object[]|null>} updated applicants array (or null if gig not found)
 */
export async function inviteToGig(gigId, musicianProfile) {
    const fn = httpsCallable(functions, "inviteToGig");
    const { data } = await fn({ gigId, musicianProfile });
    return data?.applicants ?? null;
}

/**
 * Submits a fee negotiation via Cloud Function.
 * @param {string} gigId
 * @param {{ musicianId: string, bandProfile?: boolean }} musicianProfile
 * @param {string|number} newFee
 * @param {string} sender
 * @returns {Promise<Object[]>} updated applicants array (empty if gig not found)
 */
export async function negotiateGigFee(gigId, musicianProfile, newFee, sender) {
    const fn = httpsCallable(functions, "negotiateGigFee");
    const { data } = await fn({ gigId, musicianProfile, newFee, sender });
    return data?.applicants ?? [];
}

/**
 * Accepts a gig offer via Cloud Function.
 * @param {{ gigId: string, kind?: string, applicants: Array<{id:string, fee:string|number}> }} gigData
 * @param {string} musicianProfileId
 * @param {boolean} [nonPayableGig=false]
 * @returns {Promise<{updatedApplicants: Object[], agreedFee: string|number|null}>}
 */
export async function acceptGigOffer(gigData, musicianProfileId, nonPayableGig = false) {
    const fn = httpsCallable(functions, "acceptGigOffer");
    const { data } = await fn({ gigData, musicianProfileId, nonPayableGig });
    return { updatedApplicants: data?.updatedApplicants || [], agreedFee: data?.agreedFee ?? null };
}

/**
 * Accepts a gig offer (Open Mic) via Cloud Function.
 * @param {{ gigId: string, applicants: Array<{id:string}> }} gigData
 * @param {string} musicianProfileId
 * @returns {Promise<{updatedApplicants: Object[]}>}
 */
export async function acceptGigOfferOM(gigData, musicianProfileId) {
    const fn = httpsCallable(functions, "acceptGigOfferOM");
    const { data } = await fn({ gigData, musicianProfileId });
    return { updatedApplicants: data?.updatedApplicants || [] };
}

/**
 * Declines a gig application via Cloud Function.
 * @param {{ gigId: string, applicants: Array<{id:string}> }} gigData
 * @param {string} musicianProfileId
 * @returns {Promise<Object[]>} updated applicants array
 */
export async function declineGigApplication(gigData, musicianProfileId) {
    const fn = httpsCallable(functions, "declineGigApplication");
    const { data } = await fn({ gigData, musicianProfileId });
    return data?.applicants || [];
}

/**
 * Updates a gig with a counter-offer via Cloud Function.
 * @param {{ gigId: string, applicants: Array<{id:string}> }} gigData
 * @param {string} musicianProfileId
 * @param {string|number} newFee
 * @param {string} sender
 * @returns {Promise<Object[]>} updated applicants array
 */
export async function updateGigWithCounterOffer(gigData, musicianProfileId, newFee, sender) {
    const fn = httpsCallable(functions, "updateGigWithCounterOffer");
    const { data } = await fn({ gigData, musicianProfileId, newFee, sender });
    return data?.applicants || [];
}

/**
 * Removes a musician from a gig's applicants via Cloud Function.
 * @param {string} gigId
 * @param {string} musicianId
 * @returns {Promise<Object[]>} updated applicants array
 */
export async function removeGigApplicant(gigId, musicianId) {
    const fn = httpsCallable(functions, "removeGigApplicant");
    const { data } = await fn({ gigId, musicianId });
    return data?.applicants || [];
}

/**
 * Reverts a gig after cancellation via Cloud Function and reopens applications.
 * @param {{ gigId: string, venueId: string, applicants: Array<{id:string}> }} gigData
 * @param {string} musicianId
 * @param {string} cancellationReason
 * @returns {Promise<Object[]>} reopened applicants array
 */
export async function revertGigAfterCancellation(gigData, musicianId, cancellationReason) {
    const fn = httpsCallable(functions, "revertGigAfterCancellation");
    const { data } = await fn({ gigData, musicianId, cancellationReason });
    return data?.applicants || [];
}

/**
 * Reverts a gig to closed after a cancellation via Cloud Function.
 * @param {{ gigId: string, applicants: Array<{id:string}> }} gigData
 * @param {string} musicianId
 * @param {string} cancellationReason
 * @returns {Promise<Object[]>} updated applicants array
 */
export async function revertGigAfterCancellationVenue(gigData, musicianId, cancellationReason) {
    const fn = httpsCallable(functions, "revertGigAfterCancellationVenue");
    const { data } = await fn({ gigData, musicianId, cancellationReason });
    return data?.applicants || [];
}

/**
 * Deletes a gig and cleans up references via Cloud Function.
 * @param {string} gigId
 * @returns {Promise<boolean>} success
 */
export async function deleteGigAndInformation(gigId) {
    const fn = httpsCallable(functions, "deleteGigAndInformation");
    const { data } = await fn({ gigId });
    return !!data?.success;
  }

