/* eslint-disable */
import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { mailUserLimiter, sendStoredMail } from "../lib/outboundMail.js";

const router = express.Router();

router.post("/:kind", requireAuth, mailUserLimiter, asyncHandler(async (req, res) => {
  try {
    const result = await sendStoredMail(req.auth.uid, req.params.kind, req.body);
    return res.json(result || { sent: true });
  } catch (error) {
    const denied = error.code === "permission-denied";
    const status = denied ? 403 : (error.statusCode || 500);
    if (status >= 500) console.error("mail send failed", error);
    return res.status(status).json({
      error: status === 404 ? "Not Found" : denied || status === 403 ? "PERMISSION_DENIED" : "INVALID_ARGUMENT",
      message: status >= 500 ? "Could not send email" : error.message,
    });
  }
}));

export default router;
