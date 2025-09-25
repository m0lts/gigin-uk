/* eslint-disable */
import { callable } from "../../../lib/callable.js";
import { REGION_PRIMARY } from "../../../config/regions.js";
import { admin } from "../../../lib/admin.js";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Callable: upload media files (video/track) for a musician profile.
 *
 * Input:
 * - `musicianId` (string)
 * - `mediaFiles` (Array<{ title, file(base64), thumbnail?, contentType, type: "video"|"track", date }>)
 *
 * Behavior:
 * - Saves files to GCS bucket paths under `musicians/{musicianId}/{type}/...`
 * - For videos, also stores a thumbnail if provided
 * - Updates the musician profile's `videos` / `tracks` arrays, replacing
 *   placeholder entries where `file === "uploading..."`
 *
 * Region: europe-west3.
 *
 * @function uploadMediaFiles
 * @param {import("firebase-functions/v2/https").CallableRequest} request
 * @returns {Promise<{success: boolean}>}
 */
export const uploadMediaFiles = callable(
  {
    region: REGION_PRIMARY,
    timeoutSeconds: 3600,
    // Add authRequired: true if you want to enforce authentication here
  },
  async (request) => {
      const {musicianId, mediaFiles} = request.data;
      if (!musicianId || !mediaFiles || !Array.isArray(mediaFiles)) {
        throw new Error(
            "Invalid payload: musicianId and mediaFiles are required.",
        );
      }
      try {
        const firestore = getFirestore();
        const bucket =
    admin.storage().bucket("giginltd-16772.firebasestorage.app");
        const videoUpdates = [];
        const trackUpdates = [];
        console.log("Received media, uploading starting.");
        for (const media of mediaFiles) {
          const {
            title,
            file,
            thumbnail,
            contentType,
            type,
            date,
          } = media;
          if (!file) {
            throw new Error(`Invalid file for media "${title}"`);
          }
          const fileBuffer = Buffer.from(file, "base64");
          const mediaRef =
          bucket.file(`musicians/${musicianId}/${type}/${title}`);
          await mediaRef.save(fileBuffer, {contentType});
          const mediaUrl = `https://storage.googleapis.com/${bucket.name}/${mediaRef.name}`;
          let thumbnailUrl = null;
          if (type === "video" && thumbnail) {
            const thumbnailBuffer = Buffer.from(thumbnail, "base64");
            const thumbnailRef =
        bucket
            .file(
                `musicians/${musicianId}/${type}/thumbnails/${title}_thumbnail`,
            );
            await thumbnailRef.save(
                thumbnailBuffer, {contentType: "image/png"},
            );
            thumbnailUrl =
        `https://storage.googleapis.com/${bucket.name}/${thumbnailRef.name}`;
          }
          if (type === "video") {
            videoUpdates.push({
              title,
              file: mediaUrl,
              thumbnail: thumbnailUrl,
              date,
            });
            console.log(`Video file ${title} uploaded.`);
          } else if (type === "track") {
            trackUpdates.push({
              title,
              file: mediaUrl,
              date,
            });
            console.log(`Track file ${title} uploaded.`);
          }
        }
        const musicianRef =
    firestore.collection("musicianProfiles").doc(musicianId);
        const musicianDoc = await musicianRef.get();
        if (!musicianDoc.exists) {
          throw new Error("Musician profile does not exist.");
        }
        const currentData = musicianDoc.data();
        const updatedVideos = (currentData.videos || []).map((video) => {
          const match =
      videoUpdates.find(
          (v) => v.title === video.title && video.file === "uploading...",
      );
          return match ? {...match} : video;
        });
        const updatedTracks = (currentData.tracks || []).map((track) => {
          const match =
      trackUpdates.find(
          (t) => t.title === track.title && track.file === "uploading...",
      );
          return match ? {...match} : track;
        });
        await musicianRef.update({
          videos: updatedVideos,
          tracks: updatedTracks,
        });
        console.log("Updated musician profile.");
        return {success: true};
      } catch (error) {
        console.error("Error uploading media files:", error);
        throw new Error("Failed to upload media files.");
      }
    }
);