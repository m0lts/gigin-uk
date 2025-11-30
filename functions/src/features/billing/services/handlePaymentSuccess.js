/* eslint-disable */
// src/features/billing/services/handlePaymentSuccess.js
import { admin, FieldValue, Timestamp } from "../../../lib/admin.js";
import { createCloudTask, getFunctionUrl } from "../../../lib/tasks.js";
import { generateCalendarLink } from "../../../lib/utils/calendar.js";
import { gigConfirmedEmail } from "../../../lib/utils/emails.js";
import { IS_PROD, IS_EMULATOR } from "../../../config/env.js";

/**
 * Handles post-payment success side effects:
 * - Updates gig + applicants
 * - Schedules fee clearing + automatic review messages (Cloud Tasks)
 * - Creates/updates pending fee docs
 * - Closes conversations and posts announcements
 * - Sends “gig confirmed” email with calendar link
 *
 * @function handlePaymentSuccess
 * @param {import("stripe").Stripe.PaymentIntent} paymentIntent
 * @returns {Promise<void>}
 */
export const handlePaymentSuccess = async (paymentIntent) => {
  const gigId = paymentIntent.metadata.gigId;
  const applicantId = paymentIntent.metadata.applicantId;
  const recipientMusicianId = paymentIntent.metadata.recipientMusicianId;
  const venueId = paymentIntent.metadata.venueId;
  const gigTime = paymentIntent.metadata.time;
  const gigDate = paymentIntent.metadata.date;
  const paymentIntentId = paymentIntent.id;
  const formattedGigDate = new Date(gigDate);
  const [hours, minutes] = gigTime.split(":").map(Number);
  formattedGigDate.setHours(hours);
  formattedGigDate.setMinutes(minutes);
  formattedGigDate.setSeconds(0);
  const disputeHours = IS_PROD ? 48 : 10 / 60; // 48 hours in prod, 10 minutes in dev/emulator
  const disputePeriodDate = new Date(
    formattedGigDate.getTime() + disputeHours * 60 * 60 * 1000
  );
  const maxAllowedDate = new Date(Date.now() + 720 * 60 * 60 * 1000);
  const gigStartDate =
  new Date(formattedGigDate.getTime());
  if (!gigId || !applicantId || !recipientMusicianId || !venueId) {
    console.error("Missing required metadata in paymentIntent");
    return;
  }
  try {
    const timestamp = Timestamp.now();
    const gigRef = admin.firestore().collection("gigs").doc(gigId);
    const gigDoc = await gigRef.get();
    if (!gigDoc.exists) {
      throw new Error(`Gig with ID ${gigId} not found`);
    }
    const gigData = gigDoc.data();
    const feeAmount = (() => {
      const raw = typeof gigData.agreedFee === "string" ?
        gigData.agreedFee.replace("£", "").trim() :
        gigData.agreedFee;
      const n = Number(raw);
      return Math.round(n * 1 * 100) / 100;
    })();
    const updatedApplicants = (gigData.applicants || []).map((a) =>
      a.id === applicantId ? {...a, status: "confirmed"} : {...a},
    );
    const venueName = gigData.venue.venueName;
    const payoutConfig = gigData.payoutConfig || null;
    
    // Try to fetch from artistProfiles first, then fall back to musicianProfiles
    let musicianProfileRef = admin.firestore()
        .collection("artistProfiles").doc(recipientMusicianId);
    let musicianProfileSnap = await musicianProfileRef.get();
    let musicianProfile = musicianProfileSnap.exists ? musicianProfileSnap.data() : null;
    let isArtistProfile = !!musicianProfile;
    
    if (!musicianProfile) {
      musicianProfileRef = admin.firestore()
          .collection("musicianProfiles").doc(recipientMusicianId);
      musicianProfileSnap = await musicianProfileRef.get();
      musicianProfile = musicianProfileSnap.exists ? musicianProfileSnap.data() : null;
    }
    
    if (!musicianProfile) {
      throw new Error(`Profile with ID ${recipientMusicianId} not found in artistProfiles or musicianProfiles`);
    }
    
    // For artist profiles, fetch email from user document if not present
    let musicianEmail = musicianProfile.email;
    if (isArtistProfile && !musicianEmail && musicianProfile.userId) {
      try {
        const userRef = admin.firestore().collection("users").doc(musicianProfile.userId);
        const userSnap = await userRef.get();
        if (userSnap.exists) {
          musicianEmail = userSnap.data().email;
        }
      } catch (error) {
        console.error("Error fetching user email:", error);
      }
    }
    
    if (!musicianEmail) {
      throw new Error(`Email not found for profile ${recipientMusicianId}`);
    }
    
    const musicianName = musicianProfile.name;
    const venueProfileRef = admin.firestore()
        .collection("venueProfiles").doc(venueId);
    const venueProfileSnap = await venueProfileRef.get();
    const venueProfile = venueProfileSnap.data();
    const venueEmail = venueProfile.email;
    const gigFeePayload = {
      musicianId: recipientMusicianId,
      applicantId,
      gigId,
      venueId,
      gigDate,
      gigTime,
      amount: feeAmount,
      disputeClearingTime:
        Timestamp.fromDate(disputePeriodDate).toMillis(),
      musicianEmail,
      musicianName,
      venueName,
      paymentIntentId: paymentIntentId,
    };
    const automaticMessagePayload = {
      musicianId: recipientMusicianId,
      applicantId,
      gigId,
      venueId,
      gigDate,
      gigTime,
      amount: feeAmount,
      disputeClearingTime:
        Timestamp.fromDate(disputePeriodDate).toMillis(),
      paymentIntentId,
      musicianName,
      musicianEmail,
      venueEmail,
      venueName,
    };
    const targetUriForFee =
    await getFunctionUrl("clearPendingFee");
    const intermediateQueueUri =
    await getFunctionUrl("intermediateTaskQueue");
    const intermediateMessageUri =
    await getFunctionUrl("intermediateMessageQueue");
    const targetUriForMessage =
    await getFunctionUrl("automaticReviewMessage");
    let feeTaskName;
    let messageTaskName;
    
    // In emulator mode, skip Cloud Tasks and call functions directly after delay
    if (IS_EMULATOR) {
      console.log(`[EMULATOR MODE] Skipping Cloud Tasks. Fee will clear after ${disputeHours} hour(s).`);
      console.log(`[EMULATOR MODE] To test fee clearing, manually call clearPendingFee endpoint with payload:`, JSON.stringify(gigFeePayload, null, 2));
      feeTaskName = "emulator-skip";
      messageTaskName = "emulator-skip";
    } else if (disputePeriodDate > maxAllowedDate) {
      feeTaskName = await createCloudTask(
          gigFeePayload,
          maxAllowedDate,
          intermediateQueueUri,
          "intermediateTaskQueue",
      );
      console.log(
          `Enqueued intermediate fee task for ${maxAllowedDate.toISOString()}`,
      );
      messageTaskName =
      await createCloudTask(
          automaticMessagePayload,
          maxAllowedDate,
          intermediateMessageUri,
          "intermediateMessageQueue",
      );
      console.log(
          `Enqueued intermediate msg task for ${maxAllowedDate.toISOString()}`,
      );
    } else {
      feeTaskName = await createCloudTask(
          gigFeePayload,
          disputePeriodDate,
          targetUriForFee,
          "clearPendingFee",
      );
      console.log(`Enqueued fee task for ${disputePeriodDate.toISOString()}`);
      messageTaskName =
      await createCloudTask(
          automaticMessagePayload,
          gigStartDate,
          targetUriForMessage,
          "automaticReviewMessage",
      );
      console.log(
          `Enqueued message task for ${disputePeriodDate.toISOString()}`,
      );
    }
    await gigRef.update({
      applicants: updatedApplicants,
      paymentIntentId: paymentIntentId,
      status: "closed",
      paid: true,
      paymentStatus: "succeeded",
      musicianFeeStatus: "pending",
      disputeClearingTime: disputePeriodDate,
      disputeLogged: false,
      clearPendingFeeTaskName: feeTaskName,
      automaticMessageTaskName: messageTaskName,
    });
    // Create pending fee document on artistProfile (stays artist-focused)
    const collectionName = isArtistProfile ? "artistProfiles" : "musicianProfiles";
    const pendingFeeDocRef = admin
        .firestore()
        .collection(collectionName)
        .doc(recipientMusicianId)
        .collection("pendingFees")
        .doc(paymentIntentId);
    const existing = await pendingFeeDocRef.get();
    
    const batch = admin.firestore().batch();
    
    if (!existing.exists) {
      // Create pending fee document on artistProfile
      batch.set(pendingFeeDocRef, {
        paymentIntentId,
        gigId,
        venueId,
        amount: feeAmount,
        currency: paymentIntent.currency || "gbp",
        timestamp,
        gigDate,
        gigTime,
        disputeClearingTime: Timestamp.fromDate(disputePeriodDate),
        disputeLogged: false,
        disputeDetails: null,
        status: "pending",
        feeCleared: false,
        musicianName,
        musicianEmail,
        venueName,
      });
      
      // Update user documents with pendingFunds based on payoutConfig
      if (payoutConfig && payoutConfig.shares && payoutConfig.shares.length > 0) {
        // New model: split pendingFunds across users
        const totalFee = payoutConfig.totalFee || feeAmount;
        for (const share of payoutConfig.shares) {
          const shareUserId = share.userId;
          const sharePercent = share.percent || 0;
          const shareAmount = Math.round((totalFee * sharePercent / 100) * 100) / 100;
          
          if (shareAmount > 0 && shareUserId) {
            const userRef = admin.firestore().collection("users").doc(shareUserId);
            batch.set(userRef, {
              pendingFunds: FieldValue.increment(shareAmount),
            }, { merge: true });
          }
        }
      } else {
        // Legacy model: single user
        if (userId) {
          const userRef = admin.firestore().collection("users").doc(userId);
          batch.set(userRef, {
            pendingFunds: FieldValue.increment(feeAmount),
          }, { merge: true });
        } else {
          // Fallback: update profile document (legacy)
          batch.set(musicianProfileRef, {
            pendingFunds: FieldValue.increment(feeAmount),
          }, { merge: true });
        }
      }
    }
    
    // Always update confirmedGigs
    batch.set(musicianProfileRef, {
      confirmedGigs: FieldValue.arrayUnion(gigId),
    }, { merge: true });
    
    await batch.commit();
    // Update conversations
    const conversationsRef = admin.firestore().collection("conversations");
    const conversationsSnapshot = await conversationsRef.where("gigId", "==", gigId).get();
    
    await Promise.all(
      conversationsSnapshot.docs.map(async (conversationDoc) => {
        const conversationId = conversationDoc.id;
        const conversationData = conversationDoc.data();
        const isVenueAndMusicianConversation =
          conversationData.participants.includes(venueId) &&
          conversationData.participants.includes(applicantId);
        const messagesRef = admin.firestore().collection("conversations")
            .doc(conversationId).collection("messages");
        
        if (isVenueAndMusicianConversation) {
          const awaitingPaymentQuery = messagesRef.where("status", "==", "awaiting payment");
          const awaitingPaymentSnapshot = await awaitingPaymentQuery.get();
          if (!awaitingPaymentSnapshot.empty) {
            const awaitingMessageId = awaitingPaymentSnapshot.docs[0].id;
            const awaitingMessageRef = messagesRef.doc(awaitingMessageId);
            await awaitingMessageRef.update({
              senderId: "system",
              text: `The fee of ${gigData.agreedFee} has been paid by the venue. The gig is now confirmed.`,
              timestamp: timestamp,
              type: "announcement",
              status: "gig confirmed",
            });
          }
          await admin.firestore().collection("conversations").doc(conversationId).update({
            lastMessage: `The fee of ${gigData.agreedFee} has been paid by the venue. The gig is now confirmed.`,
            lastMessageTimestamp: timestamp,
            lastMessageSenderId: "system",
            status: "closed",
          });
        } else {
          const pendingTypes = ["application", "invitation", "negotiation"];
          const convRef = admin.firestore().collection("conversations").doc(conversationId);
          const messagesRef = convRef.collection("messages");
          const batch = admin.firestore().batch();
          const pendingMessagesSnapshot = await messagesRef
              .where("type", "in", pendingTypes)
              .get();
          pendingMessagesSnapshot.forEach((docSnap) => {
            batch.update(docSnap.ref, {status: "apps-closed"});
          });
          const announcementRef = messagesRef.doc();
          batch.set(announcementRef, {
            senderId: "system",
            text: "The gig has been confirmed with another musician. Applications are now closed.",
            timestamp,
            type: "announcement",
            status: "gig booked",
          });
          batch.update(convRef, {
            lastMessage: "The gig has been confirmed with another musician. Applications are now closed.",
            lastMessageTimestamp: timestamp,
            lastMessageSenderId: "system",
            status: "closed",
          });
          await batch.commit();
        }
      })
    );

    // Send confirmation email with calendar link
    const calendarLink = generateCalendarLink({
      title: `Gig at ${gigData.venue.venueName}`,
      startTime: formattedGigDate.toISOString(),
      endTime: new Date(formattedGigDate.getTime() + gigData.duration * 60 * 1000).toISOString(),
      description: `Gig confirmed with fee: ${gigData.agreedFee}`,
      location: gigData.venue.address,
    });
    const mailRef = admin.firestore().collection("mail");
    const mailMessage = gigConfirmedEmail({
      musicianName,
      gigData,
      gigDate,
      gigTime,
      calendarLink,
    });
    await mailRef.add({
      to: musicianEmail,
      message: mailMessage,
    });
    console.log(
        `Gig ${gigId} updated successfully after payment confirmation.`,
    );
  } catch (error) {
    console.error("Error handling payment success:", error);
    throw new Error("Error updating gig and related data.");
  }
};