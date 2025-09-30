import { firestore } from '@lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  onSnapshot,
  Timestamp,
  orderBy
} from 'firebase/firestore';
import { NextGigIcon } from '../../features/shared/ui/extras/Icons';
import { TextLogo } from '../../features/shared/ui/logos/Logos';

/**
 * Sends an email using the Firestore 'mail' collection.
 *
 * @param {Object} params - Email parameters.
 * @param {string} params.to - Recipient email address.
 * @param {string} params.subject - Subject of the email.
 * @param {string} params.text - Plain text version of the email.
 * @param {string} params.html - HTML version of the email.
 * @returns {Promise<void>}
 */
export const sendEmail = async ({ to, subject, text, html }) => {
  const mailRef = collection(firestore, 'mail');
  await addDoc(mailRef, {
    to,
    message: {
      subject,
      text,
      html,
    },
  });
};

/**
 * Sends an email to a venue about a new gig application.
 * 
 * @param {Object} options
 * @param {string} options.to - Recipient email address.
 * @param {string} options.musicianName - Name of the applying musician.
 * @param {string} options.venueName - Name of the venue.
 * @param {string} options.date - Formatted date of the gig.
 * @param {string} options.budget - Proposed fee.
 */
export const sendGigApplicationEmail = async ({
  to,
  musicianName,
  venueName,
  date,
  budget,
  profileType = 'musician',
  nonPayableGig = false,
}) => {
  const isBand = profileType === 'band';

  const subject = isBand
    ? `New Gig Application`
    : `New Gig Application`;

  const feeText = nonPayableGig ? '' : ` They have proposed a fee of ${budget}.`;

  const text = isBand
  ? `${musicianName} have applied to your gig on ${date} at ${venueName}.${feeText}`
  : `${musicianName} has applied to your gig on ${date} at ${venueName}.${feeText}`;

  const dashboardUrl = `${window.location.origin}/venues/dashboard/gigs`;

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

  const iconPath = 'M499.1 6.3c8.1 6 12.9 15.6 12.9 25.7l0 72 0 264c0 44.2-43 80-96 80s-96-35.8-96-80s43-80 96-80c11.2 0 22 1.6 32 4.6L448 147 192 223.8 192 432c0 44.2-43 80-96 80s-96-35.8-96-80s43-80 96-80c11.2 0 22 1.6 32 4.6L128 200l0-72c0-14.1 9.3-26.6 22.8-30.7l320-96c9.7-2.9 20.2-1.1 28.3 5z';
  const iconSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"
        width="28" height="28" role="img" aria-label="Icon"
        style="display:block;">
      <path d="${iconPath}" fill="#111827"></path>
    </svg>
  `;

  const logoUrl = "https://firebasestorage.googleapis.com/v0/b/giginltd-dev.firebasestorage.app/o/gigin.png?alt=media&token=efd9ba79-f580-454c-98f6-b4a391e0d636";

  const htmlBase = (inner) => `
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
                  New Gig Application
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
                <!-- CTA Button -->
                <a href="${dashboardUrl}"
                  style="display:inline-block;background:${baseStyles.btnBg};color:${baseStyles.btnText};text-decoration:none;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;padding:12px 18px;border-radius:10px;">
                  Review Application
                </a>
                <div style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;color:${baseStyles.muted};margin-top:10px;">
                  Or paste this into your browser: ${dashboardUrl}
                </div>
              </td>
            </tr>

          </table>
          <div style="max-width:600px;margin-top:16px;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;color:${baseStyles.muted};">
            You’re receiving this because you have a venue on Gigin.
          </div>
        </td>
      </tr>
    </table>
  `;

  // BAND version
  const htmlBandInner = `
    <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      <strong>${musicianName}</strong> have applied to your gig:
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;color:${baseStyles.text};margin:0 0 16px 0;">
      <tr>
        <td style="padding:8px 0;border-top:1px solid ${baseStyles.border};"><strong>Date:</strong> ${date}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;border-top:1px solid ${baseStyles.border};"><strong>Venue:</strong> ${venueName}</td>
      </tr>
      ${!nonPayableGig
        ? `<tr><td style="padding:8px 0;border-top:1px solid ${baseStyles.border};"><strong>Proposed Fee:</strong> ${budget}</td></tr>`
        : ""
      }
    </table>
    <p style="margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      Visit your <a href="${dashboardUrl}" style="color:#111827;text-decoration:underline;">dashboard</a> to review this application.
    </p>
  `;

  // SOLO version
  const htmlSoloInner = `
    <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      <strong>${musicianName}</strong> has applied to your gig:
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;color:${baseStyles.text};margin:0 0 16px 0;">
      <tr>
        <td style="padding:8px 0;border-top:1px solid ${baseStyles.border};"><strong>Date:</strong> ${date}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;border-top:1px solid ${baseStyles.border};"><strong>Venue:</strong> ${venueName}</td>
      </tr>
      ${!nonPayableGig
        ? `<tr><td style="padding:8px 0;border-top:1px solid ${baseStyles.border};"><strong>Proposed Fee:</strong> ${budget}</td></tr>`
        : ""
      }
    </table>
    <p style="margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      Visit your <a href="${dashboardUrl}" style="color:#111827;text-decoration:underline;">dashboard</a> to review this application.
    </p>
  `;

  const html = htmlBase(isBand ? htmlBandInner : htmlSoloInner);

  const mailRef = collection(firestore, 'mail');
  await addDoc(mailRef, {
    to,
    message: {
      subject,
      text,
      html,
    },
  });
};


/**
 * Sends an email to the venue notifying them of a fee negotiation.
 * 
 * @param {Object} options
 * @param {string} options.to - Email address of the venue.
 * @param {string} options.musicianName - Name of the musician.
 * @param {string} options.venueName - Venue name.
 * @param {string|number} options.oldFee - Original fee.
 * @param {string|number} options.newFee - Proposed fee.
 * @param {string} options.date - Formatted date of the gig.
 */
export const sendNegotiationEmail = async ({
  to,
  musicianName,
  venueName,
  oldFee,
  newFee,
  date,
  profileType,
}) => {
  const verb = profileType === 'band' ? 'have' : 'has';

  const subject = `New Negotiation Request`;
  const text = `${musicianName} ${verb} proposed a new fee for your gig on ${date} at ${venueName}.`;

  const dashboardUrl = `${window.location.origin}/venues/dashboard/gigs`;

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

  const iconPath = 'M323.4 85.2l-96.8 78.4c-16.1 13-19.2 36.4-7 53.1c12.9 17.8 38 21.3 55.3 7.8l99.3-77.2c7-5.4 17-4.2 22.5 2.8s4.2 17-2.8 22.5l-20.9 16.2L550.2 352l41.8 0c26.5 0 48-21.5 48-48l0-128c0-26.5-21.5-48-48-48l-76 0-4 0-.7 0-3.9-2.5L434.8 79c-15.3-9.8-33.2-15-51.4-15c-21.8 0-43 7.5-60 21.2zm22.8 124.4l-51.7 40.2C263 274.4 217.3 268 193.7 235.6c-22.2-30.5-16.6-73.1 12.7-96.8l83.2-67.3c-11.6-4.9-24.1-7.4-36.8-7.4C234 64 215.7 69.6 200 80l-72 48-80 0c-26.5 0-48 21.5-48 48L0 304c0 26.5 21.5 48 48 48l108.2 0 91.4 83.4c19.6 17.9 49.9 16.5 67.8-3.1c5.5-6.1 9.2-13.2 11.1-20.6l17 15.6c19.5 17.9 49.9 16.6 67.8-2.9c4.5-4.9 7.8-10.6 9.9-16.5c19.4 13 45.8 10.3 62.1-7.5c17.9-19.5 16.6-49.9-2.9-67.8l-134.2-123z';
  const iconSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"
         width="28" height="28" role="img" aria-label="Icon"
         style="display:block;">
      <path d="${iconPath}" fill="#111827"></path>
    </svg>
  `;

  // Host this on Vercel/Storage; keep or replace with your CDN URL
  const logoUrl = "https://firebasestorage.googleapis.com/v0/b/giginltd-dev.firebasestorage.app/o/gigin.png?alt=media&token=efd9ba79-f580-454c-98f6-b4a391e0d636";

  const htmlBase = (inner) => `
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
                  New Negotiation Request
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
                <a href="${dashboardUrl}"
                   style="display:inline-block;background:${baseStyles.btnBg};color:${baseStyles.btnText};text-decoration:none;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;padding:12px 18px;border-radius:10px;">
                  Review Negotiation
                </a>
                <div style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;color:${baseStyles.muted};margin-top:10px;">
                  Or paste this into your browser: ${dashboardUrl}
                </div>
              </td>
            </tr>

          </table>
          <div style="max-width:600px;margin-top:16px;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;color:${baseStyles.muted};">
            You’re receiving this because you have a venue on Gigin.
          </div>
        </td>
      </tr>
    </table>
  `;

  const inner = `
    <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      <strong>${musicianName}</strong> ${verb} proposed a new fee for your gig:
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
      style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;color:${baseStyles.text};margin:0 0 16px 0;">
      <tr>
        <td style="padding:8px 0;border-top:1px solid ${baseStyles.border};"><strong>Old Fee:</strong> ${oldFee}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;border-top:1px solid ${baseStyles.border};"><strong>Proposed Fee:</strong> ${newFee}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;border-top:1px solid ${baseStyles.border};"><strong>Date:</strong> ${date}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;border-top:1px solid ${baseStyles.border};"><strong>Venue:</strong> ${venueName}</td>
      </tr>
    </table>
    <p style="margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      Visit your <a href="${dashboardUrl}" style="color:#111827;text-decoration:underline;">dashboard</a> to review this negotiation.
    </p>
  `;

  const html = htmlBase(inner);

  const mailRef = collection(firestore, 'mail');
  await addDoc(mailRef, {
    to,
    message: { subject, text, html },
  });
};



