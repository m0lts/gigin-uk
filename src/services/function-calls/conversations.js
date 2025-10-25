import { httpsCallable } from 'firebase/functions';
import { functions } from '@lib/firebase';

/**
 * Fetches an existing conversation (band/musician + gig) or creates it.
 */
export async function getOrCreateConversation(
    musicianProfile,
    gigData,
    venueProfile,
    type = "application"
  ) {
    try {
      const fn = httpsCallable(functions, "getOrCreateConversation");
      const { data } = await fn({ musicianProfile, gigData, venueProfile, type });
      return data?.conversationId;
    } catch (error) {
      console.error("[CloudFn Error] getOrCreateConversation:", error);
    }
  }
  
  /**
   * Updates a conversation document via Cloud Function.
   */
  export async function updateConversationDocument(convId, updates) {
    try {
      const fn = httpsCallable(functions, "updateConversationDocument");
      const { data } = await fn({ convId, updates });
      return !!data?.success;
    } catch (error) {
      console.error("[CloudFn Error] updateConversationDocument:", error);
    }
  }
  
  /**
   * Mark gig applicant as viewed via Cloud Function.
   */
  export async function markGigApplicantAsViewed(gigId, musicianId) {
    try {
      const fn = httpsCallable(functions, "markGigApplicantAsViewed");
      const { data } = await fn({ gigId, musicianId });
      return !!data?.success;
    } catch (error) {
      console.error("[CloudFn Error] markGigApplicantAsViewed:", error);
    }
  }
  
  /**
   * Declines other applicants and updates related conversations via Cloud Function.
   */
  export async function notifyOtherApplicantsGigConfirmed(gigData, acceptedMusicianId) {
    try {
      const fn = httpsCallable(functions, "notifyOtherApplicantsGigConfirmed");
      const { data } = await fn({ gigData, acceptedMusicianId });
      return data?.newApplicants || [];
    } catch (error) {
      console.error("[CloudFn Error] notifyOtherApplicantsGigConfirmed:", error);
    }
  }
  
  /**
   * Deletes a conversation via Cloud Function.
   */
  export async function deleteConversation(conversationId) {
    try {
      const fn = httpsCallable(functions, "deleteConversation");
      const { data } = await fn({ conversationId });
      return !!data?.success;
    } catch (error) {
      console.error("[CloudFn Error] deleteConversation:", error);
    }
  }