import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  confirmationMatches,
  projectNeedsTypedConfirmation,
  tokenState,
  venueIsApproved,
} from "../lib/venueApprovalPolicy.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("a venue with no approval field is already live", () => {
  assert.equal(venueIsApproved({ name: "The Room" }), true);
  assert.equal(venueIsApproved({ approvalStatus: "approved" }), true);
  assert.equal(venueIsApproved({ approvalStatus: "pending" }), false);
  assert.equal(venueIsApproved({ approvalStatus: "rejected" }), false);
});

test("only giginltd-dev skips the typed project confirmation", () => {
  assert.equal(projectNeedsTypedConfirmation("giginltd-dev"), false);
  assert.equal(projectNeedsTypedConfirmation("giginltd-16772"), true);
  assert.equal(confirmationMatches("giginltd-16772", "giginltd-16772"), true);
  assert.equal(confirmationMatches("giginltd-16772", "giginltd-dev"), false);
});

test("an expired or used approval token cannot be used", () => {
  assert.equal(tokenState(null), "missing");
  assert.equal(tokenState({ usedAt: "2026-01-01T00:00:00.000Z", expiresAt: "2099-01-01T00:00:00.000Z" }), "used");
  assert.equal(tokenState({ usedAt: null, expiresAt: "2000-01-01T00:00:00.000Z" }), "expired");
  assert.equal(tokenState({ usedAt: null, expiresAt: "2099-01-01T00:00:00.000Z" }), "ok");
});

test("the approve command refuses a non-dev project when the confirmation is empty", async () => {
  const result = await new Promise((resolve) => {
    const child = spawn(process.execPath, [
      path.join(root, "scripts/venueApprove.js"),
      "--venue-id", "venue-1",
      "--project", "giginltd-16772",
    ], { cwd: root, stdio: ["pipe", "pipe", "pipe"] });
    let stderr = "";
    let stdout = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stdin.end();
    child.on("close", (code) => resolve({ code, stderr, stdout }));
  });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Refusing/);
  assert.equal(result.stdout.includes("Approved"), false);
});
