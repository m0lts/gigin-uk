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

const html = isBand
  ? `
    <p><strong>${musicianName}</strong> have applied to your gig:</p>
    <ul>
      <li><strong>Date:</strong> ${date}</li>
      <li><strong>Venue:</strong> ${venueName}</li>
      ${!nonPayableGig ? `<li><strong>Proposed Fee:</strong> ${budget}</li>` : ''}
    </ul>
    <p>Visit your <a href='${window.location.origin}/venues/dashboard'>dashboard</a> to review this application.</p>
  `
  : `
    <p><strong>${musicianName}</strong> has applied to your gig:</p>
    <ul>
      <li><strong>Date:</strong> ${date}</li>
      <li><strong>Venue:</strong> ${venueName}</li>
      ${!nonPayableGig ? `<li><strong>Proposed Fee:</strong> ${budget}</li>` : ''}
    </ul>
    <p>Visit your <a href='${window.location.origin}/venues/dashboard'>dashboard</a> to review this application.</p>
  `;

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