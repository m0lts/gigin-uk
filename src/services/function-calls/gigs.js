import { httpsCallable } from 'firebase/functions';
import { functions } from '@lib/firebase';

/**
 * Posts multiple gigs via Cloud Function.
 */
export async function postMultipleGigs(venueId, gigDocuments) {
    try {
      const fn = httpsCallable(functions, "postMultipleGigs");
      const { data } = await fn({ venueId, gigDocuments });
      return data?.gigIds || [];
    } catch (error) {
      console.error("[CloudFn Error] postMultipleGigs:", error);
    }
  }
  
  /**
   * Mark applicants viewed for a gig.
   */
  export async function markApplicantsViewed(venueId, gigId, applicantIds) {
    try {
      const fn = httpsCallable(functions, "markApplicantsViewed");
      await fn({ venueId, gigId, applicantIds });
    } catch (error) {
      console.error("[CloudFn Error] markApplicantsViewed:", error);
    }
  }
  
  /**
   * Closes a gig by setting its status to "closed".
   */
  export const handleCloseGig = async (gigId) => {
    try {
      const updateGigDocument = httpsCallable(functions, "updateGigDocument");
      await updateGigDocument({ gigId, updates: { status: "closed" } });
    } catch (error) {
      console.error("[CloudFn Error] handleCloseGig:", error);
    }
  };
  
  /**
   * Opens a gig by setting its status to "open".
   */
  export const handleOpenGig = async (gigId) => {
    try {
      const updateGigDocument = httpsCallable(functions, "updateGigDocument");
      await updateGigDocument({ gigId, updates: { status: "open" } });
    } catch (error) {
      console.error("[CloudFn Error] handleOpenGig:", error);
    }
  };
  
  /**
   * Saves a gig template via Cloud Function.
   */
  export async function saveGigTemplate(templateData) {
    try {
      const fn = httpsCallable(functions, "saveGigTemplate");
      const { data } = await fn(templateData);
      return data?.templateId;
    } catch (error) {
      console.error("[CloudFn Error] saveGigTemplate:", error);
    }
  }
  
  /**
   * Logs a gig cancellation via Cloud Function.
   */
  export async function logGigCancellation(params) {
    try {
      const fn = httpsCallable(functions, "logGigCancellation");
      const { data } = await fn(params);
      return data?.id;
    } catch (error) {
      console.error("[CloudFn Error] logGigCancellation:", error);
    }
  }
  
  /**
   * Duplicates a gig via Cloud Function.
   */
  export async function duplicateGig(gigId) {
    try {
      const fn = httpsCallable(functions, "duplicateGig");
      const { data } = await fn({ gigId });
      return data?.gigId;
    } catch (error) {
      console.error("[CloudFn Error] duplicateGig:", error);
    }
  }
  
  /**
   * Updates a gig document via Cloud Function.
   */
  export async function updateGigDocument(gigId, updates) {
    try {
      const fn = httpsCallable(functions, "updateGigDocument");
      const { data } = await fn({ gigId, updates });
      return !!data?.success;
    } catch (error) {
      console.error("[CloudFn Error] updateGigDocument:", error);
    }
  }
  
  /**
   * Applies to a gig via Cloud Function.
   */
  export async function applyToGig(gigId, musicianProfile) {
    try {
      const fn = httpsCallable(functions, "applyToGig");
      const { data } = await fn({ gigId, musicianProfile });
      return data?.applicants ?? null;
    } catch (error) {
      console.error("[CloudFn Error] applyToGig:", error);
    }
  }
  
  /**
   * Invites a musician to a gig via Cloud Function.
   */
  export async function inviteToGig(gigId, musicianProfile) {
    try {
      const fn = httpsCallable(functions, "inviteToGig");
      const { data } = await fn({ gigId, musicianProfile });
      return data?.applicants ?? null;
    } catch (error) {
      console.error("[CloudFn Error] inviteToGig:", error);
    }
  }
  
  /**
   * Submits a fee negotiation via Cloud Function.
   */
  export async function negotiateGigFee(gigId, musicianProfile, newFee, sender) {
    try {
      const fn = httpsCallable(functions, "negotiateGigFee");
      const { data } = await fn({ gigId, musicianProfile, newFee, sender });
      return data?.applicants ?? [];
    } catch (error) {
      console.error("[CloudFn Error] negotiateGigFee:", error);
    }
  }
  
  /**
   * Accepts a gig offer via Cloud Function.
   */
  export async function acceptGigOffer(gigData, musicianProfileId, nonPayableGig = false) {
    try {
      const fn = httpsCallable(functions, "acceptGigOffer");
      const { data } = await fn({ gigData, musicianProfileId, nonPayableGig });
      return {
        updatedApplicants: data?.updatedApplicants || [],
        agreedFee: data?.agreedFee ?? null,
      };
    } catch (error) {
      console.error("[CloudFn Error] acceptGigOffer:", error);
    }
  }
  
  /**
   * Accepts a gig offer (Open Mic) via Cloud Function.
   */
  export async function acceptGigOfferOM(gigData, musicianProfileId) {
    try {
      const fn = httpsCallable(functions, "acceptGigOfferOM");
      const { data } = await fn({ gigData, musicianProfileId });
      return { updatedApplicants: data?.updatedApplicants || [] };
    } catch (error) {
      console.error("[CloudFn Error] acceptGigOfferOM:", error);
    }
  }
  
  /**
   * Declines a gig application via Cloud Function.
   */
  export async function declineGigApplication(gigData, musicianProfileId) {
    try {
      const fn = httpsCallable(functions, "declineGigApplication");
      const { data } = await fn({ gigData, musicianProfileId });
      return data?.applicants || [];
    } catch (error) {
      console.error("[CloudFn Error] declineGigApplication:", error);
    }
  }
  
  /**
   * Updates a gig with a counter-offer via Cloud Function.
   */
  export async function updateGigWithCounterOffer(gigData, musicianProfileId, newFee, sender) {
    try {
      const fn = httpsCallable(functions, "updateGigWithCounterOffer");
      const { data } = await fn({ gigData, musicianProfileId, newFee, sender });
      return data?.applicants || [];
    } catch (error) {
      console.error("[CloudFn Error] updateGigWithCounterOffer:", error);
    }
  }
  
  /**
   * Removes a musician from a gig's applicants via Cloud Function.
   */
  export async function removeGigApplicant(gigId, musicianId) {
    try {
      const fn = httpsCallable(functions, "removeGigApplicant");
      const { data } = await fn({ gigId, musicianId });
      return data?.applicants || [];
    } catch (error) {
      console.error("[CloudFn Error] removeGigApplicant:", error);
    }
  }
  
  /**
   * Reverts a gig after cancellation via Cloud Function.
   */
  export async function revertGigAfterCancellation(gigData, musicianId, cancellationReason) {
    try {
      const fn = httpsCallable(functions, "revertGigAfterCancellation");
      const { data } = await fn({ gigData, musicianId, cancellationReason });
      return data?.applicants || [];
    } catch (error) {
      console.error("[CloudFn Error] revertGigAfterCancellation:", error);
    }
  }
  
  /**
   * Reverts a gig to closed after a cancellation via Cloud Function.
   */
  export async function revertGigAfterCancellationVenue(gigData, musicianId, cancellationReason) {
    try {
      const fn = httpsCallable(functions, "revertGigAfterCancellationVenue");
      const { data } = await fn({ gigData, musicianId, cancellationReason });
      return data?.applicants || [];
    } catch (error) {
      console.error("[CloudFn Error] revertGigAfterCancellationVenue:", error);
    }
  }
  
  /**
   * Deletes a gig and cleans up references via Cloud Function.
   */
  export async function deleteGigAndInformation(gigId) {
    try {
      const fn = httpsCallable(functions, "deleteGigAndInformation");
      const { data } = await fn({ gigId });
      return !!data?.success;
    } catch (error) {
      console.error("[CloudFn Error] deleteGigAndInformation:", error);
    }
  }