import { httpsCallable } from 'firebase/functions';
import { functions } from '@lib/firebase';

/**
 * Cancels a scheduled Cloud Task by task name.
 * @param {string} taskName - The name of the task to cancel.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export const cancelTask = async (taskName) => {
    try {
      const cancelCloudTask = httpsCallable(functions, 'cancelCloudTask');
      const result = await cancelCloudTask({ taskName });
      return result.data?.success || false;
    } catch (error) {
      console.error('Failed to cancel task:', error);
      return false;
    }
};

/**
 * Cancels scheduled tasks and processes a refund for a given gig.
 * @param {Object} options
 * @param {string[]} options.taskNames - Array of Cloud Task names to cancel.
 * @param {string} options.transactionId - The transaction ID to refund.
 * @returns {Promise<void>}
 */
export const cancelGigAndRefund = async ({ taskNames, transactionId }) => {
    const cancelCloudTask = httpsCallable(functions, 'cancelCloudTask');
    const processRefund = httpsCallable(functions, 'processRefund');
    for (const taskName of taskNames) {
      if (taskName) {
        await cancelCloudTask({ taskName });
      }
    }
    if (transactionId) {
      await processRefund({ paymentIntentId: transactionId });
    }
};

