// const {onTaskDispatched} = require("firebase-functions/v2/tasks");


// exports.clearPendingFee = onTaskDispatched(
//   { secrets: [stripeTestKey] },
//   async (event) => {
//     console.log("Task payload received:", event.data);
//     const { musicianId, gigId, amount, disputeClearingTime, venueId, gigDate, gigTime } = event.data;

//     // Validate payload
//     if (!musicianId || !gigId || !disputeClearingTime || !venueId || !gigDate || !gigTime || !amount) {
//       console.error("Invalid payload received in task.");
//       throw new Error("Invalid payload received.");
//     }

//     const stripe = new Stripe(stripeTestKey.value());
//     try {
//       const firestore = getFirestore();
//       const musicianProfileRef = firestore.collection("musicianProfiles").doc(musicianId);
//       const musicianDoc = await musicianProfileRef.get();

//       // Validate musician profile
//       if (!musicianDoc.exists) {
//         throw new Error(`Musician with ID ${musicianId} not found.`);
//       }

//       const musicianData = musicianDoc.data();
//       const stripeAccountId = musicianData.stripeAccountId;
//       const pendingFees = musicianData.pendingFees || [];
//       const clearedFee = pendingFees.find((fee) => fee.gigId === gigId);

//       // Validate pending fees
//       if (!clearedFee) {
//         console.log(`Fee for gig ${gigId} already cleared or not found.`);
//         return;
//       }

//       const gigRef = firestore.collection("gigs").doc(gigId);
//       const gigDoc = await gigRef.get();

//       // Validate gig data
//       if (!gigDoc.exists) {
//         console.log(`Gig ${gigId} not found.`);
//         return;
//       }

//       const gigData = gigDoc.data();
//       if (clearedFee.disputeLogged || gigData.disputeLogged) {
//         console.log(`Dispute logged for gig ${gigId}`);
//         return;
//       }

//       let stripeTransferId = null;

//       // If Stripe account exists, perform transfer
//       if (stripeAccountId) {
//         const transfer = await stripe.transfers.create({
//           amount: Math.round(amount * 100),
//           currency: "gbp",
//           destination: stripeAccountId,
//           metadata: {
//             musicianId,
//             gigId,
//             description: "Gig fee transferred after dispute period cleared",
//           },
//         });
//         console.log(`Stripe transfer successful: ${transfer.id}`);
//         stripeTransferId = transfer.id;
//       } else {
//         console.log(`Musician ${musicianId} has no Stripe account. Skipping transfer.`);
//       }

//       // Update Firestore with cleared fee and musician data
//       await gigRef.update({
//         musicianFeeStatus: "cleared",
//       });

//       const updatedPendingFees = pendingFees.filter((fee) => fee.gigId !== gigId);
//       const clearedFees = musicianData.clearedFees || [];
//       const updatedClearedFees = [
//         ...clearedFees,
//         {...clearedFee,feeCleared: true, status: "cleared", stripeTransferId},
//       ];
//       const totalEarnings = (musicianData.totalEarnings || 0) + amount;
//       const withdrawableEarnings =
//       (musicianData.withdrawableEarnings || 0) + amount;

//       await musicianProfileRef.update({
//         pendingFees: updatedPendingFees,
//         clearedFees: updatedClearedFees,
//         totalEarnings: totalEarnings,
//         withdrawableEarnings: withdrawableEarnings,
//       });

//       console.log(`Fee cleared for musician ${musicianId}, gig ${gigId}.`);
//     } catch (error) {
//       console.error("Error clearing fee:", error);
//       throw new Error("Failed to clear pending fee.");
//     }
//   }
// );