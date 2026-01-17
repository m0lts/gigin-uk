/* eslint-disable */
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { REGION_PRIMARY } from "../../../config/regions.js";
import { db } from "../../../lib/admin.js";
import { sendMessageNotificationEmail } from "../services/sendMessageNotificationEmail.js";

/**
 * Firestore trigger: sends email notification when a new message is created.
 * 
 * Only sends emails for messages with type: "text"
 * Skips if recipient has emailMessages: false in their user document
 * 
 * @function onMessageCreated
 * @param {import("firebase-functions/v2/firestore").FirestoreEvent} event
 * @returns {Promise<void>}
 */
export const onMessageCreated = onDocumentCreated(
  {
    region: REGION_PRIMARY,
    document: "conversations/{conversationId}/messages/{messageId}",
    maxInstances: 10,
  },
  async (event) => {
    const messageData = event.data?.data();
    const conversationId = event.params.conversationId;
    
    if (!messageData) {
      console.log("No message data found");
      return;
    }
    
    // Only send emails for text messages
    if (messageData.type !== "text") {
      console.log("Skipping non-text message type:", messageData.type);
      return;
    }
    
    // Skip system messages
    if (messageData.senderId === "system") {
      console.log("Skipping system message");
      return;
    }
    
    // Get conversation to find recipient
    const convRef = db.doc(`conversations/${conversationId}`);
    const convSnap = await convRef.get();
    
    if (!convSnap.exists) {
      console.log("Conversation not found:", conversationId);
      return;
    }
    
    const convData = convSnap.data();
    const authorizedUserIds = Array.isArray(convData?.authorizedUserIds) 
      ? convData.authorizedUserIds 
      : [];
    
    // Find recipient (the user who didn't send this message)
    const recipientId = authorizedUserIds.find(uid => uid !== messageData.senderId);
    
    if (!recipientId) {
      console.log("No recipient found for conversation:", conversationId);
      return;
    }
    
    // Check if recipient has email notifications disabled
    const userRef = db.doc(`users/${recipientId}`);
    const userSnap = await userRef.get();
    
    if (!userSnap.exists) {
      console.log("Recipient user not found:", recipientId);
      return;
    }
    
    const userData = userSnap.data() || {};
    
    // If emailMessages is explicitly false, skip sending
    if (userData.emailMessages === false) {
      console.log("Email notifications disabled for user:", recipientId);
      return;
    }
    
    // Get recipient email
    const recipientEmail = userData.email;
    
    if (!recipientEmail) {
      console.log("No email found for recipient:", recipientId);
      return;
    }
    
    // Get sender's name from conversation accountNames
    const accountNames = Array.isArray(convData?.accountNames) 
      ? convData.accountNames 
      : [];
    
    // Find sender's account name
    const senderAccount = accountNames.find(
      account => account.accountId === messageData.senderId
    );
    
    const senderName = senderAccount?.accountName || 
                       (senderAccount?.role === "venue" 
                         ? convData?.venueName 
                         : convData?.artistName) ||
                       "Someone";
    
    // Send notification email
    try {
      await sendMessageNotificationEmail({
        recipientEmail,
        senderName,
        conversationId,
      });
      console.log("Message notification email sent to:", recipientEmail);
    } catch (error) {
      console.error("Error sending message notification email:", error);
      // Don't throw - we don't want to fail the message creation
    }
  }
);
