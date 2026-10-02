import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import {
  DEFAULT_NOTIFY_EMAIL,
  accessRequestLimiter,
  handleAccessRequest,
  notifyAddress,
} from "../lib/accessRequest.js";

const valid = {
  name: "  Ada   Lovelace ",
  venueName: "The Crown",
  city: "Cambridge",
  email: "Ada@Venue.Test",
  nightsPerMonth: "4",
  message: "We book originals.",
  company: "",
};

function appWith(deps) {
  const app = express();
  app.use(express.json());
  const saved = [];
  const sent = [];
  app.post(
    "/api/access-requests",
    accessRequestLimiter({ max: deps.max ?? 5, windowMs: 60 * 60 * 1000 }),
    handleAccessRequest({
      save: async (record) => { saved.push(record); },
      send: async (email) => { sent.push(email); },
      notifyTo: () => notifyAddress(deps.env || {}),
      now: () => "2026-10-02T12:00:00.000Z",
    }),
  );
  return { app, saved, sent };
}

function listen(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function post(server, body) {
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/access-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  return { status: response.status, json };
}

test("a valid request is trimmed and both emails are queued", async () => {
  const { app, saved, sent } = appWith({});
  const server = await listen(app);
  try {
    const result = await post(server, valid);
    assert.equal(result.status, 200);
    assert.equal(result.json.ok, true);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].name, "Ada Lovelace");
    assert.equal(saved[0].email, "ada@venue.test");
    assert.equal(saved[0].nightsPerMonth, 4);
    assert.equal(saved[0].createdAt, "2026-10-02T12:00:00.000Z");
    assert.equal(sent.length, 2);
    assert.equal(sent[0].to, DEFAULT_NOTIFY_EMAIL);
    assert.match(sent[0].message.text, /Ada Lovelace/);
    assert.match(sent[0].message.text, /The Crown/);
    assert.match(sent[0].message.text, /Cambridge/);
    assert.match(sent[0].message.text, /ada@venue.test/);
    assert.match(sent[0].message.text, /Nights per month: 4/);
    assert.match(sent[0].message.text, /We book originals/);
    assert.match(sent[0].message.text, /2026-10-02T12:00:00.000Z/);
    assert.equal(sent[1].to, "ada@venue.test");
    assert.equal(sent[1].message.text, "Thanks, the founder will be in touch shortly.");
  } finally {
    server.close();
  }
});

test("the notify address comes from VENUE_ACCESS_NOTIFY_EMAIL", () => {
  assert.equal(notifyAddress({}), DEFAULT_NOTIFY_EMAIL);
  assert.equal(notifyAddress({ VENUE_ACCESS_NOTIFY_EMAIL: "  booker@gigin.test " }), "booker@gigin.test");
});

test("missing, oversized, and bad fields are rejected and not stored", async () => {
  const { app, saved, sent } = appWith({});
  const server = await listen(app);
  try {
    const missing = await post(server, { ...valid, email: "not-an-email", nightsPerMonth: "0" });
    assert.equal(missing.status, 400);
    assert.deepEqual(missing.json.fields.sort(), ["email", "nightsPerMonth"]);
    const longName = await post(server, { ...valid, name: "A".repeat(81) });
    assert.equal(longName.status, 400);
    assert.ok(longName.json.fields.includes("name"));
    const longMessage = await post(server, { ...valid, message: "x".repeat(2001) });
    assert.equal(longMessage.status, 400);
    assert.ok(longMessage.json.fields.includes("message"));
    assert.equal(saved.length, 0);
    assert.equal(sent.length, 0);
  } finally {
    server.close();
  }
});

test("a filled honeypot is accepted and dropped", async () => {
  const { app, saved, sent } = appWith({});
  const server = await listen(app);
  try {
    const result = await post(server, { ...valid, company: "buy followers" });
    assert.equal(result.status, 200);
    assert.equal(result.json.ok, true);
    assert.equal(saved.length, 0);
    assert.equal(sent.length, 0);
  } finally {
    server.close();
  }
});

test("the same IP is limited", async () => {
  const { app, saved } = appWith({ max: 2 });
  const server = await listen(app);
  try {
    assert.equal((await post(server, valid)).status, 200);
    assert.equal((await post(server, valid)).status, 200);
    const blocked = await post(server, valid);
    assert.equal(blocked.status, 429);
    assert.equal(saved.length, 2);
  } finally {
    server.close();
  }
});
