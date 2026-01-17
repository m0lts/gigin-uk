/* eslint-disable */
import { db } from "../../../lib/admin.js";

/**
 * Sends an email notification when a user receives a message.
 * Uses the Firebase "Trigger Email" extension by writing to the `mail` collection.
 * 
 * @param {Object} params
 * @param {string} params.recipientEmail - Recipient email address
 * @param {string} params.senderName - Name of the sender (venue or artist)
 * @param {string} params.conversationId - Conversation ID for the link
 * @returns {Promise<void>}
 */
export const sendMessageNotificationEmail = async ({
  recipientEmail,
  senderName,
  conversationId,
}) => {
  const subject = `You received a message on Gigin from ${senderName}`;
  const text = `You received a message on Gigin from ${senderName}. Visit your dashboard to view the message.`;

  const baseStyles = {
    bodyBg: "#f9f9f9",
    cardBg: "#ffffff",
    text: "#333333",
    muted: "#6b7280",
    accent: "#111827",
    border: "#e5e7eb",
    btnBg: "#111827",
    btnText: "#ffffff",
    gnOrange: "#FF6C4B",
    gnOffsetOrange: "#fff1ee",
  };

  // Get base URL from environment or use default
  const baseUrl = process.env.BASE_URL || "https://app.gigin.com";
  const dashboardUrl = `${baseUrl}/dashboard`;
  // Use generic messages link - will work for artists, venues can navigate from dashboard
  const messagesUrl = `${baseUrl}/messages?conversationId=${conversationId}`;

  const logoUrl =
    "https://firebasestorage.googleapis.com/v0/b/giginltd-dev.firebasestorage.app/o/gigin.png?alt=media&token=efd9ba79-f580-454c-98f6-b4a391e0d636";

  const htmlBase = (title, inner) => `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="background:${baseStyles.bodyBg};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:${baseStyles.cardBg};border:1px solid ${baseStyles.border};border-radius:16px;">
            <tr>
              <td style="padding:28px 28px 0 28px;" align="center">
                <img src="${logoUrl}" width="120" height="36" alt="gigin."
                     style="display:block;border:0;max-width:100%;height:auto;">
              </td>
            </tr>

            <tr>
              <td style="padding:8px 28px 0 28px;" align="center">
                <h1 style="margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:20px;line-height:28px;color:${baseStyles.accent};font-weight:700;">
                  ${title}
                </h1>
              </td>
            </tr>

            <tr>
              <td style="padding:16px 28px 0 28px;">
                ${inner}
              </td>
            </tr>

            <tr>
              <td style="padding:20px 28px 28px 28px;" align="center">
                <a href="${messagesUrl}"
                   style="display:inline-block;background:${baseStyles.btnBg};color:${baseStyles.btnText};text-decoration:none;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;padding:12px 18px;border-radius:10px;">
                  View Message
                </a>
                <div style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;color:${baseStyles.muted};margin-top:10px;word-break:break-all;">
                  Or paste this into your browser: ${messagesUrl}
                </div>
              </td>
            </tr>
          </table>

          <div style="max-width:600px;margin-top:16px;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;color:${baseStyles.muted};">
            You're receiving this because you received a message on Gigin.
          </div>
        </td>
      </tr>
    </table>
  `;

  const inner = `
    <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      You received a message on Gigin from <strong>${senderName}</strong>.
    </p>
    <p style="margin:0 0 16px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      <a href="${messagesUrl}" style="color:#111827;text-decoration:underline;">Click here to view the message</a> or visit your <a href="${dashboardUrl}" style="color:#111827;text-decoration:underline;">dashboard</a>.
    </p>
  `;

  const html = htmlBase(subject, inner);

  // Write to mail collection (Trigger Email extension will handle sending)
  const mailRef = db.collection("mail");
  await mailRef.add({
    to: recipientEmail,
    message: { subject, text, html },
  });
};
