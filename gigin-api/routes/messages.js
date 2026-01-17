/* eslint-disable */
import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { db, Timestamp } from "../config/admin.js";

const router = express.Router();

// POST /api/messages/sendMessage
router.post("/sendMessage", requireAuth, asyncHandler(async (req, res) => {
    const { conversationId, message = {} } = req.body;
    const { senderId, text } = message;
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
    if (senderId !== req.auth.uid) {
      return res.status(403).json({
        error: "Forbidden",
        message: "senderId must match authenticated user",
      });
    }
    const ts = Timestamp.now();
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
    const convRef = db.doc(`conversations/${conversationId}`);
    await convRef.update({
      lastMessage: text,
      lastMessageTimestamp: ts,
      lastMessageSenderId: senderId,
    });
    return res.json({ data: { success: true, timestamp: ts.toMillis() } });
  })
);

// POST /api/messages/sendCounterOfferMessage
router.post("/sendCounterOfferMessage", requireAuth, asyncHandler(async (req, res) => {
  const {
    conversationId,
    messageId,
    senderId,
    newFee,
    oldFee,
    userRole,
  } = req.body || {};
  const ts = Timestamp.now();
  const convRef = db.doc(`conversations/${conversationId}`);
  const messagesRef = convRef.collection("messages");
  await messagesRef.add({
    senderId,
    text: `The ${userRole} proposes a new fee:`,
    timestamp: ts,
    type: "negotiation",
    status: "pending",
    oldFee,
    newFee,
  });
  const counteredRef = messagesRef.doc(messageId);
  await counteredRef.update({ status: "countered" });
  await convRef.update({
    lastMessage: `The ${userRole} proposes a new fee of ${newFee}.`,
    lastMessageTimestamp: ts,
    lastMessageSenderId: senderId,
  });
  return res.json({ data: { timestamp: ts.toMillis() } });
}));

// POST /api/messages/sendGigAcceptedMessage
router.post("/sendGigAcceptedMessage", requireAuth, asyncHandler(async (req, res) => {
  const {
    conversationId,
    originalMessageId,
    senderId,
    agreedFee,
    userRole,
    nonPayableGig = false,
  } = req.body || {};
  const ts = Timestamp.now();
  const msgRef = db
    .collection("conversations")
    .doc(conversationId)
    .collection("messages")
    .doc(originalMessageId);
  await msgRef.update({ status: "accepted" });
  const announcement = !nonPayableGig
    ? `The ${userRole} has accepted the gig for a fee of ${agreedFee}.`
    : `The ${userRole} has accepted the gig. The gig is now confirmed.`;
  const messagesRef = db
    .collection("conversations")
    .doc(conversationId)
    .collection("messages");
  await messagesRef.add({
    senderId,
    text: announcement,
    timestamp: ts,
    type: "announcement",
    status: nonPayableGig ? "gig confirmed" : "awaiting payment",
  });
  const convRef = db.doc(`conversations/${conversationId}`);
  await convRef.update({
    lastMessage: announcement,
    lastMessageTimestamp: ts,
    lastMessageSenderId: senderId,
  });
  return res.json({ data: { timestamp: ts.toMillis() } });
}));

// POST /api/messages/sendGigAcceptanceAnnouncement
router.post("/sendGigAcceptanceAnnouncement", requireAuth, asyncHandler(async (req, res) => {
  const {
    conversationId,
    senderId,
    text,
    nonPayableGig = false,
  } = req.body || {};
  
  if (!conversationId || !senderId || !text) {
    return res.status(400).json({ 
      error: "INVALID_ARGUMENT", 
      message: "conversationId, senderId, and text are required." 
    });
  }
  
  const ts = Timestamp.now();
  const messagesRef = db
    .collection("conversations")
    .doc(conversationId)
    .collection("messages");
  await messagesRef.add({
    senderId,
    text,
    timestamp: ts,
    type: "announcement",
    status: nonPayableGig ? "gig confirmed" : "awaiting payment",
  });
  
  const convRef = db.doc(`conversations/${conversationId}`);
  await convRef.update({
    lastMessage: text,
    lastMessageTimestamp: ts,
    lastMessageSenderId: senderId,
  });
  
  return res.json({ data: { timestamp: ts.toMillis() } });
}));

// POST /api/messages/postCancellationMessage
router.post("/postCancellationMessage", requireAuth, asyncHandler(async (req, res) => {
  const { conversationId, senderId, message, cancellingParty } = req.body || {};
  if (!conversationId || !senderId || !message || !cancellingParty) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "conversationId, senderId, message, and cancellingParty are required." });
  }
  const ts = Timestamp.now();
  const convRef = db.collection("conversations").doc(conversationId);
  const messagesRef = convRef.collection("messages");
  await messagesRef.add({
    senderId,
    text: message,
    type: "announcement",
    status: "cancellation",
    cancellingParty,
    timestamp: ts,
  });
  await convRef.update({
    lastMessage: `Unfortunately, the ${cancellingParty} has had to cancel.`,
    lastMessageTimestamp: ts,
    lastMessageSenderId: senderId,
  });
  return res.json({ data: { success: true } });
}));

