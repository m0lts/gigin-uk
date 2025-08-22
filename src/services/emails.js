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
import { NextGigIcon } from '../features/shared/ui/extras/Icons';
import { TextLogo } from '../features/shared/ui/logos/Logos';

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

  const dashboardUrl = `${window.location.origin}/venues/dashboard`;

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
export const sendNegotiationEmail = async ({ to, musicianName, venueName, oldFee, newFee, date, profileType }) => {
  const verb = profileType === 'band' ? 'have' : 'has';

  const mailRef = collection(firestore, 'mail');
  await addDoc(mailRef, {
      to,
      message: {
          subject: `New Negotiation Request`,
          text: `${musicianName} ${verb} proposed a new fee for your gig on ${date} at ${venueName}.`,
          html: `
              <p><strong>${musicianName}</strong> ${verb} proposed a new fee for your gig:</p>
              <ul>
                  <li><strong>Old Fee:</strong> ${oldFee}</li>
                  <li><strong>Proposed Fee:</strong> ${newFee}</li>
                  <li><strong>Date:</strong> ${date}</li>
                  <li><strong>Venue:</strong> ${venueName}</li>
              </ul>
              <p>Visit your <a href='${window.location.origin}/venues/dashboard'>dashboard</a> to review this negotiation.</p>
          `,
      },
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
  const noun = isBand ? 'band' : 'musician';

  const mailRef = collection(firestore, 'mail');

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

  const htmlMap = {
    musician: `
      <p>Hi ${venueProfile.accountName},</p>
      <p>We're excited to inform you that <strong>${musicianName}</strong> ${verb} accepted your ${isNegotiated ? 'negotiation' : 'invitation'} for the following gig:</p>
      <ul>
        <li><strong>Gig:</strong> ${gigData.venue.venueName}</li>
        <li><strong>Date:</strong> ${formattedDate}</li>
        <li><strong>Fee:</strong> ${agreedFee}</li>
      </ul>
      <p>${
        nonPayableGig
          ? 'This gig is now confirmed — no payment is required.'
          : 'The gig will be confirmed once you have paid the gig fee.'
      }</p>
      <p>Thanks,<br />The Gigin Team</p>
    `,

    venue: `
      <p>Hi ${musicianName},</p>
      <p>We're excited to inform you that your ${isNegotiated ? 'negotiation' : 'application'} for the following gig has been accepted:</p>
      <ul>
        <li><strong>Gig:</strong> ${gigData.venue.venueName}</li>
        <li><strong>Date:</strong> ${formattedDate}</li>
        <li><strong>Fee:</strong> ${agreedFee}</li>
      </ul>
      <p>${
        nonPayableGig
          ? 'This gig is already confirmed — no payment is required from the venue.'
          : 'The gig will be confirmed once the venue has paid the gig fee.'
      }</p>
      <p>Please visit your <a href='${window.location.origin}/dashboard'>dashboard</a> to see the status of the gig.</p>
      <p>Thanks,<br />The Gigin Team</p>
    `,
  };

  await addDoc(mailRef, {
    to: userRole === 'musician' ? venueProfile.email : musicianProfile.email,
    message: {
      subject: subjectMap[userRole],
      text: textMap[userRole],
      html: htmlMap[userRole],
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

  const htmlMap = {
    musician: {
      negotiation: `
        <p>Hi ${venueProfile.accountName},</p>
        <p><strong>${musicianName}</strong> ${verb} declined your negotiation for the following gig:</p>
        <ul>
          <li><strong>Gig:</strong> ${gigData.venue.venueName}</li>
          <li><strong>Date:</strong> ${formattedDate}</li>
        </ul>
        <p>Visit your <a href='${window.location.origin}/venues/dashboard'>dashboard</a> to propose a different offer.</p>
        <p>Thanks,<br />The Gigin Team</p>
      `,
      application: `
        <p>Hi ${venueProfile.accountName},</p>
        <p><strong>${musicianName}</strong> ${verb} declined your invitation for the following gig:</p>
        <ul>
          <li><strong>Gig:</strong> ${gigData.venue.venueName}</li>
          <li><strong>Date:</strong> ${formattedDate}</li>
        </ul>
        <p>Visit your <a href='${window.location.origin}/venues/dashboard'>dashboard</a> to find another musician.</p>
        <p>Thanks,<br />The Gigin Team</p>
      `,
    },
    venue: {
      negotiation: `
        <p>Hi ${musicianName},</p>
        <p>Unfortunately, your negotiation for the following gig has been declined:</p>
        <ul>
          <li><strong>Gig:</strong> ${gigData.venue.venueName}</li>
          <li><strong>Date:</strong> ${formattedDate}</li>
        </ul>
        <p>Please visit your <a href='${window.location.origin}/dashboard'>dashboard</a> to make another offer.</p>
        <p>Thanks,<br />The Gigin Team</p>
      `,
      application: `
        <p>Hi ${musicianName},</p>
        <p>Unfortunately, your application for the following gig has been declined:</p>
        <ul>
          <li><strong>Gig:</strong> ${gigData.venue.venueName}</li>
          <li><strong>Date:</strong> ${formattedDate}</li>
        </ul>
        <p>Please visit your <a href='${window.location.origin}/dashboard'>dashboard</a> to discover other gigs.</p>
        <p>Thanks,<br />The Gigin Team</p>
      `,
    },
  };

  await addDoc(mailRef, {
    to: userRole === 'musician' ? venueProfile.email : musicianProfile.email,
    message: {
      subject: subjectMap[userRole][declineType],
      text: textMap[userRole][declineType],
      html: htmlMap[userRole][declineType],
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

  const html =
    userRole === 'musician'
      ? `
        <p>Hi ${venueProfile.accountName},</p>
        <p><strong>${name}</strong> ${verb} sent a counter-offer for the following gig:</p>
        <ul>
          <li><strong>Gig:</strong> ${gigData.venue.venueName}</li>
          <li><strong>Date:</strong> ${formattedDate}</li>
          <li><strong>Proposed Fee:</strong> £${newFee}</li>
        </ul>
        <p>Visit your <a href='${window.location.origin}/venues/dashboard'>dashboard</a> to respond.</p>
        <p>Thanks,<br />The Gigin Team</p>
      `
      : `
        <p>Hi ${name},</p>
        <p><strong>${gigData.venue.venueName}</strong> has sent you a counter-offer for the following gig:</p>
        <ul>
          <li><strong>Gig:</strong> ${gigData.venue.venueName}</li>
          <li><strong>Date:</strong> ${formattedDate}</li>
          <li><strong>Proposed Fee:</strong> £${newFee}</li>
        </ul>
        <p>Please visit your <a href='${window.location.origin}/dashboard'>dashboard</a> to accept or decline the new offer.</p>
        <p>Thanks,<br />The Gigin Team</p>
      `;

  await addDoc(mailRef, {
    to,
    message: { subject, text, html },
  });
};