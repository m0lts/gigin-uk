/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { admin, db } from "../../../lib/admin.js";
import { WARM_RUNTIME_OPTIONS } from "../../../config/constants.js";

export const sendVerificationEmail = callable(
  { 
    authRequired: true,
    timeoutSeconds: 30,
    enforceAppCheck: true,
    ...WARM_RUNTIME_OPTIONS,
  },
  async (req) => {
    const user = await admin.auth().getUser(req.auth.uid);
    if (!user.email) {
      const e = new Error("PERMISSION_DENIED: no email on user");
      e.code = "permission-denied";
      throw e;
    }
    const receivedUrl = (req.data?.actionUrl || "").toString();
    
    const link = await admin.auth().generateEmailVerificationLink(user.email, {
      url: receivedUrl,
      handleCodeInApp: false,
    });

    // Write to the extension’s collection
    const subject = "Verify your email";
    const text = `Hi,
    
    Please confirm your address to finish setting up your Gigin account.
    
    ${link}
    
    If you didn’t request this, you can safely ignore this email.`;
    
    // === Styled email shell (aligned with your invite template) ===
    const base = {
      bodyBg: "#f9f9f9",
      cardBg: "#ffffff",
      text: "#333333",
      muted: "#6b7280",
      accent: "#111827",
      border: "#e5e7eb",
      btnBg: "#111827",
      btnText: "#ffffff",
    };
    
    const iconPath =
      "M256 0c36.8 0 68.8 20.7 84.9 51.1C373.8 41 411 49 437 75s34 63.3 23.9 96.1C491.3 187.2 512 219.2 512 256s-20.7 68.8-51.1 84.9C471 373.8 463 411 437 437s-63.3 34-96.1 23.9C324.8 491.3 292.8 512 256 512s-68.8-20.7-84.9-51.1C138.2 471 101 463 75 437s-34-63.3-23.9-96.1C20.7 324.8 0 292.8 0 256s20.7-68.8 51.1-84.9C41 138.2 49 101 75 75s63.3-34 96.1-23.9C187.2 20.7 219.2 0 256 0zM369 209c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-111 111-47-47c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l64 64c9.4 9.4 24.6 9.4 33.9 0L369 209z"; // plus icon
    const iconSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"
           width="28" height="28" role="img" aria-label="Action" style="display:block;">
        <path d="${iconPath}" fill="${base.accent}"></path>
      </svg>
    `;
    
    // Use your hosted logo
    const logoUrl = "https://firebasestorage.googleapis.com/v0/b/giginltd-dev.firebasestorage.app/o/gigin.png?alt=media&token=efd9ba79-f580-454c-98f6-b4a391e0d636";
    
    const htmlShell = (title, inner) => `
    <!doctype html>
    <html>
      <body style="margin:0;padding:0;background:${base.bodyBg};font-family:Inter,Segoe UI,Arial,sans-serif;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="background:${base.bodyBg};padding:32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:${base.cardBg};border:1px solid ${base.border};border-radius:16px;">
                <tr>
                  <td style="padding:28px 28px 0 28px;" align="center">
                    <img src="${logoUrl}" width="120" height="36" alt="gigin."
                         style="display:block;border:0;max-width:100%;height:auto;">
                  </td>
                </tr>
    
                <tr>
                  <td style="padding:8px 28px 0 28px;" align="center">
                    <div style="font-size:28px;line-height:1.2;color:${base.accent}">${iconSvg}</div>
                  </td>
                </tr>
    
                <tr>
                  <td style="padding:8px 28px 0 28px;" align="center">
                    <h1 style="margin:0;font-size:20px;line-height:28px;color:${base.accent};font-weight:700;">
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
                    <a href="${link}"
                       style="display:inline-block;background:${base.btnBg};color:${base.btnText};text-decoration:none;font-size:14px;padding:12px 18px;border-radius:10px;font-weight:600">
                      Verify email
                    </a>
                    <div style="font-size:12px;color:${base.muted};margin-top:10px;word-break:break-all;">
                      Or paste this into your browser: ${link}
                    </div>
                  </td>
                </tr>
              </table>
    
              <div style="max-width:600px;margin-top:16px;font-size:12px;color:${base.muted};text-align:center;">
                If you didn’t request this, you can safely ignore this email.
              </div>
            </td>
          </tr>
        </table>
      </body>
    </html>
    `;
    
    const inner = `
      <p style="margin:0 0 12px 0;font-size:14px;line-height:22px;color:${base.text}">
        Hi,
      </p>
      <p style="margin:0 0 16px 0;font-size:14px;line-height:22px;color:${base.text}">
        Please confirm your address to finish setting up your Gigin account.
      </p>
    `;
    
    const html = htmlShell("Verify your email", inner);
    
    await db.collection("mail").add({
      to: user.email,
      message: { subject, text, html },
    });
    return { success: true };
  }
);