// POST /api/messages/sendDisputeMessage
router.post("/sendDisputeMessage", requireAuth, asyncHandler(async (req, res) => {
  const { conversationId, venueName } = req.body || {};
  if (!conversationId || !venueName) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "conversationId and venueName are required." });
  }
  const ts = Timestamp.now();
  const convRef = db.collection("conversations").doc(conversationId);
  const messagesRef = convRef.collection("messages");
  const text = `${venueName} has reported this gig. We have withheld the gig fee until the dispute is resolved. We will be in touch shortly.`;
  await messagesRef.add({
    senderId: "system",
    text,
    type: "announcement",
    status: "dispute",
    timestamp: ts,
  });
  await convRef.update({
    lastMessage: text,
    lastMessageTimestamp: ts,
    lastMessageSenderId: "system",
    status: "open",
  });
  return res.json({ data: { timestamp: ts.toMillis() } });
}));

// POST /api/messages/updateDeclinedApplicationMessage
router.post("/updateDeclinedApplicationMessage", requireAuth, asyncHandler(async (req, res) => {
  const {
    conversationId,
    originalMessageId,
    senderId,
    userRole,
    fee = null,
  } = req.body || {};
  const ts = Timestamp.now();
  const lastMessage = fee
    ? `The fee of ${fee} was declined by the ${userRole}.`
    : "The gig application has been declined.";
  const msgRef = db
    .collection("conversations")
    .doc(conversationId)
    .collection("messages")
    .doc(originalMessageId);
  await msgRef.update({
    status: "declined",
    timestamp: ts,
  });
  const convRef = db.doc(`conversations/${conversationId}`);
  await convRef.update({
    lastMessage,
    lastMessageTimestamp: ts,
    lastMessageSenderId: senderId,
  });
  return res.json({ data: { timestamp: ts.toMillis(), lastMessage } });
}));

// POST /api/messages/updateMessageDoc
router.post("/updateMessageDoc", requireAuth, asyncHandler(async (req, res) => {
  const { conversationId, messageId, updates = {}, conversationUpdates = null } = req.body || {};
  if (!conversationId || typeof conversationId !== "string") {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "conversationId is required" });
  }
  if (!messageId || typeof messageId !== "string") {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "messageId is required" });
  }
  if (typeof updates !== "object" || updates === null) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "updates must be an object" });
  }
  if (conversationUpdates && (typeof conversationUpdates !== "object" || conversationUpdates === null)) {
    return res.status(400).json({ error: "INVALID_ARGUMENT", message: "conversationUpdates must be an object when provided" });
  }
  const convRef = db.doc(`conversations/${conversationId}`);
  const ts = Timestamp.now();
  const msgRef = convRef.collection("messages").doc(messageId);
  await msgRef.update({
    ...updates,
    timestamp: ts,
  });
  let conversationUpdated = false;
  let convTs;
  if (conversationUpdates && Object.keys(conversationUpdates).length > 0) {
    convTs = Timestamp.now();
    await convRef.update({
      ...conversationUpdates,
      lastMessageTimestamp: convTs,
    });
    conversationUpdated = true;
  }
  return res.json({
    data: {
      success: true,
      messageUpdated: true,
      conversationUpdated,
      messageTimestamp: ts.toMillis(),
      ...(conversationUpdated ? { conversationTimestamp: convTs.toMillis() } : {}),
    },
  });
}));

// POST /api/messages/updateReviewMessageStatus
router.post("/updateReviewMessageStatus", requireAuth, asyncHandler(async (req, res) => {
  const { conversationId, messages = [], userId } = req.body || {};
  const recentReviewMessage = messages
    .filter((m) => m && m.type === "review")
    .reduce((latest, current) => {
      if (!latest) return current;
      const lt = latest.timestamp;
      const ct = current.timestamp;
      const lms = typeof lt?.toMillis === "function" ? lt.toMillis() : lt;
      const cms = typeof ct?.toMillis === "function" ? ct.toMillis() : ct;
      return cms > lms ? current : latest;
    }, null);
  if (!recentReviewMessage?.id) {
    return res.json({ data: { messageId: null } });
  }
  const ts = Timestamp.now();
  const msgRef = db
    .collection("conversations")
    .doc(conversationId)
    .collection("messages")
    .doc(recentReviewMessage.id);
  const convRef = db.doc(`conversations/${conversationId}`);
  await Promise.all([
    msgRef.update({ status: "closed" }),
    convRef.update({
      lastMessage: "Review submitted.",
      lastMessageTimestamp: ts,
      lastMessageSenderId: userId,
    }),
  ]);
  return res.json({ data: { messageId: recentReviewMessage.id } });
}));

export default router;
