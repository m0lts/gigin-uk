import crypto from "crypto";
import { admin } from "../config/admin.js";

export const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
export const IMAGE_LIMIT = 10 * 1024 * 1024;
export const ASSET_LIMIT = 20 * 1024 * 1024;
export const AUDIO_LIMIT = 15 * 1024 * 1024;
export const AUDIO_CAP = 3;
export const ASSET_CAP = 5;
export const READ_URL_MS = 60 * 60 * 1000;

const IMAGE_EXT = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/heic": ["heic"],
  "image/heif": ["heif"],
};

const AUDIO_RULES = [
  { extensions: ["mp3"], types: ["audio/mpeg"] },
  { extensions: ["m4a"], types: ["audio/mp4", "audio/x-m4a"] },
  { extensions: ["wav"], types: ["audio/wav", "audio/x-wav"] },
];

const AUDIO_EXTENSIONS = new Set(AUDIO_RULES.flatMap((rule) => rule.extensions));
const EMULATOR_READ_SECRET = "emulator-guest-asset-read";

export const SUPPORTED_FILE = "Use a photo or PDF (up to 20 MB) or audio (MP3, M4A, WAV, up to 15 MB).";

export function fileExtension(name) {
  const match = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "";
}

export function normalizeType(value) {
  return String(value || "").split(";")[0].trim().toLowerCase();
}

export function audioRuleFor(name, contentType) {
  const ext = fileExtension(name);
  const type = normalizeType(contentType);
  return AUDIO_RULES.find((rule) => rule.extensions.includes(ext) && rule.types.includes(type)) || null;
}

export function isAudioObjectName(name) {
  return AUDIO_EXTENSIONS.has(fileExtension(name));
}

export function isAudioAsset(asset) {
  return Boolean(audioRuleFor(asset?.name, asset?.contentType || asset?.type));
}

function unsupported(name) {
  return `${name || "That file"} isn't supported. ${SUPPORTED_FILE}`;
}

function extensionMatchesFile(ext, type) {
  if (type === "application/pdf") return ext === "pdf";
  const allowed = IMAGE_EXT[type];
  return Array.isArray(allowed) && allowed.includes(ext);
}

export function uploadRequestProblem({ kind, contentType, name, size }) {
  const type = normalizeType(contentType);
  const bytes = Number(size);
  const label = String(name || "That file");
  if (!Number.isFinite(bytes) || bytes <= 0) return { error: `${label} is empty.` };
  if (kind === "photo") {
    if (!IMAGE_TYPES.has(type)) return { error: "Use a JPG or PNG." };
    if (bytes > IMAGE_LIMIT) return { error: "Photos must be 10 MB or smaller." };
    return null;
  }
  const ext = fileExtension(label);
  const audio = audioRuleFor(label, type);
  if (audio || AUDIO_EXTENSIONS.has(ext) || type.startsWith("audio/")) {
    if (!audio) return { error: unsupported(label) };
    if (bytes > AUDIO_LIMIT) return { error: "Audio files must be 15 MB or smaller.", discard: true };
    return null;
  }
  if (!IMAGE_TYPES.has(type) && type !== "application/pdf") return { error: unsupported(label) };
  if (!extensionMatchesFile(ext, type)) return { error: unsupported(label) };
  if (bytes > ASSET_LIMIT) return { error: "Files must be 20 MB or smaller.", discard: true };
  return null;
}

export function safeObjectName(name) {
  const clean = String(name || "file").replace(/[^\w.\-]+/g, "-").replace(/^\.+/, "");
  const ext = fileExtension(clean);
  const base = ext ? clean.slice(0, -(ext.length + 1)) : clean;
  const trimmed = (base || "file").slice(0, 70);
  return ext ? `${trimmed}.${ext}` : trimmed.slice(0, 80);
}

export function pathBelongs(path, applicationIds) {
  const value = String(path || "");
  if (!value || value.includes("..")) return false;
  const parts = value.split("/");
  if (parts.length !== 3 || parts[0] !== "guest-applications" || !parts[2]) return false;
  return applicationIds.some((id) => id && parts[1] === id);
}

export async function readStoredFile(path) {
  const file = admin.storage().bucket().file(path);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [meta] = await file.getMetadata();
  return {
    contentType: normalizeType(meta.contentType),
    size: Number(meta.size) || 0,
  };
}

export async function deleteStoredFile(path) {
  if (!path) return;
  await admin.storage().bucket().file(path).delete({ ignoreNotFound: true }).catch(() => {});
}