/**
 * Sends an email notification after a gig is accepted (invitation or negotiation).
 * 
 * @param {Object} params
 * @param {'musician' | 'venue'} params.userRole - Role of the user accepting the gig.
 * @param {Object} params.musicianProfile - Musician profile data.
 * @param {Object} params.venueProfile - Venue profile data.
 * @param {Object} params.gigData - Full gig object.
 * @param {string | number} params.agreedFee - The agreed-upon fee.
 * @param {boolean} [params.isNegotiated=false] - Whether this was a negotiation acceptance.
 * @returns {Promise<void>}
 */
export const sendGigAcceptedEmail = async ({
  userRole,
  musicianProfile,
  venueProfile,
  gigData,
  agreedFee,
  isNegotiated = false,
  nonPayableGig = false,
}) => {
  const formattedDate = new Date(gigData.date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const isBand = musicianProfile.bandProfile === true;
  const musicianName = musicianProfile.name;
  const verb = isBand ? 'have' : 'has';

  const subjectMap = {
    musician: isNegotiated
      ? 'Your Negotiation Was Accepted!'
      : 'Your Invitation Was Accepted!',
    venue: isNegotiated
      ? 'Your Gig Negotiation Has Been Accepted!'
      : 'Your Gig Application Has Been Accepted!',
  };

  const textMap = {
    musician: isNegotiated
      ? `${musicianName} ${verb} accepted your negotiated fee for the gig at ${gigData.venue.venueName} on ${formattedDate}.`
      : `${musicianName} ${verb} accepted your invitation for the gig at ${gigData.venue.venueName} on ${formattedDate}.`,
    venue: isNegotiated
      ? `Congratulations! Your negotiation for the gig at ${gigData.venue.venueName} on ${formattedDate} has been accepted.`
      : `Congratulations! Your application for the gig at ${gigData.venue.venueName} on ${formattedDate} has been accepted.`,
  };

  // === Styled Email Shell (same as your finalized template) ===
  const dashboardUrlVenue = `${window.location.origin}/venues/dashboard`;
  const dashboardUrlMusician = `${window.location.origin}/dashboard`;
  const dashboardUrl = userRole === 'musician' ? dashboardUrlVenue : dashboardUrlMusician;

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

  const iconPath = 'M32 32a32 32 0 1 1 64 0A32 32 0 1 1 32 32zM448 160a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zm32 256a32 32 0 1 1 0 64 32 32 0 1 1 0-64zM167 153c-9.4-9.4-9.4-24.6 0-33.9l8.3-8.3c16.7-16.7 27.2-38.6 29.8-62.1l3-27.4C209.6 8.2 221.5-1.3 234.7 .1s22.7 13.3 21.2 26.5l-3 27.4c-3.8 34.3-19.2 66.3-43.6 90.7L201 153c-9.4 9.4-24.6 9.4-33.9 0zM359 311l8.2-8.3c24.4-24.4 56.4-39.8 90.7-43.6l27.4-3c13.2-1.5 25 8 26.5 21.2s-8 25-21.2 26.5l-27.4 3c-23.5 2.6-45.4 13.1-62.1 29.8L393 345c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9zM506.3 8.5c8.6 10.1 7.3 25.3-2.8 33.8l-10 8.5c-14.8 12.5-33.7 19.1-53 18.6c-16.6-.4-30.6 12.4-31.6 29l-1.8 30c-2.5 42.5-38.3 75.3-80.8 74.2c-7.6-.2-15 2.4-20.7 7.3l-10 8.5c-10.1 8.6-25.3 7.3-33.8-2.8s-7.3-25.3 2.8-33.8l10-8.5c14.8-12.5 33.7-19.1 53-18.6c16.6 .4 30.6-12.4 31.6-29l1.8-30c2.5-42.5 38.3-75.3 80.8-74.2c7.6 .2 15-2.4 20.7-7.3l10-8.5c10.1-8.6 25.3-7.3 33.8 2.8zM150.6 201.4l160 160c7.7 7.7 10.9 18.8 8.6 29.4s-9.9 19.4-20 23.2l-39.7 14.9L83.1 252.5 98 212.8c3.8-10.2 12.6-17.7 23.2-20s21.7 1 29.4 8.6zM48.2 345.6l22.6-60.2L226.6 441.2l-60.2 22.6L48.2 345.6zM35.9 378.5l97.6 97.6L43.2 510c-11.7 4.4-25 1.5-33.9-7.3S-2.4 480.5 2 468.8l33.8-90.3z';
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
                <a href="${dashboardUrl}"
                   style="display:inline-block;background:${baseStyles.btnBg};color:${baseStyles.btnText};text-decoration:none;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;padding:12px 18px;border-radius:10px;">
                  Open Dashboard
                </a>
                <div style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;color:${baseStyles.muted};margin-top:10px;">
                  Or paste this into your browser: ${dashboardUrl}
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

  // === Role-specific inner content (wording unchanged) ===
  const innerMusician = `
    <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      Hi ${venueProfile.accountName},
    </p>
    <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      We're excited to inform you that <strong>${musicianName}</strong> ${verb} accepted your ${isNegotiated ? 'negotiation' : 'invitation'} for the following gig:
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
        <td style="padding:8px 0;border-top:1px solid ${baseStyles.border};"><strong>Fee:</strong> ${!nonPayableGig && (agreedFee)}</td>
      </tr>
    </table>
    <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      ${
        nonPayableGig
          ? 'This gig is now confirmed — no payment is required.'
          : 'The gig will be confirmed once you have paid the gig fee.'
      }
    </p>
    <p style="margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      Thanks,<br />The Gigin Team
    </p>
  `;

  const innerVenue = `
    <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      Hi ${musicianName},
    </p>
    <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      We're excited to inform you that your ${isNegotiated ? 'negotiation' : 'application'} for the following gig has been accepted:
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
        <td style="padding:8px 0;border-top:1px solid ${baseStyles.border};"><strong>Fee:</strong>${!nonPayableGig && (agreedFee)}</td>
      </tr>
    </table>
    <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      ${
        nonPayableGig
          ? 'This gig is already confirmed — no payment is required from the venue.'
          : 'The gig will be confirmed once the venue has paid the gig fee.'
      }
    </p>
    <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      Please visit your <a href='${window.location.origin}/dashboard' style="color:#111827;text-decoration:underline;">dashboard</a> to see the status of the gig.
    </p>
    <p style="margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      Thanks,<br />The Gigin Team
    </p>
  `;

  const title = subjectMap[userRole];
  const inner = userRole === 'musician' ? innerMusician : innerVenue;
  const html = htmlBase(title, inner);

  const to = userRole === 'musician' ? venueProfile.email : musicianProfile.email;

  const mailRef = collection(firestore, 'mail');
  await addDoc(mailRef, {
    to,
    message: {
      subject: subjectMap[userRole],
      text: textMap[userRole],
      html,
    },
  });
};


/**
 * Sends an email notification when a gig offer or negotiation is declined.
 * 
 * @param {Object} params
 * @param {'musician' | 'venue'} params.userRole
 * @param {Object} params.musicianProfile
 * @param {Object} params.venueProfile
 * @param {Object} params.gigData
 * @param {'application' | 'negotiation'} params.declineType
 * @returns {Promise<void>}
 */
export const sendGigDeclinedEmail = async ({
  userRole,
  musicianProfile,
  venueProfile,
  gigData,
  declineType = 'application',
}) => {
  const formattedDate = new Date(gigData.date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const mailRef = collection(firestore, 'mail');
  const isBand = musicianProfile.bandProfile === true;
  const musicianName = musicianProfile.name;
  const verb = isBand ? 'have' : 'has';

  const subjectMap = {
    musician: {
      negotiation: 'Your Negotiation Was Declined',
      application: 'Your Invitation Was Declined',
    },
    venue: {
      negotiation: 'Your Gig Negotiation Has Been Declined',
      application: 'Your Gig Application Has Been Declined',
    },
  };

  const textMap = {
    musician: {
      negotiation: `${musicianName} ${verb} declined your negotiated fee for the gig at ${gigData.venue.venueName} on ${formattedDate}.`,
      application: `${musicianName} ${verb} declined your invitation for the gig at ${gigData.venue.venueName} on ${formattedDate}.`,
    },
    venue: {
      negotiation: `Your negotiation for the gig at ${gigData.venue.venueName} on ${formattedDate} has been declined.`,
      application: `Your application for the gig at ${gigData.venue.venueName} on ${formattedDate} has been declined.`,
    },
  };

  // === Styled shell (same as your completed template) ===
  const dashboardUrlVenue = `${window.location.origin}/venues/dashboard/gigs`;
  const dashboardUrlMusician = `${window.location.origin}/dashboard`;
  const dashboardUrl = userRole === 'musician' ? dashboardUrlVenue : dashboardUrlMusician;

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

  // Leave your icon path empty; you can drop it in later
  const iconPath = 'M119.4 44.1c23.3-3.9 46.8-1.9 68.6 5.3l49.8 77.5-75.4 75.4c-1.5 1.5-2.4 3.6-2.3 5.8s1 4.2 2.6 5.7l112 104c2.9 2.7 7.4 2.9 10.5 .3s3.8-7 1.7-10.4l-60.4-98.1 90.7-75.6c2.6-2.1 3.5-5.7 2.4-8.8L296.8 61.8c28.5-16.7 62.4-23.2 95.7-17.6C461.5 55.6 512 115.2 512 185.1l0 5.8c0 41.5-17.2 81.2-47.6 109.5L283.7 469.1c-7.5 7-17.4 10.9-27.7 10.9s-20.2-3.9-27.7-10.9L47.6 300.4C17.2 272.1 0 232.4 0 190.9l0-5.8c0-69.9 50.5-129.5 119.4-141z';
  const iconSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"
         width="28" height="28" role="img" aria-label="Icon"
         style="display:block;">
      <path d="${iconPath}" fill="#111827"></path>
    </svg>
  `;

  // Same logo URL pattern you used before
  const logoUrl = "https://firebasestorage.googleapis.com/v0/b/giginltd-dev.firebasestorage.app/o/gigin.png?alt=media&token=efd9ba79-f580-454c-98f6-b4a391e0d636";

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
                <a href="${dashboardUrl}"
                   style="display:inline-block;background:${baseStyles.btnBg};color:${baseStyles.btnText};text-decoration:none;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;padding:12px 18px;border-radius:10px;">
                  Open Dashboard
                </a>
                <div style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;color:${baseStyles.muted};margin-top:10px;">
                  Or paste this into your browser: ${dashboardUrl}
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

  // === Role + declineType specific inner content (wording unchanged) ===
  const innerMap = {
    musician: {
      negotiation: `
        <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
          Hi ${venueProfile.accountName},
        </p>
        <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
          <strong>${musicianName}</strong> ${verb} declined your negotiation for the following gig:
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
          style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;color:${baseStyles.text};margin:0 0 16px 0;">
          <tr>
            <td style="padding:8px 0;border-top:1px solid ${baseStyles.border};"><strong>Gig:</strong> ${gigData.venue.venueName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;border-top:1px solid ${baseStyles.border};"><strong>Date:</strong> ${formattedDate}</td>
          </tr>
        </table>
        <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
          Visit your <a href='${dashboardUrlVenue}' style="color:#111827;text-decoration:underline;">dashboard</a> to propose a different offer.
        </p>
        <p style="margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
          Thanks,<br />The Gigin Team
        </p>
      `,
      application: `
        <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
          Hi ${venueProfile.accountName},
        </p>
        <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
          <strong>${musicianName}</strong> ${verb} declined your invitation for the following gig:
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
          style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;color:${baseStyles.text};margin:0 0 16px 0;">
          <tr>
            <td style="padding:8px 0;border-top:1px solid ${baseStyles.border};"><strong>Gig:</strong> ${gigData.venue.venueName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;border-top:1px solid ${baseStyles.border};"><strong>Date:</strong> ${formattedDate}</td>
          </tr>
        </table>
        <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
          Visit your <a href='${dashboardUrlVenue}' style="color:#111827;text-decoration:underline;">dashboard</a> to find another musician.
        </p>
        <p style="margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
          Thanks,<br />The Gigin Team
        </p>
      `,
    },
    venue: {
      negotiation: `
        <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
          Hi ${musicianName},
        </p>
        <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
          Unfortunately, your negotiation for the following gig has been declined:
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
          style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;color:${baseStyles.text};margin:0 0 16px 0;">
          <tr>
            <td style="padding:8px 0;border-top:1px solid ${baseStyles.border};"><strong>Gig:</strong> ${gigData.venue.venueName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;border-top:1px solid ${baseStyles.border};"><strong>Date:</strong> ${formattedDate}</td>
          </tr>
        </table>
        <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
          Please visit your <a href='${dashboardUrlMusician}' style="color:#111827;text-decoration:underline;">dashboard</a> to make another offer.
        </p>
        <p style="margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
          Thanks,<br />The Gigin Team
        </p>
      `,
      application: `
        <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
          Hi ${musicianName},
        </p>
        <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
          Unfortunately, your application for the following gig has been declined:
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
          style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;color:${baseStyles.text};margin:0 0 16px 0;">
          <tr>
            <td style="padding:8px 0;border-top:1px solid ${baseStyles.border};"><strong>Gig:</strong> ${gigData.venue.venueName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;border-top:1px solid ${baseStyles.border};"><strong>Date:</strong> ${formattedDate}</td>
          </tr>
        </table>
        <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
          Please visit your <a href='${dashboardUrlMusician}' style="color:#111827;text-decoration:underline;">dashboard</a> to discover other gigs.
        </p>
        <p style="margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
          Thanks,<br />The Gigin Team
        </p>
      `,
    },
  };

  const title = subjectMap[userRole][declineType];
  const inner = innerMap[userRole][declineType];
  const html = htmlBase(title, inner);

  await addDoc(mailRef, {
    to: userRole === 'musician' ? venueProfile.email : musicianProfile.email,
    message: {
      subject: subjectMap[userRole][declineType],
      text: textMap[userRole][declineType],
      html,
    },
  });
};


/**
 * Sends an email notifying the receiver about a counter-offer.
 * 
 * @param {Object} params
 * @param {'musician' | 'venue'} params.userRole
 * @param {Object} params.musicianProfile
 * @param {Object} params.venueProfile
 * @param {Object} params.gigData
 * @param {number} params.newFee
 * @returns {Promise<void>}
 */
export const sendCounterOfferEmail = async ({
  userRole,
  musicianProfile,
  venueProfile,
  gigData,
  newFee,
}) => {
  const formattedDate = new Date(gigData.date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const mailRef = collection(firestore, 'mail');
  const isBand = musicianProfile.bandProfile === true;
  const name = musicianProfile.name;
  const verb = isBand ? 'have' : 'has';

  const to = userRole === 'musician' ? venueProfile.email : musicianProfile.email;

  const subject = `You've received a counter-offer`;

  const text =
    userRole === 'musician'
      ? `${name} ${verb} sent a counter-offer for your gig at ${gigData.venue.venueName} on ${formattedDate}.`
      : `${gigData.venue.venueName} has sent you a counter-offer for the gig on ${formattedDate}.`;

  // === Styled shell (same as your finalized template) ===
  const dashboardUrlVenue = `${window.location.origin}/venues/dashboard/gigs`;
  const dashboardUrlMusician = `${window.location.origin}/dashboard`;
  const dashboardUrl = userRole === 'musician' ? dashboardUrlVenue : dashboardUrlMusician;

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

  // Leave path empty; you’ll drop in your own later
  const iconPath = 'M368.9 142.9c17.5 17.5 30.1 38 37.8 59.8c5.9 16.7 24.2 25.4 40.8 19.5s25.4-24.2 19.5-40.8c-10.8-30.6-28.4-59.3-52.9-83.7C327 10.5 185.9 10.1 98.3 96.6L56.7 55c-6.9-6.9-17.2-8.9-26.2-5.2s-14.8 12.5-14.8 22.2l0 128c0 13.3 10.7 24 24 24l8.4 0c0 0 0 0 0 0l119.5 0c9.7 0 18.5-5.8 22.2-14.8s1.7-19.3-5.2-26.2l-41.1-41.1c62.6-61.5 163.1-61.2 225.3 1zM495.8 312c0-13.3-10.7-24-24-24l-7.6 0-.7 0-119.6 0c-9.7 0-18.5 5.8-22.2 14.8s-1.7 19.3 5.2 26.2l41.1 41.1c-62.6 61.5-163.1 61.2-225.3-1c-17.5-17.5-30.1-38-37.8-59.8c-5.9-16.7-24.2-25.4-40.8-19.5s-25.4 24.2-19.5 40.8C55.3 361.3 73 390 97.4 414.4c87.2 87.2 228.3 87.5 315.8 1L454.8 457c6.9 6.9 17.2 8.9 26.2 5.2s14.8-12.5 14.8-22.2l0-119.6 0-.7 0-7.6z';
  const iconSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"
         width="28" height="28" role="img" aria-label="Icon"
         style="display:block;">
      <path d="${iconPath}" fill="#111827"></path>
    </svg>
  `;

  // Same logo URL style as your other templates
  const logoUrl = "https://firebasestorage.googleapis.com/v0/b/giginltd-dev.firebasestorage.app/o/gigin.png?alt=media&token=efd9ba79-f580-454c-98f6-b4a391e0d636";

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
                <a href="${dashboardUrl}"
                   style="display:inline-block;background:${baseStyles.btnBg};color:${baseStyles.btnText};text-decoration:none;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;padding:12px 18px;border-radius:10px;">
                  Respond to Offer
                </a>
                <div style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;color:${baseStyles.muted};margin-top:10px;">
                  Or paste this into your browser: ${dashboardUrl}
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

  // === Role-specific inner content (wording unchanged) ===
  const innerMusician = `
    <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      Hi ${venueProfile.accountName},
    </p>
    <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      <strong>${name}</strong> ${verb} sent a counter-offer for the following gig:
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
        <td style="padding:8px 0;border-top:1px solid ${baseStyles.border};"><strong>Proposed Fee:</strong> £${newFee}</td>
      </tr>
    </table>
    <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      Visit your <a href='${dashboardUrlVenue}' style="color:#111827;text-decoration:underline;">dashboard</a> to respond.
    </p>
    <p style="margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      Thanks,<br />The Gigin Team
    </p>
  `;

  const innerVenue = `
    <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      Hi ${name},
    </p>
    <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      <strong>${gigData.venue.venueName}</strong> has sent you a counter-offer for the following gig:
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
        <td style="padding:8px 0;border-top:1px solid ${baseStyles.border};"><strong>Proposed Fee:</strong> £${newFee}</td>
      </tr>
    </table>
    <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      Please visit your <a href='${dashboardUrlMusician}' style="color:#111827;text-decoration:underline;">dashboard</a> to accept or decline the new offer.
    </p>
    <p style="margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      Thanks,<br />The Gigin Team
    </p>
  `;

  const title = `You've received a counter-offer`;
  const inner = userRole === 'musician' ? innerMusician : innerVenue;
  const html = htmlBase(title, inner);

  await addDoc(mailRef, {
    to,
    message: { subject, text, html },
  });
};

/**
 * Sends a styled email to the venue when a musician accepts an invitation.
 *
 * Mirrors the wording from the original front-end snippet, but wrapped
 * in the standardized HTML shell used across your other emails.
 *
 * @param {Object} params
 * @param {string} params.venueEmail - Recipient venue email address.
 * @param {string} params.musicianName - Musician/band name.
 * @param {Object} params.venueProfile - Venue profile (must include `accountName`).
 * @param {Object} params.gigData - Gig object (must include `date` and `venue.venueName`).
 * @param {string|number} params.agreedFee - Agreed fee.
 * @param {boolean} [params.nonPayableGig=false] - If true, no payment required to confirm.
 * @param {string} [params.baseUrl] - Absolute origin (e.g. https://app.gigin.com). If omitted, uses window.origin in browser.
 * @returns {Promise<void>}
 */
export const sendInvitationAcceptedEmailToVenue = async ({
  venueEmail,
  musicianName,
  venueProfile,
  gigData,
  agreedFee,
  nonPayableGig = false,
  baseUrl,
}) => {
  const origin =
    baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const subject = `${musicianName} Has Accepted Your Invitation!`;
  const text = `Congratulations! Your invitation sent to ${musicianName} for the gig at ${gigData.venue.venueName} on ${formatDate(
    gigData.date
  )} has been accepted.`;

  // === Styled shell (same as your finalized template) ===
  const dashboardUrl = `${origin}/venues/dashboard/gigs`;

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

  // Leave icon path empty for now; you can drop your own later
  const iconPath = 'M48 64C21.5 64 0 85.5 0 112c0 15.1 7.1 29.3 19.2 38.4L236.8 313.6c11.4 8.5 27 8.5 38.4 0L492.8 150.4c12.1-9.1 19.2-23.3 19.2-38.4c0-26.5-21.5-48-48-48L48 64zM0 176L0 384c0 35.3 28.7 64 64 64l384 0c35.3 0 64-28.7 64-64l0-208L294.4 339.2c-22.8 17.1-54 17.1-76.8 0L0 176z';
  const iconSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"
         width="28" height="28" role="img" aria-label="Icon"
         style="display:block;">
      <path d="${iconPath}" fill="#111827"></path>
    </svg>
  `;

  // Use your existing hosted logo URL/CDN
  const logoUrl = "https://firebasestorage.googleapis.com/v0/b/giginltd-dev.firebasestorage.app/o/gigin.png?alt=media&token=efd9ba79-f580-454c-98f6-b4a391e0d636";

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
                <a href="${dashboardUrl}"
                   style="display:inline-block;background:${baseStyles.btnBg};color:${baseStyles.btnText};text-decoration:none;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;padding:12px 18px;border-radius:10px;">
                  Open Dashboard
                </a>
                <div style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;color:${baseStyles.muted};margin-top:10px;">
                  Or paste this into your browser: ${dashboardUrl}
                </div>
              </td>
            </tr>

          </table>
          <div style="max-width:600px;margin-top:16px;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;color:${baseStyles.muted};">
            You’re receiving this because you have a venue on Gigin.
          </div>
        </td>
      </tr>
    </table>
  `;

  // === Inner content (wording unchanged) ===
  const inner = `
    <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      Hi ${venueProfile.accountName},
    </p>
    <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      We're excited to inform you that your invitation for the following gig has been accepted:
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
      style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;color:${baseStyles.text};margin:0 0 16px 0;">
      <tr>
        <td style="padding:8px 0;border-top:1px solid ${baseStyles.border};"><strong>Musician:</strong> ${musicianName}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;border-top:1px solid ${baseStyles.border};"><strong>Date:</strong> ${formatDate(gigData.date)}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;border-top:1px solid ${baseStyles.border};"><strong>Fee:</strong> ${agreedFee}</td>
      </tr>
    </table>
    <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      ${
        nonPayableGig
          ? 'This gig is already confirmed — no payment is required.'
          : 'The gig will be confirmed once you have paid the gig fee.'
      }
    </p>
    <p style="margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      Please visit your <a href='${dashboardUrl}' style="color:#111827;text-decoration:underline;">dashboard</a> to see the status of the gig.
    </p>
    <p style="margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      Thanks,<br />The Gigin Team
    </p>
  `;

  const html = htmlBase(subject, inner);

  const mailRef = collection(firestore, 'mail');
  await addDoc(mailRef, {
    to: venueEmail,
    message: { subject, text, html },
  });
};

/**
 * Sends a styled invitation email to join a band on Gigin.
 *
 * Uses the Firebase "Trigger Email" extension by writing a document to the `mail` collection.
 * Text content matches the original front-end implementation, wrapped in the standardized HTML shell.
 *
 * @async
 * @function sendBandInviteEmail
 * @param {Object} params
 * @param {string} params.to - Recipient email address.
 * @param {Object} params.band - Band object (must include `name`).
 * @param {string} params.link - Absolute URL to accept/join the band.
 * @param {string} [params.baseUrl] - Optional absolute origin (e.g. "https://app.gigin.com") for fallbacks/logos if needed.
 * @returns {Promise<void>}
 *
 * @example
 * await sendBandInviteEmail({
 *   to: 'artist@example.com',
 *   band: { name: 'Neon Owls' },
 *   link: 'https://app.gigin.com/join?code=abc123'
 * });
 */
export const sendBandInviteEmail = async ({ to, band, link, baseUrl }) => {
  const subject = `You're invited to join ${band.name} on Gigin`;
  const text = `You've been invited to join ${band.name} on Gigin. Click the link below to join:\n\n${link}`;

  // === Styled email shell (same as your other templates) ===
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

  // Icon placeholder (drop your own path if you want an icon)
  const iconPath = 'M48 64C21.5 64 0 85.5 0 112c0 15.1 7.1 29.3 19.2 38.4L236.8 313.6c11.4 8.5 27 8.5 38.4 0L492.8 150.4c12.1-9.1 19.2-23.3 19.2-38.4c0-26.5-21.5-48-48-48L48 64zM0 176L0 384c0 35.3 28.7 64 64 64l384 0c35.3 0 64-28.7 64-64l0-208L294.4 339.2c-22.8 17.1-54 17.1-76.8 0L0 176z';
  const iconSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"
         width="28" height="28" role="img" aria-label="Icon"
         style="display:block;">
      <path d="${iconPath}" fill="#111827"></path>
    </svg>
  `;

  // Use your existing hosted logo/CDN (replace if you’ve moved to Vercel Hosting)
  const logoUrl = "https://firebasestorage.googleapis.com/v0/b/giginltd-dev.firebasestorage.app/o/gigin.png?alt=media&token=efd9ba79-f580-454c-98f6-b4a391e0d636";

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
                <a href="${link}"
                   style="display:inline-block;background:${baseStyles.btnBg};color:${baseStyles.btnText};text-decoration:none;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;padding:12px 18px;border-radius:10px;">
                  Join Band
                </a>
                <div style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;color:${baseStyles.muted};margin-top:10px;word-break:break-all;">
                  Or paste this into your browser: ${link}
                </div>
              </td>
            </tr>
          </table>

          <div style="max-width:600px;margin-top:16px;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;color:${baseStyles.muted};">
            You’re receiving this because someone invited you to join a band on Gigin.
          </div>
        </td>
      </tr>
    </table>
  `;

  // === Inner content (wording unchanged) ===
  const inner = `
    <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      You've been invited to join <strong>${band.name}</strong> on Gigin.
    </p>
    <p style="margin:0 0 16px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      <a href="${link}" style="color:#111827;text-decoration:underline;">Click here to join the band</a>
    </p>
  `;

  const html = htmlBase(`You're invited to join ${band.name} on Gigin`, inner);

  // Queue the email for the Trigger Email extension
  const mailRef = collection(firestore, 'mail');
  await addDoc(mailRef, {
    to,
    message: { subject, text, html },
  });
};

/**
 * Sends a styled invitation email to join a venue on Gigin.
 *
 * Uses the Firebase "Trigger Email" extension by writing a document to the `mail` collection.
 * Text content matches the original front-end implementation, wrapped in the standardized HTML shell.
 *
 * @async
 * @function sendVenueInviteEmail
 * @param {Object} params
 * @param {string} params.to - Recipient email address.
 * @param {Object} params.band - Venue object (must include `name`).
 * @param {string} params.link - Absolute URL to accept/join the venue.
 * @param {string} [params.baseUrl] - Optional absolute origin (e.g. "https://app.gigin.com") for fallbacks/logos if needed.
 * @returns {Promise<void>}
 *
 * @example
 * await sendVenueInviteEmail({
 *   to: 'staff@example.com',
 *   venue: { name: 'The White Lion' },
 *   link: 'https://app.gigin.com/venues/join-venue?invite=abc123'
 * });
 */
export const sendVenueInviteEmail = async ({ to, venue, link, baseUrl }) => {
  const subject = `You're invited to join ${venue.name} on Gigin`;
  const text = `You've been invited to join ${venue.name} on Gigin. Click the link below to join:\n\n${link}`;

  // === Styled email shell (same as your other templates) ===
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

  // Icon placeholder (drop your own path if you want an icon)
  const iconPath = 'M48 64C21.5 64 0 85.5 0 112c0 15.1 7.1 29.3 19.2 38.4L236.8 313.6c11.4 8.5 27 8.5 38.4 0L492.8 150.4c12.1-9.1 19.2-23.3 19.2-38.4c0-26.5-21.5-48-48-48L48 64zM0 176L0 384c0 35.3 28.7 64 64 64l384 0c35.3 0 64-28.7 64-64l0-208L294.4 339.2c-22.8 17.1-54 17.1-76.8 0L0 176z';
  const iconSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"
         width="28" height="28" role="img" aria-label="Icon"
         style="display:block;">
      <path d="${iconPath}" fill="#111827"></path>
    </svg>
  `;

  // Use your existing hosted logo/CDN (replace if you’ve moved to Vercel Hosting)
  const logoUrl = "https://firebasestorage.googleapis.com/v0/b/giginltd-dev.firebasestorage.app/o/gigin.png?alt=media&token=efd9ba79-f580-454c-98f6-b4a391e0d636";

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
                <a href="${link}"
                   style="display:inline-block;background:${baseStyles.btnBg};color:${baseStyles.btnText};text-decoration:none;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;padding:12px 18px;border-radius:10px;">
                  Join Venue
                </a>
                <div style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;color:${baseStyles.muted};margin-top:10px;word-break:break-all;">
                  Or paste this into your browser: ${link}
                </div>
              </td>
            </tr>
          </table>

          <div style="max-width:600px;margin-top:16px;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;color:${baseStyles.muted};">
            You’re receiving this because someone invited you to join a venue on Gigin.
          </div>
        </td>
      </tr>
    </table>
  `;

  // === Inner content (wording unchanged) ===
  const inner = `
    <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      You've been invited to join <strong>${venue.name}</strong> on Gigin.
    </p>
    <p style="margin:0 0 16px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      <a href="${link}" style="color:#111827;text-decoration:underline;">Click here to join the venue</a>
    </p>
  `;

  const html = htmlBase(`You're invited to join ${venue.name} on Gigin`, inner);

  // Queue the email for the Trigger Email extension
  const mailRef = collection(firestore, 'mail');
  await addDoc(mailRef, {
    to,
    message: { subject, text, html },
  });
};


/**
 * Sends a styled testimonial request email.
 *
 * Uses the Firebase "Trigger Email" extension by writing a document to the `mail` collection.
 * Text content matches the original front-end implementation; only presentation is upgraded.
 *
 * @async
 * @function sendTestimonialRequestEmail
 * @param {Object} params
 * @param {string} params.to - Recipient email address.
 * @param {string} params.musicianId - Musician UID to include in the testimonial link.
 * @param {string} params.musicianName - Musician display name.
 * @param {string} [params.baseUrl="https://giginmusic.com"] - Base URL for the testimonial page (e.g. your production domain).
 * @returns {Promise<void>}
 *
 * @example
 * await sendTestimonialRequestEmail({
 *   to: 'friend@example.com',
 *   musicianId: 'abc123',
 *   musicianName: 'Neon Owls',
 *   baseUrl: 'https://giginmusic.com'
 * });
 */
export const sendTestimonialRequestEmail = async ({
  to,
  musicianId,
  musicianName,
  baseUrl = 'https://giginmusic.com',
}) => {
  const subject = `Gigin Testimonial Request From ${musicianName}`;
  const link = `${baseUrl}/testimonials?musicianId=${encodeURIComponent(
    musicianId
  )}&musicianName=${encodeURIComponent(musicianName)}`;

  const text = `${musicianName} has asked if you could provide a testimonial for them on Gigin.\n\nYou can provide your testimonial by clicking the link below:\n${link}`;

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

  // Icon placeholder (drop in your path later if you want an icon)
  const iconPath = 'M438.1 32.2c4.5-12.5-1.9-26.2-14.3-30.8S397.5 3.3 393 15.8l-4.6 12.7L328.7 6.7c-12.5-4.5-26.2 1.9-30.8 14.3L259.6 126.3c-4.5 12.5 1.9 26.2 14.3 30.8l59.7 21.7-15.4 42.4-28.8-10.8c-9.7-3.7-18.4-9.6-25.4-17.4L235 160.2c-18.2-20.5-44.3-32.2-71.8-32.2l-27.7 0c-36.4 0-69.6 20.5-85.9 53.1L3.4 273.7c-7.9 15.8-1.5 35 14.3 42.9s35 1.5 42.9-14.3L80 263.6 80 480c0 17.7 14.3 32 32 32s32-14.3 32-32l0-128 20.2 0L192 407.6l0 72.4c0 17.7 14.3 32 32 32s32-14.3 32-32l0-72.4c0-9.9-2.3-19.7-6.8-28.6L216 312.4l0-77.3 .3 .3C230.1 251 247.5 263 267 270.3l29.3 11L289 301.5c-4.5 12.5 1.9 26.2 14.3 30.8s26.2-1.9 30.8-14.3l44.6-122.6 60.6 22c12.5 4.5 26.2-1.9 30.8-14.3L508.4 97.7c4.5-12.5-1.9-26.2-14.3-30.8l-60.6-22 4.6-12.7zM192 48A48 48 0 1 0 96 48a48 48 0 1 0 96 0z';
  const iconSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"
         width="28" height="28" role="img" aria-label="Icon"
         style="display:block;">
      <path d="${iconPath}" fill="#111827"></path>
    </svg>
  `;

  // Use your existing hosted logo URL/CDN
  const logoUrl = "https://firebasestorage.googleapis.com/v0/b/giginltd-dev.firebasestorage.app/o/gigin.png?alt=media&token=efd9ba79-f580-454c-98f6-b4a391e0d636";

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
                <a href="${link}"
                   style="display:inline-block;background:${baseStyles.btnBg};color:${baseStyles.btnText};text-decoration:none;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;padding:12px 18px;border-radius:10px;">
                  Provide Testimonial
                </a>
                <div style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;color:${baseStyles.muted};margin-top:10px;word-break:break-all;">
                  Or paste this into your browser: ${link}
                </div>
              </td>
            </tr>
          </table>

          <div style="max-width:600px;margin-top:16px;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;color:${baseStyles.muted};">
            You’re receiving this because someone requested a testimonial on Gigin.
          </div>
        </td>
      </tr>
    </table>
  `;

  // === Inner content (wording unchanged) ===
  const inner = `
    <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      ${musicianName} has asked if you could provide a testimonial for them on Gigin.
    </p>
    <p style="margin:0 0 16px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      You can provide your testimonial by clicking the link below:
    </p>
    <p style="margin:0 0 0 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;">
      <a href="${link}" style="color:#111827;text-decoration:underline;">Provide Testimonial</a>
    </p>
  `;

  const html = htmlBase(`Gigin Testimonial Request From ${musicianName}`, inner);

  // Queue the email for the Trigger Email extension
  const mailRef = collection(firestore, 'mail');
  await addDoc(mailRef, {
    to,
    message: { subject, text, html },
  });
};


/**
 * Sends a styled email to a musician when a venue logs a dispute.
 *
 * Uses the Firebase "Trigger Email" extension by writing a document to the `mail` collection.
 * The text content matches the original front-end snippet, wrapped in the standardized email shell.
 *
 * @async
 * @function sendDisputeLoggedEmail
 * @param {Object} params
 * @param {Object} params.musicianProfile - Musician profile (must include `email`).
 * @param {Object} params.gigData - Gig object (must include `date` and `venue.venueName`).
 * @param {string} [params.baseUrl] - Optional base origin (e.g. "https://app.gigin.com") for dashboard links.
 * @returns {Promise<void>}
 *
 * @example
 * await sendDisputeLoggedEmail({
 *   musicianProfile: { email: 'artist@example.com' },
 *   gigData: { date: '2025-08-25', venue: { venueName: 'The Roundhouse' } },
 *   baseUrl: 'https://app.gigin.com'
 * });
 */
export const sendDisputeLoggedEmail = async ({ musicianProfile, gigData, baseUrl }) => {
  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const subject = 'Dispute Logged';
  const text = `The venue ${gigData.venue.venueName} has reported your performance at the gig on ${formatDate(
    gigData.date
  )}. We have withheld the gig fee until the dispute is resolved. We will be in touch shortly.`;

  // === Styled shell (same as your other templates) ===
  const dashboardUrl = baseUrl
    ? `${baseUrl}/dashboard`
    : typeof window !== 'undefined'
    ? `${window.location.origin}/dashboard`
    : '';

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

  // Leave icon path empty for now; you can set your own later
  const iconPath = 'M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm0-384c13.3 0 24 10.7 24 24l0 112c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-112c0-13.3 10.7-24 24-24zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z';
  const iconSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"
         width="28" height="28" role="img" aria-label="Icon"
         style="display:block;">
      <path d="${iconPath}" fill="#111827"></path>
    </svg>
  `;

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
                <a href="${dashboardUrl}"
                   style="display:inline-block;background:${baseStyles.btnBg};color:${baseStyles.btnText};text-decoration:none;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;padding:12px 18px;border-radius:10px;">
                  View Dashboard
                </a>
                <div style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;color:${baseStyles.muted};margin-top:10px;">
                  Or paste this into your browser: ${dashboardUrl}
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
      The venue <strong>${gigData.venue.venueName}</strong> has reported your performance at the gig on ${formatDate(
    gigData.date
  )}.
    </p>
    <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      We have withheld the gig fee until the dispute is resolved.
    </p>
    <p style="margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      We will be in touch shortly.
    </p>
  `;

  const html = htmlBase(subject, inner);

  const mailRef = collection(firestore, 'mail');
  await addDoc(mailRef, {
    to: musicianProfile.email,
    message: { subject, text, html },
  });
};

/**
 * Sends a styled confirmation email to the venue when they log a dispute.
 *
 * Uses the Firebase "Trigger Email" extension by writing a document to the `mail` collection.
 *
 * @async
 * @function sendVenueDisputeLoggedEmail
 * @param {Object} params
 * @param {Object} params.venueProfile - Venue profile (must include `email` and `accountName`).
 * @param {Object} params.musicianProfile - Musician profile (must include `name`).
 * @param {Object} params.gigData - Gig object (must include `date` and `venue.venueName`).
 * @param {string} [params.baseUrl] - Optional base origin (e.g. "https://app.gigin.com") for dashboard links.
 * @returns {Promise<void>}
 *
 * @example
 * await sendVenueDisputeLoggedEmail({
 *   venueProfile: { email: 'venue@example.com', accountName: 'The Roundhouse' },
 *   musicianProfile: { name: 'Neon Owls' },
 *   gigData: { date: '2025-08-25', venue: { venueName: 'The Roundhouse' } },
 *   baseUrl: 'https://app.gigin.com'
 * });
 */
export const sendVenueDisputeLoggedEmail = async ({
  venueProfile,
  musicianProfile,
  gigData,
  baseUrl,
}) => {
  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const subject = 'Your Dispute Has Been Logged';
  const text = `Hi ${venueProfile.accountName},
We’ve received your report regarding ${musicianProfile.name} for the gig at ${gigData.venue.venueName} on ${formatDate(
    gigData.date
  )}. We’ve recorded the dispute and our team will review it and be in touch. Any payout related to this gig may be temporarily withheld until the dispute is resolved.`;

  // === Styled shell (same as your other templates) ===
  const dashboardUrl = baseUrl
    ? `${baseUrl}/venues/dashboard/gigs`
    : typeof window !== 'undefined'
    ? `${window.location.origin}/venues/dashboard/gigs`
    : '';

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

  // Icon placeholder (set your own path later if desired)
  const iconPath = 'M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm0-384c13.3 0 24 10.7 24 24l0 112c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-112c0-13.3 10.7-24 24-24zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z';
  const iconSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"
         width="28" height="28" role="img" aria-label="Icon"
         style="display:block;">
      <path d="${iconPath}" fill="#111827"></path>
    </svg>
  `;

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
                <a href="${dashboardUrl}"
                   style="display:inline-block;background:${baseStyles.btnBg};color:${baseStyles.btnText};text-decoration:none;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;padding:12px 18px;border-radius:10px;">
                  View Dispute
                </a>
                <div style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;color:${baseStyles.muted};margin-top:10px;">
                  Or paste this into your browser: ${dashboardUrl}
                </div>
              </td>
            </tr>
          </table>

          <div style="max-width:600px;margin-top:16px;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;color:${baseStyles.muted};">
            You’re receiving this because you manage a venue on Gigin.
          </div>
        </td>
      </tr>
    </table>
  `;

  // === Inner content ===
  const inner = `
    <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      Hi ${venueProfile.accountName},
    </p>
    <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      We’ve received your report regarding <strong>${musicianProfile.name}</strong> for the gig at ${gigData.venue.venueName} on ${formatDate(
    gigData.date
  )}. Our team will review the details and be in touch shortly.
    </p>
    <p style="margin:0 0 12px 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      Any payout related to this gig may be temporarily withheld until the dispute is resolved.
    </p>
    <p style="margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:22px;color:${baseStyles.text}">
      You can track updates on your dashboard.
    </p>
  `;

  const html = htmlBase(subject, inner);

  const mailRef = collection(firestore, 'mail');
  await addDoc(mailRef, {
    to: venueProfile.email,
    message: { subject, text, html },
  });
};