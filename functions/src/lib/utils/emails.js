/* eslint-disable */
export function toJsDate(v) {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  if (v instanceof Date) return new Date(v);
  const secs =
    typeof v.seconds === 'number'
      ? v.seconds
      : typeof v._seconds === 'number'
      ? v._seconds
      : null;
  if (secs !== null) {
    const nanos =
      typeof v.nanoseconds === 'number'
        ? v.nanoseconds
        : typeof v._nanoseconds === 'number'
        ? v._nanoseconds
        : 0;
    return new Date(secs * 1000 + Math.floor(nanos / 1e6));
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Returns a styled gig fee released email to both the musician and the venue.
 *
 * Wording is preserved exactly as in your Cloud Function; only presentation is styled.
 *
 * @async
 * @function sendReviewPromptEmail
 * @param {Object} params
 * @param {string} params.musicianName - Musician's display name.
 * @param {string} params.venueName - Venue display name.
 * @return {Promise<void>}
 */
export const gigFeeReleasedEmail = (musicianName, venueName, isAdmin) => {
    const subject = "Your gig fee is available!";
    const text =
        "We have just cleared your gig fee. You can now withdraw it to your bank account.";
    const financesUrl = "https://giginmusic.com/dashboard/finances";
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
    const iconPath = "M64 96l0 64c0 17.7-14.3 32-32 32s-32-14.3-32-32L0 96C0 43 43 0 96 0L544 0c53 0 96 43 96 96l0 64c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-64c0-17.7-14.3-32-32-32L96 64C78.3 64 64 78.3 64 96zm64 0l384 0 0 352c0 35.3-28.7 64-64 64l-256 0c-35.3 0-64-28.7-64-64l0-352zM256 448c0-35.3-28.7-64-64-64l0 64 64 0zm192-64c-35.3 0-64 28.7-64 64l64 0 0-64zM320 352c53 0 96-35.8 96-80s-43-80-96-80s-96 35.8-96 80s43 80 96 80z";
    const iconSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"
             width="28" height="28" role="img" aria-label="Icon"
             style="display:block;">
          <path d="${iconPath}" fill="#111827"></path>
        </svg>
      `;
    const logoUrl = "https://firebasestorage.googleapis.com/v0/b/giginltd-dev.firebasestorage.app/o/gigin.png?alt=media&token=efd9ba79-f580-454c-98f6-b4a391e0d636";
    const htmlBase = (title, inner) => `
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="background:${baseStyles.bodyBg};padding:32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:${baseStyles.cardBg};border:1px solid ${baseStyles.border};border-radius:16px;">
                <tr>
                  <td style="padding:28px 28px 0 28px;" align="center">
                    <img src="${logoUrl}" width="120" height="36" alt="gigin." style="display:block;border:0;max-width:100%;height:auto;">
                  </td>
                </tr>
    
                <tr>
                  <td style="padding:8px 28px 0 28px;" align="center">
                    <div style="font-size:28px;line-height:1.2;color:${baseStyles.accent}">${iconSvg}</div>
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
                    <a href="${financesUrl}"
                       style="display:inline-block;background:${baseStyles.btnBg};color:${baseStyles.btnText};text-decoration:none;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;padding:12px 18px;border-radius:10px;">
                      Withdraw Funds
                    </a>
                    <div style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;color:${baseStyles.muted};margin-top:10px;">
                      Or paste this into your browser: ${financesUrl}
                    </div>
                  </td>
                </tr>
              </table>
    
              <div style="max-width:600px;margin-top:16px;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;color:${baseStyles.muted};">
                You’re receiving this because you are a musician on Gigin.
              </div>
            </td>
          </tr>
        </table>
      `;
    const adminNote = isAdmin ?
        `You are the band admin - it is your responsibility to split these funds between your band members.` :
        "";
  
    const inner = `
        <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
          Hi ${musicianName},
        </p>
        <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
          We hope your gig at <strong>${venueName}</strong> went well!
        </p>
        ${adminNote ?
          `<p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">${adminNote}</p>` :
          ""}
        <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
          Your fee has been cleared and is available in your Gigin wallet.
        </p>
        <p style="margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
          <a href="${financesUrl}" style="color:#111827;text-decoration:underline;">Log in to Gigin</a> to withdraw it to your bank account.
        </p>
        <p style="margin:16px 0 0 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
          Thanks,<br />The Gigin Team
        </p>
      `;
    const html = htmlBase(subject, inner);
    return {subject, text, html};
  };
  
/**
 * Returns a styled review prompt email to either the musician or the venue.
 *
 * Wording is preserved exactly as in your Cloud Function; only presentation is styled.
 *
 * @async
 * @function sendReviewPromptEmail
 * @param {Object} params
 * @param {'musician'|'venue'} params.audience - Who is receiving the email.
 * @param {string} params.musicianName - Musician's display name.
 * @param {string} params.venueName - Venue display name.
 * @param {string} [params.baseUrl='https://giginmusic.com'] - Base URL for login/review.
 * @return {Promise<void>}
 */
  export const reviewPromptEmail = ({
    audience,
    musicianName,
    venueName,
    baseUrl = "https://giginmusic.com",
  }) => {
    const subject =
        audience === "musician" ? "How did the gig go?" : "How was the performance?";
  
    const text =
        audience === "musician" ?
          `We hope your gig at ${venueName} went well! Let them know how it went.` :
          `How was ${musicianName}'s performance at your gig? Let them know by leaving a review.`;
  
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
  
    const iconPath = "M192 128c0-17.7 14.3-32 32-32s32 14.3 32 32l0 7.8c0 27.7-2.4 55.3-7.1 82.5l-84.4 25.3c-40.6 12.2-68.4 49.6-68.4 92l0 71.9c0 40 32.5 72.5 72.5 72.5c26 0 50-13.9 62.9-36.5l13.9-24.3c26.8-47 46.5-97.7 58.4-150.5l94.4-28.3-12.5 37.5c-3.3 9.8-1.6 20.5 4.4 28.8s15.7 13.3 26 13.3l128 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-83.6 0 18-53.9c3.8-11.3 .9-23.8-7.4-32.4s-20.7-11.8-32.2-8.4L316.4 198.1c2.4-20.7 3.6-41.4 3.6-62.3l0-7.8c0-53-43-96-96-96s-96 43-96 96l0 32c0 17.7 14.3 32 32 32s32-14.3 32-32l0-32zm-9.2 177l49-14.7c-10.4 33.8-24.5 66.4-42.1 97.2l-13.9 24.3c-1.5 2.6-4.3 4.3-7.4 4.3c-4.7 0-8.5-3.8-8.5-8.5l0-71.9c0-14.1 9.3-26.6 22.8-30.7zM24 368c-13.3 0-24 10.7-24 24s10.7 24 24 24l40.3 0c-.2-2.8-.3-5.6-.3-8.5L64 368l-40 0zm592 48c13.3 0 24-10.7 24-24s-10.7-24-24-24l-310.1 0c-6.7 16.3-14.2 32.3-22.3 48L616 416z";
    const iconSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"
             width="28" height="28" role="img" aria-label="Icon"
             style="display:block;">
          <path d="${iconPath}" fill="#111827"></path>
        </svg>
      `;
  
    const logoUrl =
        "https://firebasestorage.googleapis.com/v0/b/giginltd-dev.firebasestorage.app/o/gigin.png?alt=media&token=efd9ba79-f580-454c-98f6-b4a391e0d636";
  
    const htmlBase = (title, inner, ctaHref, ctaLabel) => `
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
                    <div style="font-size:28px;line-height:1.2;color:${baseStyles.accent}">${iconSvg}</div>
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
                    <a href="${ctaHref}"
                       style="display:inline-block;background:${baseStyles.btnBg};color:${baseStyles.btnText};text-decoration:none;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;padding:12px 18px;border-radius:10px;">
                      ${ctaLabel}
                    </a>
                    <div style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;color:${baseStyles.muted};margin-top:10px;word-break:break-all;">
                      Or paste this into your browser: ${ctaHref}
                    </div>
                  </td>
                </tr>
              </table>
              <div style="max-width:600px;margin-top:16px;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;color:${baseStyles.muted};">
                You’re receiving this because you use Gigin.
              </div>
            </td>
          </tr>
        </table>
      `;
  
    const innerMusician = `
        <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
          Hi ${musicianName},
        </p>
        <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
          We hope your gig at <strong>${venueName}</strong> went well!
        </p>
        <p style="margin:0 0 0 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;">
          <a href="${baseUrl}" style="color:#111827;text-decoration:underline;">Log on to Gigin</a> to leave a review.
        </p>
        <p style="margin:16px 0 0 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
          Thanks,<br />The Gigin Team
        </p>
      `;
  
    const innerVenue = `
        <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
          Hi ${venueName},
        </p>
        <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
          How was <strong>${musicianName}</strong>'s performance at your gig?
        </p>
        <p style="margin:0 0 0 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
          We’d love to hear your feedback! <a href="${baseUrl}" style="color:#111827;text-decoration:underline;">Log on to Gigin</a> and leave ${musicianName} a review.
        </p>
        <p style="margin:16px 0 0 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
          Thanks,<br />The Gigin Team
        </p>
      `;
  
    const title = subject;
    const inner = audience === "musician" ? innerMusician : innerVenue;
    const ctaLabel = "Log on to Gigin";
    const html = htmlBase(title, inner, baseUrl, ctaLabel);
  
    return {subject, text, html};
  };
  
  
  /**
   * Builds a styled “Gig Confirmed!” email (subject, text, html).
   * Wording matches your original; only presentation is upgraded.
   *
   * @param {Object} params
   * @param {string} params.musicianName
   * @param {Object} params.gigData - Must include { venue: { venueName }, agreedFee }
   * @param {string|number|Date} params.gigDate - ISO/date-like value
   * @param {string} params.gigTime - e.g. "19:30"
   * @param {string} params.calendarLink - Absolute URL to add event to calendar
   * @return {{subject:string,text:string,html:string}}
   *
   * @example
   * const message = gigConfirmedEmail({
   *   musicianName,
   *   gigData,
   *   gigDate,
   *   gigTime,
   *   calendarLink
   * });
   * // then on the frontend:
   * await addDoc(collection(firestore,'mail'), { to: musicianEmail, message });
   */
  export const gigConfirmedEmail = ({
    musicianName,
    gigData,
    gigDate,
    gigTime,
    calendarLink,
  }) => {
    const formattedDate = toJsDate(gigDate).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  
    const subject = "Gig Confirmed!";
    // Keep original plain-text wording
    const text =
        `Your gig at ${gigData.venue.venueName} on ` +
        `${toJsDate(gigDate).toLocaleDateString()} is now confirmed. ` +
        `Fee: ${gigData.agreedFee}.`;
  
    // === Styled shell (same as your other templates) ===
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
  
    // Icon placeholder (drop your real path when ready)
    const iconPath = "M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z";
    const iconSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"
             width="28" height="28" role="img" aria-label="Icon"
             style="display:block;">
          <path d="${iconPath}" fill="#111827"></path>
        </svg>
      `;
  
    // Hosted logo (swap to your Vercel/Hosting URL when available)
    const logoUrl =
        "https://firebasestorage.googleapis.com/v0/b/giginltd-dev.firebasestorage.app/o/gigin.png?alt=media&token=efd9ba79-f580-454c-98f6-b4a391e0d636";
  
    const htmlBase = (title, inner, ctaHref, ctaLabel) => `
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
                    <div style="font-size:28px;line-height:1.2;color:${baseStyles.accent}">${iconSvg}</div>
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
                    <a href="${ctaHref}"
                       style="display:inline-block;background:${baseStyles.btnBg};color:${baseStyles.btnText};text-decoration:none;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;padding:12px 18px;border-radius:10px;">
                      ${ctaLabel}
                    </a>
                    <div style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;color:${baseStyles.muted};margin-top:10px;word-break:break-all;">
                      Or paste this into your browser: ${ctaHref}
                    </div>
                  </td>
                </tr>
              </table>
    
              <div style="max-width:600px;margin-top:16px;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;color:${baseStyles.muted};">
                You’re receiving this because you are a musician on Gigin.
              </div>
            </td>
          </tr>
        </table>
      `;
  
    // === Inner content (wording unchanged) ===
    const inner = `
        <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
          Hi ${musicianName},
        </p>
        <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
          Great news! Your gig is now confirmed:
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
               style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;color:${baseStyles.text};margin:0 0 16px 0;">
          <tr>
            <td style="padding:8px 0;border-top:1px solid ${baseStyles.border};"><strong>Gig:</strong> ${gigData.venue.venueName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;border-top:1px solid ${baseStyles.border};"><strong>Date:</strong> ${formattedDate}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;border-top:1px solid ${baseStyles.border};"><strong>Time:</strong> ${gigTime}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;border-top:1px solid ${baseStyles.border};"><strong>Fee:</strong> ${gigData.agreedFee}</td>
          </tr>
        </table>
        <p style="margin:0 0 0 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;">
          <a href="${calendarLink}" style="color:#111827;text-decoration:underline;">Add to your calendar</a>
        </p>
        <p style="margin:16px 0 0 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
          Thanks,<br />The Gigin Team
        </p>
      `;
  
    const html = htmlBase(subject, inner, calendarLink, "Add to Calendar");
  
    return {subject, text, html};
  };