export async function countAudioObjects(applicationId, ignorePaths = []) {
  const prefix = `guest-applications/${applicationId}/`;
  const [files] = await admin.storage().bucket().getFiles({ prefix });
  const ignore = new Set(ignorePaths);
  return files.filter((file) => !ignore.has(file.name) && isAudioObjectName(file.name)).length;
}

export async function acceptSubmittedAssets(rawAssets, applicationIds) {
  const list = Array.isArray(rawAssets) ? rawAssets : [];
  if (list.length > ASSET_CAP) return { error: "You can add up to 5 files." };
  const audioNamed = list.filter((asset) => isAudioObjectName(asset?.name) || normalizeType(asset?.contentType).startsWith("audio/"));
  if (audioNamed.length > AUDIO_CAP) return { error: "You can add up to 3 audio files." };
  const stored = [];
  for (const asset of list) {
    const path = String(asset?.path || "");
    const name = String(asset?.name || path.split("/").pop() || "file").slice(0, 180);
    if (!pathBelongs(path, applicationIds)) return { error: "File path is not valid." };
    const meta = await readStoredFile(path);
    if (!meta) return { error: `${name} didn't finish uploading. Remove it and try again.` };
    const objectExt = fileExtension(path);
    const nameExt = fileExtension(name);
    const problem = uploadRequestProblem({
      kind: "asset",
      contentType: meta.contentType,
      name: objectExt ? `file.${objectExt}` : name,
      size: meta.size,
    });
    if (problem?.error) {
      await deleteStoredFile(path);
      return { error: problem.error.includes("isn't supported") ? unsupported(name) : problem.error };
    }
    if (!nameExt || nameExt !== objectExt) return { error: unsupported(name) };
    stored.push({ path, name, size: meta.size, contentType: meta.contentType });
  }
  const audioCount = stored.filter((asset) => isAudioAsset(asset)).length;
  if (audioCount > AUDIO_CAP) return { error: "You can add up to 3 audio files." };
  return { assets: stored };
}

function attachmentDisposition(name) {
  const safe = String(name || "audio").replace(/["\r\n\\]/g, "").slice(0, 120) || "audio";
  return `attachment; filename="${safe}"`;
}

function localReadUrl(req, path, disposition) {
  const body = Buffer.from(JSON.stringify({
    path,
    exp: Date.now() + READ_URL_MS,
    disposition: disposition || "",
  })).toString("base64url");
  const sig = crypto.createHmac("sha256", EMULATOR_READ_SECRET).update(body).digest("base64url");
  const host = req.get("host");
  return `${req.protocol}://${host}/api/guest-applications/asset-read/${body}.${sig}`;
}

export function readLocalTicket(ticket) {
  const raw = String(ticket || "");
  const splitAt = raw.lastIndexOf(".");
  if (splitAt <= 0) return null;
  const body = raw.slice(0, splitAt);
  const sig = raw.slice(splitAt + 1);
  const expected = crypto.createHmac("sha256", EMULATOR_READ_SECRET).update(body).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (!payload?.path || Number(payload.exp) < Date.now()) return null;
    if (!pathBelongs(payload.path, [payload.path.split("/")[1]])) return null;
    return payload;
  } catch {
    return null;
  }
}

async function signGuestRead(req, path, downloadName) {
  if (process.env.STORAGE_EMULATOR_HOST) {
    return localReadUrl(req, path, downloadName ? attachmentDisposition(downloadName) : "");
  }
  const options = {
    version: "v4",
    action: "read",
    expires: Date.now() + READ_URL_MS,
  };
  if (downloadName) options.responseDisposition = attachmentDisposition(downloadName);
  try {
    const [url] = await admin.storage().bucket().file(path).getSignedUrl(options);
    return url;
  } catch (error) {
    if (!/client_email/.test(String(error?.message || ""))) throw error;
    return "";
  }
}

export async function withAudioReadUrls(assets, req) {
  const list = Array.isArray(assets) ? assets : [];
  const next = [];
  for (const asset of list) {
    if (!isAudioAsset(asset) || !asset.path) {
      next.push(asset);
      continue;
    }
    const playUrl = await signGuestRead(req, asset.path);
    const downloadUrl = await signGuestRead(req, asset.path, asset.name || "audio");
    next.push({
      ...asset,
      ...(playUrl ? { playUrl } : {}),
      ...(downloadUrl ? { downloadUrl } : {}),
    });
  }
  return next;
}
