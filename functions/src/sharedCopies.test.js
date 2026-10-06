import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {sharedFiles} from "../syncShared.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const functionsDir = path.resolve(here, "..");
const repoRoot = path.resolve(functionsDir, "..");
const destRoot = path.join(functionsDir, "src", "shared");

/**
 * @param {string} dir
 * @param {string} prefix
 * @return {string[]}
 */
function walkJs(dir, prefix) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...walkJs(path.join(dir, entry.name), rel));
    } else if (entry.name.endsWith(".js")) {
      out.push(rel);
    }
  }
  return out;
}

test("shared copies match gigin-api/lib", () => {
  const {files} = sharedFiles();
  assert.deepEqual(walkJs(destRoot, "").sort(), files);
  for (const rel of files) {
    const copy = fs.readFileSync(path.join(destRoot, rel), "utf8");
    const source = fs.readFileSync(
        path.join(repoRoot, "gigin-api", "lib", rel),
        "utf8",
    );
    assert.equal(copy, source, rel);
  }
});
