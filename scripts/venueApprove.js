/**
 * Approve a venue from the command line.
 * giginltd-dev runs immediately. Any other project, including production,
 * waits until the typed project id matches.
 *
 *   npm run venue:approve -- --venue-id VENUE_ID --project PROJECT_ID
 */

import { confirmationMatches, projectNeedsTypedConfirmation } from "../gigin-api/lib/venueApprovalPolicy.js";

function arg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? "" : String(process.argv[index + 1] || "").trim();
}

async function typedProject(project) {
  const prompt = `Type ${project} to approve a venue on this project: `;
  if (!process.stdin.isTTY) {
    process.stderr.write(prompt);
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString("utf8");
  }
  const { createInterface } = await import("node:readline/promises");
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const answer = await rl.question(prompt);
  rl.close();
  return answer;
}

const venueId = arg("--venue-id");
const project = arg("--project");

if (!venueId || !project) {
  process.stderr.write("Usage: npm run venue:approve -- --venue-id VENUE_ID --project PROJECT_ID\n");
  process.exit(1);
}

if (projectNeedsTypedConfirmation(project)) {
  const typed = await typedProject(project);
  if (!confirmationMatches(project, typed)) {
    process.stderr.write(`Refusing to approve a venue on ${project} without typing that project id.\n`);
    process.exit(1);
  }
}

process.env.GCLOUD_PROJECT = project;
process.env.GOOGLE_CLOUD_PROJECT = project;

const { initializeAdmin } = await import("../gigin-api/config/admin.js");
initializeAdmin();
const { approveVenueById } = await import("../gigin-api/lib/venueApproval.js");

try {
  const result = await approveVenueById({ venueId, actor: "cli" });
  if (result.already) {
    process.stdout.write(`Already approved ${venueId} on ${project}.\n`);
  } else {
    process.stdout.write(`Approved ${venueId} on ${project}.\n`);
  }
} catch (error) {
  process.stderr.write(`${error.message || "Could not approve the venue."}\n`);
  process.exit(1);
}
