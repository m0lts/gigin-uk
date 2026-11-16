/** Public JPEG thumbnails referenced from email. The id is the thumbnail file name, not a storage path. */

import express from "express";
import { admin } from "../config/admin.js";
import { emailThumbObjectPath } from "../lib/emailThumbs.js";

const router = express.Router();

router.get("/:file", async (req, res) => {
  const id = String(req.params.file || "").replace(/\.jpg$/i, "");
  const objectPath = emailThumbObjectPath(id);
  if (!objectPath) return res.status(404).end();
  try {
    const file = admin.storage().bucket().file(objectPath);
    const [exists] = await file.exists();
    if (!exists) return res.status(404).end();
    res.set("Content-Type", "image/jpeg");
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    res.set("Content-Disposition", "inline");
    const stream = file.createReadStream();
    stream.on("error", () => {
      if (!res.headersSent) res.status(404).end();
      else res.end();
    });
    return stream.pipe(res);
  } catch {
    if (!res.headersSent) return res.status(404).end();
    return res.end();
  }
});

export default router;
