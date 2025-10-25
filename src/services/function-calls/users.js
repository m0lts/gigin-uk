import { httpsCallable } from 'firebase/functions';
import { functions } from '@lib/firebase';


/**
 * Calls the Cloud Function `updateUserArrayField` to update a user's array field.
 */
export const updateUserArrayField = async (field, op, value) => {
    try {
      const CF = httpsCallable(functions, "updateUserArrayField");
      const { data } = await CF({ field, op, value });
      return data;
    } catch (error) {
      console.error("[CloudFn Error] updateUserArrayField:", error);
    }
  };
  
  /**
   * Calls the Cloud Function `clearUserArrayField` to clear a user's array field.
   */
  export const clearUserArrayField = async (field) => {
    try {
      const CF = httpsCallable(functions, "clearUserArrayField");
      const { data } = await CF({ field });
      return data;
    } catch (error) {
      console.error("[CloudFn Error] clearUserArrayField:", error);
    }
  };
  
  /**
   * Calls the Cloud Function `deleteUserDocument` to delete the authenticated user's document and primary Firestore footprint.
   */
  export const deleteUserDocument = async () => {
    try {
      const CF = httpsCallable(functions, "deleteUserDocument");
      const { data } = await CF({ confirm: true });
      return data;
    } catch (error) {
      console.error("[CloudFn Error] deleteUserDocument:", error);
    }
  };
  
  /**
   * Checks whether a phone number already exists on any user doc.
   */
  export const getPhoneExistsBoolean = async (phoneNumber) => {
    try {
      const fn = httpsCallable(functions, "getPhoneExistsBoolean");
      const { data } = await fn({ phoneNumber });
      return !!data; // expect boolean
    } catch (error) {
      console.error("[CloudFn Error] getPhoneExistsBoolean:", error);
    }
  };
  
  /**
   * Retrieves a user document from Firestore using the user's email address.
   */
  export const getEmailAddress = async (email) => {
    try {
      const fn = httpsCallable(functions, "getUserEmail");
      const { data } = await fn({ email });
      return data?.user || null;
    } catch (error) {
      console.error("[CloudFn Error] getEmailAddress:", error);
    }
  };

