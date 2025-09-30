/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { db, Timestamp } from "../../../lib/admin.js";

/**
 * getOrCreateConversation (CF)
 * Direct port of client logic, plus writes `authorizedUserIds` for rules:
 * - If a conversation exists for (bandId|musicianId) + gigId, return it
 * - Otherwise assemble participants/accountNames and create a new doc
 *
 * Input:
 *   {
 *     musicianProfile: {
 *       musicianId: string,
 *       userId: string,
 *       name: string,
 *       picture?: string,
 *       bandProfile?: any // truthy if it's a band profile
 *     },
 *     gigData: {
 *       gigId: string,
 *       venueId: string,
 *       date: any,                // keep as-is (string or timestamp)
 *       venue: { venueName: string }
 *     },
 *     venueProfile: {
 *       accountName?: string,
 *       photos?: string[]
 *     },
 *     type?: 'application' | 'negotiation' | 'invitation' | 'dispute'
 *   }
 * Output:
 *   { conversationId: string }
 */
export const getOrCreateConversation = callable(
  { authRequired: true, enforceAppCheck: true },
  async (req) => {
    const { musicianProfile = {}, gigData = {}, venueProfile = {}, type = "application" } = req.data || {};
    const isBand = !!musicianProfile.bandProfile;
    const bandId = musicianProfile.musicianId;

    // Step 1: Check if conversation already exists
    const existingQ = await db
      .collection("conversations")
      .where("participants", "array-contains", bandId)
      .where("gigId", "==", gigData.gigId)
      .limit(1)
      .get();

    if (!existingQ.empty) {
      return { conversationId: existingQ.docs[0].id };
    }

    // Step 2: Build participants + accountNames
    const participants = [gigData.venueId];
    const accountNames = [];

    // 2a) venue active members -> accountNames (speak as venue)
    try {
      const memSnap = await db
        .collection("venueProfiles")
        .doc(gigData.venueId)
        .collection("members")
        .where("status", "==", "active")
        .get();

      const existingIds = new Set(accountNames.map((a) => a.accountId).filter(Boolean));

      memSnap.forEach((d) => {
        const uid = d.id;
        if (existingIds.has(uid)) return;
        const m = d.data() || {};
        accountNames.push({
          participantId: gigData.venueId, // they speak “as the venue”
          accountName: m.displayName || m.name || venueProfile.accountName || "Venue Staff",
          accountId: uid,                 // real userId used for auth checks
          role: "venue",
          accountImg: m.picture || null,
        });
        existingIds.add(uid);
      });
    } catch (_) {
      // non-fatal; continue
    }

    if (isBand) {
      // Fetch band members
      const membersSnap = await db.collection(`bands/${bandId}/members`).get();
      const memberIds = membersSnap.docs.map((d) => (d.data() || {}).musicianProfileId).filter(Boolean);
      participants.push(...memberIds, bandId);

      // Band “header”
      accountNames.push({
        participantId: bandId,
        accountName: musicianProfile.name,
        accountId: musicianProfile.userId,
        role: "band",
        musicianImg: musicianProfile.picture || null,
      });

      // Individual band members
      membersSnap.docs.forEach((doc) => {
        const m = doc.data() || {};
        accountNames.push({
          participantId: m.musicianProfileId,
          accountName: m.memberName,
          accountId: m.memberUserId,
          role: m.role || "Band Member",
          musicianImg: m.memberImg || null,
        });
      });
    } else {
      participants.push(musicianProfile.musicianId);
      accountNames.push({
        participantId: musicianProfile.musicianId,
        accountName: musicianProfile.name,
        accountId: musicianProfile.userId,
        role: "musician",
        musicianImg: musicianProfile.picture || null,
      });
    }

    // Step 3: Construct lastMessage string (keep the same style; no extra formatting)
    const dateStr = gigData?.date; // use as-is
    const venueName = gigData?.venue?.venueName;
    const lastMessage =
      type === "negotiation"
        ? `${musicianProfile.name} wants to negotiate the fee on ${dateStr} at ${venueName}.`
        : type === "application"
        ? `${musicianProfile.name} applied to the gig on ${dateStr} at ${venueName}.`
        : type === "invitation"
        ? `${venueProfile.accountName} has invited you to play at their gig on ${dateStr}.`
        : type === "dispute"
        ? `${venueProfile.accountName} has disputed the gig performed on ${dateStr}.`
        : "";

    // Build authorizedUserIds from accountNames.accountId
    const authorizedUserIds = Array.from(
      new Set(accountNames.map((a) => a.accountId).filter(Boolean))
    );

    // Step 4: Save to Firestore
    const payload = {
      participants,
      venueImg: Array.isArray(venueProfile.photos) ? venueProfile.photos[0] || null : null,
      venueName,
      accountNames,
      authorizedUserIds, // used by rules for read/write access
      gigDate: gigData.date,
      gigId: gigData.gigId,
      lastMessage,
      lastMessageTimestamp: Timestamp.now(),
      status: "open",
      createdAt: Timestamp.now(),
      bandConversation: isBand ? true : false,
    };

    const docRef = await db.collection("conversations").add(payload);
    return { conversationId: docRef.id };
  }
);