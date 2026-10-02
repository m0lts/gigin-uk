/* eslint-disable */
import express from "express";
import rateLimit from "express-rate-limit";
import { admin } from "../config/admin.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { queueMail } from "../lib/queueMail.js";
import { renderArtistEmail } from "../lib/artistEmails.js";

const router = express.Router();
const ORIGIN = process.env.BASE_URL || "https://giginmusic.com";
const FROM = "Gigin <noreply@giginmusic.com>";

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { sent: true },
});

function firstName(user) {
  const raw = user?.displayName || "";
  const part = String(raw).trim().split(/\s+/)[0];
  return part || "there";
}

router.post("/password-reset", limiter, asyncHandler(async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.json({ sent: true });
  }
  try {
    const user = await admin.auth().getUserByEmail(email);
    const link = await admin.auth().generatePasswordResetLink(email, {
      url: `${ORIGIN}/auth/reset`,
      handleCodeInApp: true,
    });
    const oobCode = new URL(link).searchParams.get("oobCode") || "";
    const resetUrl = `${ORIGIN}/auth/reset?oobCode=${encodeURIComponent(oobCode)}`;
    const message = renderArtistEmail({
      subject: "Reset your Gigin password",
      preheader: "The link works once, for 1 hour.",
      eyebrow: "PASSWORD RESET",
      heading: "Choose a new password",
      paras: [
        `Hi ${firstName(user)},`,
        `Someone asked to reset the password for <b>${email}</b> on Gigin. If it was you, tap the button. The link works once, for 1 hour.`,
      ],
      button: ["Choose a new password", resetUrl],
      buttonDark: true,
      small: "If you didn't ask for this, you can ignore this email. Your password won't change.",
      footer: "You're getting this because someone asked to reset the password for this email on giginmusic.com.",
    });
    await queueMail({ to: email, from: FROM, message });
  } catch (error) {
    if (error?.code !== "auth/user-not-found") console.error("password reset", error);
  }
  return res.json({ sent: true });
}));

export default router;
