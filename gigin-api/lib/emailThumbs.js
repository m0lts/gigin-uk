/** 160px JPEG thumbnails for email. Failures return no URL so the email omits the picture. */

import crypto from "crypto";
import { admin } from "../config/admin.js";
import { durableEmailImageUrl, emailImageOrigin, emailThumbId, emailThumbObjectPath, storageObjectPath } from "./emailImages.js";

const THUMB = 160;

export { emailThumbObjectPath };

function firebaseDownloadUrl(bucketName, objectPath, token) {
  const object = encodeURIComponent(objectPath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${object}?alt=media&token=${encodeURIComponent(token)}`;
}

async function loadSharp() {
  try {
    const mod = await import("sharp");
    return mod.default || mod;
  } catch (error) {
    console.warn("email thumb skipped", error?.message || error);
    return null;
  }
}

async function writeThumb(bucket, objectPath) {
  const sharp = await loadSharp();
  if (!sharp) return "";
  const source = bucket.file(objectPath);
  const [exists] = await source.exists();
  if (!exists) return "";
  const [bytes] = await source.download();
  const jpeg = await sharp(bytes)
    .rotate()
    .resize(THUMB, THUMB, { fit: "cover" })
    .jpeg({ quality: 72 })
    .toBuffer();
  const id = emailThumbId(objectPath);
  const destPath = emailThumbObjectPath(id);
  const dest = bucket.file(destPath);
  let token = crypto.randomUUID();
  try {
    const [meta] = await dest.getMetadata();
    const existing = String(meta?.metadata?.firebaseStorageDownloadTokens || "").split(",")[0].trim();
    if (existing) token = existing;
  } catch {
    /* first time this thumbnail is written */
  }
  await dest.save(jpeg, {
    resumable: false,
    metadata: {
      contentType: "image/jpeg",
      cacheControl: "public, max-age=31536000",
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });
  const origin = emailImageOrigin();
  if (origin) return `${origin}/api/email-images/${id}.jpg`;
  return firebaseDownloadUrl(bucket.name, destPath, token);
}

/** Public JPEG URL for a stored photo. Empty when we cannot publish one. */
export async function emailThumbUrl(source) {
  const ready = durableEmailImageUrl(source);
  if (ready) return ready;
  if (typeof admin.storage !== "function") return "";
  try {
    const bucket = admin.storage().bucket();
    const objectPath = storageObjectPath(source, bucket.name);
    if (!objectPath) return "";
    return durableEmailImageUrl(await writeThumb(bucket, objectPath));
  } catch (error) {
    console.warn("email thumb skipped", error?.message || error);
    return "";
  }
}
