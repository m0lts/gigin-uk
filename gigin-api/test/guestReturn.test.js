/**
 * A previous guest email is not reused until a one-time link is opened.
 */
import { registerHooks } from "node:module";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { store } from "./guestReturnFixture.js";

const fixtureUrl = new URL("./guestReturnFixture.js", import.meta.url).href;

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith("/gigin-api/config/admin.js")) {
      return {
        format: "module",
        shortCircuit: true,
        source: `export { db, admin, FieldValue, Timestamp, GeoPoint } from ${JSON.stringify(fixtureUrl)};\n`,
      };
    }
    return nextLoad(url, context);
  },
});

const {
  checkReturningGuest,
  claimReturnToken,
  guestCreateDecision,
  lookupGuest,
  redeemReturnToken,
  returnCheckHttp,
} = await import("../lib/guestReturn.js");

function mailsTo(email) {
  return store.mail().filter((mail) => mail.to === email);
}

function returnTokenFrom(mail) {
  const html = mail?.message?.html || "";
  const match = html.match(/[?&]return=([a-f0-9]{64})/);
  return match ? match[1] : "";
}

function manageTokenFrom(mail) {
  const html = mail?.message?.html || "";
  const match = html.match(/\/application\/([a-f0-9]{64})/);
  return match ? match[1] : "";
}

