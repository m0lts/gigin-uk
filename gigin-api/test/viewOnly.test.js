import test from "node:test";
import assert from "node:assert/strict";
import { permissionForNightAction, sanitizePermissions, viewOnlyPermissions } from "../utils/permissions.js";
import { permissionForNightAction as clientAction, viewOnlyPermissions as clientViewOnly } from "../../src/services/utils/permissions.js";

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
