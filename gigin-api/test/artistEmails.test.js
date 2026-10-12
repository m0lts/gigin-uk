import test from "node:test";
import assert from "node:assert/strict";
import { bandMemberRow, renderArtistEmail } from "../lib/artistEmails.js";

function applicationEmail(members) {
  return renderArtistEmail({
    subject: "Applied",
    eyebrow: "APPLICATION SENT",
    heading: "Applied",
    paras: ["Hi Sam,"],
    boxes: [{
      label: "YOUR APPLICATION",
      rows: [["Act", "The Fen Street Trio"], bandMemberRow(members)].filter(Boolean),
    }],
    footer: "You're getting this because you applied.",
  });
}

test("an application with no band members omits the band row", () => {
  assert.equal(bandMemberRow(undefined), null);
  assert.equal(bandMemberRow([]), null);
  assert.equal(bandMemberRow([{ name: "", instruments: [] }]), null);
  assert.equal(bandMemberRow([{ name: "  ", instruments: [""] }]), null);
  const email = applicationEmail([{ name: "", instruments: [] }]);
  assert.equal(email.text.includes("Band:"), false);
  assert.equal(email.text.includes("No members"), false);
  assert.equal(email.html.includes("No members"), false);
});

test("a named band is one line on the application email", () => {
  assert.deepEqual(bandMemberRow([{ name: "Ada", instruments: ["Vocals"] }]), ["Band", "1 member"]);
  assert.deepEqual(bandMemberRow([{ name: "Ada" }, { instruments: ["Guitar"] }]), ["Band", "2 members"]);
  assert.match(applicationEmail([{ name: "Ada" }, { name: "Ben" }]).text, /Band: 2 members/);
});
