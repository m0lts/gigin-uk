/**
 * Convert Firebase/FirebaseError objects into friendly messages.
 * Works across Firestore, Auth, and Storage.
 *
 * @param {any} error - The error object (FirebaseError, generic Error, etc).
 * @returns {string} A safe, user-friendly message.
 */
export function friendlyError(error) {
    const msg = (error?.code || error?.message || "").toString();
  
    // --- Auth errors ---
    if (msg.includes("auth/")) {
      if (msg.includes("requires-recent-login")) {
        return "Please log in again to continue.";
      }
      if (msg.includes("user-not-found")) {
        return "Account not found.";
      }
      if (msg.includes("wrong-password")) {
        return "Incorrect password. Please try again.";
      }
      if (msg.includes("network-request-failed")) {
        return "Network error. Please check your connection.";
      }
      return "Authentication error. Please try again.";
    }
  
    // --- Firestore permission errors ---
    if (
      msg.includes("permission-denied") ||
      msg.includes("Missing or insufficient permissions")
    ) {
      return "You don’t have permission to perform this action.";
    }
  
    // --- Firestore not found ---
    if (msg.includes("NOT_FOUND")) {
      return "This item was not found. It may have been removed.";
    }
  
    // --- Storage errors ---
    if (msg.includes("storage/unauthorized")) {
      return "You don’t have permission to upload or access this file.";
    }
    if (msg.includes("storage/canceled")) {
      return "Upload canceled.";
    }
    if (msg.includes("storage/retry-limit-exceeded")) {
      return "Upload failed due to network issues. Please try again.";
    }
  
    // --- Network errors (catch-all) ---
    if (msg.includes("unavailable") || msg.includes("Failed to fetch")) {
      return "Network error. Please try again.";
    }
  
    // --- Default fallback ---
    return "Something went wrong. Please try again.";
  }