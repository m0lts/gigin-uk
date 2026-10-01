import { db } from "../config/admin.js";

export async function queueMail(doc) {
  const to = doc?.to;
  if (typeof to !== "string" || !to.includes("@")) {
    console.warn("Skipped mail document: missing to address");
    return false;
  }
  await db.collection("mail").add(doc);
  return true;
}
