import { httpsCallable } from 'firebase/functions';
import { functions } from '@lib/firebase';


/**
 * Calls the Cloud Function `updateUserArrayField` to update a user's array field.
 * @param {string} field The name of the field to update.
 * @param {"add" | "remove"} op The operation to perform on the field.
 * @param {string} value The value to add or remove from the field.
 * @returns {Promise<Object>} The response from the Cloud Function.
 */
export const updateUserArrayField = async (field, op, value) => {
    const CF = httpsCallable(functions, "updateUserArrayField");
    const response = await CF({ field, op, value });
    return response;
};

/**
 * Calls the Cloud Function `clearUserArrayField` to clear a user's array field.
 * @param {string} field The name of the field to clear.
 * @returns {Promise<Object>} The response from the Cloud Function.
 */
export const clearUserArrayField = async (field) => {
    const CF = httpsCallable(functions, "clearUserArrayField");
    const response = await CF({ field });
    return response;
};

/**
 * Calls the Cloud Function `deleteUserDocument` to delete the authenticated user's document and primary Firestore footprint.
 * - Requires recent sign-in (default 5 minutes).
 * - Deletes users/{uid}
 * - Removes membership docs: venueProfiles/{venueId}/members/{uid}
 * - Revokes tokens + deletes Firebase Auth user
 *
 * NOTE: We intentionally DO NOT delete venueProfiles the user created.
 *       If you want that behaviour later, we can gate it behind a flag
 *       and add additional validation/confirmation.
 * @returns {Promise<Object>} The response from the Cloud Function.
 */
export const deleteUserDocument = async () => {
    const CF = httpsCallable(functions, "deleteUserDocument");
    const response = await CF({ confirm: true });
    return response;
};

/**
 * Checks whether a phone number already exists on any user doc.
 * @param {string} phoneNumber The phone number to check.
 * @returns {Promise<boolean>} true if a user with that phone exists; otherwise false
*/
export const getPhoneExistsBoolean = async (phoneNumber) => {
    const fn = httpsCallable(functions, 'getPhoneExistsBoolean');
    const { data } = await fn({ phoneNumber });
    return !!data; // expect boolean
};


/**
 * Retrieves a user document from Firestore using the user's email address.
 *
 * @param {string} email The email address to search for.
 * @returns {Promise<Object|null>} The user document if found, otherwise null.
 */
export const getEmailAddress = async (email) => {
    const fn = httpsCallable(functions, "getUserEmail");
    const res = await fn({ email });
    // res.data = { found: boolean, user: object|null }
    return res.data?.user || null;
};
  


