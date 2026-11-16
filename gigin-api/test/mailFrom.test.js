import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MAIL_FROM } from "../lib/mailFrom.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function jsFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      out.push(...jsFiles(full));
    } else if (entry.name.endsWith(".js") && entry.name !== "mailFrom.test.js") out.push(full);
  }
  return out;
}

test("all mail uses one From address", () => {
  assert.equal(MAIL_FROM, "Gigin <noreply@giginmusic.com>");
  const files = [
    ...jsFiles(path.join(root, "gigin-api")),
    ...jsFiles(path.join(root, "functions", "src")),
  ];
  const address = [];
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    assert.equal(text.includes("notifications@" + "giginmusic.com"), false, file);
    if (text.includes("Gigin <noreply@giginmusic.com>")) address.push(path.relative(root, file));
  }
  assert.deepEqual(address.sort(), [
    "functions/src/shared/mailFrom.js",
    "gigin-api/lib/mailFrom.js",
  ]);
});
