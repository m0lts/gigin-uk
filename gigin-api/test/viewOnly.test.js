import test from "node:test";
import assert from "node:assert/strict";
import { contactWritesAllowed, memberCanWriteContacts, permissionForNightAction, sanitizePermissions, viewOnlyPermissions } from "../utils/permissions.js";
import { contactWritesAllowed as clientContactWritesAllowed, memberCanWriteContacts as clientMemberCanWriteContacts, permissionForNightAction as clientAction, viewOnlyPermissions as clientViewOnly } from "../../src/services/utils/permissions.js";

test("a new staff invite is view only and the night routes use that split", () => {
  const perms = viewOnlyPermissions();
  assert.deepEqual(perms, clientViewOnly());
  assert.equal(perms["gigs.read"], true);
  assert.equal(perms[permissionForNightAction("promoDownload")], true);
  for (const action of ["accept", "decline", "assign", "undo", "edit", "invite", "promoReminder"]) {
    assert.equal(perms[permissionForNightAction(action)], false, action);
    assert.equal(permissionForNightAction(action), clientAction(action));
  }
  assert.deepEqual(sanitizePermissions({}), perms);
  assert.equal(sanitizePermissions({ "gigs.read": false, "gigs.update": true })["gigs.read"], true);
  assert.equal(sanitizePermissions({ "gigs.update": true })["gigs.update"], true);
});

test("a view-only member can read contacts and cannot write them", () => {
  const viewOnly = { owner: false, active: true, permissions: viewOnlyPermissions() };
  const editor = { owner: false, active: true, permissions: { "gigs.update": true } };
  assert.equal(memberCanWriteContacts(viewOnlyPermissions()), false);
  assert.equal(memberCanWriteContacts(undefined), true);
  assert.equal(memberCanWriteContacts({ "gigs.update": true }), true);
  assert.equal(contactWritesAllowed([viewOnly]), false);
  assert.equal(contactWritesAllowed([viewOnly, { owner: true, active: true }]), true);
  assert.equal(contactWritesAllowed([editor]), true);
  assert.equal(contactWritesAllowed([]), true);
  assert.equal(contactWritesAllowed([{ owner: false, active: false, permissions: viewOnlyPermissions() }]), true);
  assert.equal(clientMemberCanWriteContacts(viewOnlyPermissions()), memberCanWriteContacts(viewOnlyPermissions()));
  assert.equal(clientContactWritesAllowed([viewOnly]), contactWritesAllowed([viewOnly]));
  assert.equal(clientContactWritesAllowed([editor]), contactWritesAllowed([editor]));
});