describe("returning guest", { concurrency: 1 }, () => {
  test("an unknown email is unchanged and sends nothing", async () => {
    const result = await checkReturningGuest({
      email: "newcomer@guest.test",
      gigId: "gig-new",
      ip: "ip-unknown",
    });
    assert.deepEqual(result, { known: false });
    assert.deepEqual(returnCheckHttp(result).body, { known: false });
    assert.equal(mailsTo("newcomer@guest.test").length, 0);
  });

  test("a known email gets the welcome screen response and one email, with no private details", async () => {
    const result = await checkReturningGuest({
      email: "known@guest.test",
      gigId: "gig-new",
      ip: "ip-known",
    });
    assert.deepEqual(result, { known: true, sameGig: false });
    const http = returnCheckHttp(result);
    assert.deepEqual(Object.keys(http.body).sort(), ["known", "sameGig"]);
    assert.equal(JSON.stringify(http.body).includes("Ada"), false);
    assert.equal(JSON.stringify(http.body).includes("Cellar"), false);
    assert.equal(JSON.stringify(http.body).includes("photo"), false);
    const queued = mailsTo("known@guest.test");
    assert.equal(queued.length, 1);
    assert.match(queued[0].message.subject, /^Welcome back, The Cellar Band\. Continue your application to Library Night at Jesus College Bar$/);
    assert.match(queued[0].message.html, /Sam/);
    assert.doesNotMatch(queued[0].message.html, /photo-secret/);
    assert.ok(returnTokenFrom(queued[0]));
  });

  test("the return token is single-use, expires, and is rejected for the wrong gig", async () => {
    const sent = mailsTo("known@guest.test")[0];
    const token = returnTokenFrom(sent);
    const wrong = await redeemReturnToken({ token, gigId: "gig-same" });
    assert.equal(wrong, null);
    const expired = await redeemReturnToken({
      token,
      gigId: "gig-new",
      now: Date.now() + 2 * 60 * 60 * 1000,
    });
    assert.equal(expired, null);
    const draft = await redeemReturnToken({ token, gigId: "gig-new" });
    assert.equal(draft.contactName, "Ada Guest");
    assert.equal(draft.actName, "The Cellar Band");
    assert.equal(draft.email, "known@guest.test");
    assert.equal(draft.note, "We play early.");
    assert.equal(draft.links.spotify, "https://open.spotify.com/cellar");
    assert.equal(Object.hasOwn(draft, "photo"), false);
    assert.equal(Object.hasOwn(draft, "assets"), false);
    assert.equal(JSON.stringify(draft).includes("photo-secret"), false);
    assert.equal(JSON.stringify(draft).includes("setLabel"), false);
    const again = await redeemReturnToken({ token, gigId: "gig-new" });
    assert.equal(again, null);
  });

  test("four checks of one new email still succeed, so a second application is not blocked", async () => {
    const email = "second-gig@guest.test";
    const ip = "ip-second-gig";
    for (let index = 0; index < 4; index += 1) {
      const result = await checkReturningGuest({ email, gigId: "gig-new", ip });
      assert.deepEqual(result, { known: false });
    }
    assert.equal(mailsTo(email).length, 0);
  });

  test("one email on one network can be checked 10 times an hour, and the 11th says how long to wait", async () => {
    const email = "limit@guest.test";
    const ip = "ip-email-limit";
    const start = 1_700_000_000_000;
    for (let index = 0; index < 10; index += 1) {
      const result = await checkReturningGuest({ email, gigId: "gig-new", ip, now: start });
      assert.equal(result.known, true);
      assert.equal(result.sameGig, false);
    }
    const otherEmail = await checkReturningGuest({
      email: "someone-else@guest.test",
      gigId: "gig-new",
      ip,
      now: start,
    });
    assert.deepEqual(otherEmail, { known: false });
    const blocked = await checkReturningGuest({
      email,
      gigId: "gig-new",
      ip,
      now: start + 30 * 60 * 1000,
    });
    assert.equal(blocked.limited, true);
    const http = returnCheckHttp(blocked);
    assert.equal(http.status, 429);
    assert.equal(http.body.error, "Please wait 30 minutes and try again.");
    assert.equal(Object.hasOwn(http.body, "known"), false);
    assert.equal(mailsTo(email).length, 10);
  });

  test("the same gig sends the existing private link and does not open a second application", async () => {
    const before = store.get("gigs/gig-same/private/applications");
    const result = await checkReturningGuest({
      email: "same@guest.test",
      gigId: "gig-same",
      ip: "ip-same",
    });
    assert.deepEqual(result, { known: true, sameGig: true });
    assert.deepEqual(Object.keys(returnCheckHttp(result).body).sort(), ["known", "sameGig"]);
    const queued = mailsTo("same@guest.test");
    assert.equal(queued.length, 1);
    assert.match(queued[0].message.html, /\/application\//);
    assert.doesNotMatch(queued[0].message.html, /return=/);
    assert.match(queued[0].message.html, /already applied/i);
    assert.equal(JSON.stringify(returnCheckHttp(result).body).includes("First Act"), false);
    assert.deepEqual(store.get("gigs/gig-same/private/applications"), before);
    const blocked = await guestCreateDecision({
      gigId: "gig-same",
      contacts: { email: "same@guest.test" },
      anotherAct: true,
    });
    assert.equal(blocked.action, "reject");
    assert.equal(blocked.error, "Confirm this email from the link we sent.");
  });

  test("lookup returns only whether a match exists", async () => {
    const hit = await lookupGuest({ gigId: "gig-phone", phone: "07700900333" });
    assert.deepEqual(hit, { exists: true });
    assert.equal(JSON.stringify(hit).includes("hidden"), false);
    assert.equal(JSON.stringify(hit).includes("Sunday"), false);
    assert.equal(JSON.stringify(hit).includes("Pat"), false);
    const miss = await lookupGuest({ gigId: "gig-phone", email: "nobody@guest.test" });
    assert.deepEqual(miss, { exists: false });
  });

  test("a manager can apply with a second act only after the private link", async () => {
    const unverified = await guestCreateDecision({
      gigId: "gig-same",
      anotherAct: true,
      contacts: { email: "same@guest.test" },
    });
    assert.equal(unverified.action, "reject");
    const verified = await guestCreateDecision({
      gigId: "gig-same",
      anotherAct: true,
      priorManageToken: manageTokenFrom(mailsTo("same@guest.test")[0]),
      contacts: { email: "same@guest.test" },
    });
    assert.equal(verified.action, "another");
    const token = returnTokenFrom(mailsTo("known@guest.test")[0]);
    const redeemed = await guestCreateDecision({
      gigId: "gig-new",
      returnToken: token,
      contacts: { email: "known@guest.test" },
    });
    assert.equal(redeemed.action, "allow");
    assert.equal(redeemed.claimToken, true);
    const claimed = await claimReturnToken({
      token,
      email: "known@guest.test",
      gigId: "gig-new",
      applicationId: "new-app",
    });
    assert.equal(claimed, true);
    const reused = await guestCreateDecision({
      gigId: "gig-new",
      returnToken: token,
      contacts: { email: "known@guest.test" },
    });
    assert.equal(reused.action, "reject");
  });
});
