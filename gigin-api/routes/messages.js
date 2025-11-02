/* eslint-disable */
import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { db, Timestamp } from "../config/admin.js";

const router = express.Router();

/**
 * POST /api/messages/sendMessage
 * 
 * Sends a text message to a conversation and updates conversation metadata.
 * 
 * Request body:
 *   {
 *     conversationId: string,
 *     message: {
 *       senderId: string,
 *       text: string
 *     }
 *   }
 * 
 * Response:
 *   {
 *     success: true,
 *     timestamp: number (milliseconds since epoch)
 *   }
 * 
 * Authentication: Required (Firebase ID token)
 */
router.post(
  "/sendMessage",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { conversationId, message = {} } = req.body;
    const { senderId, text } = message;

    // Validate required fields
    if (!conversationId) {
      return res.status(400).json({
        error: "Bad Request",
        message: "conversationId is required",
      });
    }

    if (!senderId || !text) {
      return res.status(400).json({
        error: "Bad Request",
        message: "message.senderId and message.text are required",
      });
    }

    // Validate senderId matches authenticated user
    if (senderId !== req.auth.uid) {
      return res.status(403).json({
        error: "Forbidden",
        message: "senderId must match authenticated user",
      });
    }

    // Create timestamp
    const ts = Timestamp.now();

    // Add message to conversation
    const messagesRef = db
      .collection("conversations")
      .doc(conversationId)
      .collection("messages");
    
    await messagesRef.add({
      senderId,
      text,
      timestamp: ts,
      type: "text",
    });

    // Update conversation metadata
    const convRef = db.doc(`conversations/${conversationId}`);
    await convRef.update({
      lastMessage: text,
      lastMessageTimestamp: ts,
      lastMessageSenderId: senderId,
    });

    // Return success with timestamp
    res.json({
      success: true,
      timestamp: ts.toMillis(),
    });
  })
);

export default router;
