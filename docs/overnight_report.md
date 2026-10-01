# Overnight report

Branch: `jez-mode`. Nothing was pushed, deployed, or merged. Firebase project used was `giginltd-dev` through the local emulators. Production (`giginltd-16772`) was not used. No real email addresses were written. Java 17 from Homebrew was on `PATH` for the emulator runs.

## Parts

| Part | Result | Notes |
| --- | --- | --- |
| 1. Invite from Contacts | Done | Picking a contact already existed on the gig page and in the share modal. Private gigs from the gig-page contact list now create an invite and email or copy that link. Guests are still email-only. After any new invite is created, the invite modal offers Contacts. |
| 2. Close applications | Done | New field `applicationsOpen`, default true when missing or on create. The gig-page switch writes that field instead of `status`, so closing applications does not mark the gig cancelled. After an accept, if every slot is filled the venue sees "Close applications now?" (Close / Keep open). If some slots are still open they see "Close applications for the rest". Guest and logged-in apply are rejected with "Applications for this gig are closed." The guest page uses the existing closed message. Manage and withdraw are unchanged. |
| 3. Confirmed gig and media | Done, signing not verified here | Running order, times, sound engineer, and additional notes were already on the page. Confirmed acts now list tech needs, what they bring, and compatibility. Photos and videos use the signed-upload pattern. Share links store only a SHA-256 hash. The public page needs no login and offers single download and a server-streamed zip. Revoke deletes the hash. |
| 4. Guest linking | Done | Private-token link sets `userId` and `linkedArtistId` on the guest applicant and `artistId` on the venue contact. The guest id is kept. Same email reuses one contact and no longer clears an existing `artistId`. An email that already belongs to a Gigin account is told to log in. Contacts shows "This looks like &lt;name&gt;: merge?" and merges only after a click. |
| 5. Notes and link previews | Done | Sidebar "Notes" is now "Additional notes" (same `internalNotes` field as the main tile). The old box that saves `notes` is labelled "Listing note" and is not on the card layout. Open Graph HTML is `GET /api/link-preview/gig/:gigId`. |

## Loading screen

Verdict: test setup, not an application bug, and not the feature flags.

`Dashboard.jsx` shows `LoadingScreen` while `VenueDashboardContext` has `loading === true`. That flag starts true and is cleared in `fetchAllData`'s `finally`. `fetchAllData` runs only after `useAuth` has set a user.

With the checked-in `firestore.rules`, the signed-in venue's `users/{uid}` listener failed immediately: `User snapshot error: FirebaseError: No matching allow statements`. `useAuth` then set auth loading to false and did not set a user, so `fetchAllData` never started. The dashboard chrome was on screen (Gigs, calendar, All 0) with the loading screen over it. No dashboard promise was stuck. The only failed request in that session was an aborted Stripe script. There was no console error from `getGigsByVenueIds`, Mapbox, or Cloud Functions.

Control, same emulator, every `VITE_FEATURE_*` false (payments included, which is how production builds them): a thin completed venue and a fully populated venue both finished `fetchAllData`. Membership loaded, then `getGigsByVenueIds` and `getVenueRequestsByVenueIds`, then `getTemplatesByVenueIds`. Payments was false, so billing was skipped. The loading screen came off and the list showed All 1.

That emulator-only override has been removed. Browser runs now use the checked-in rules, which were replaced with the live production rules and committed as `Sync firestore.rules with live production rules`. Those rules were not deployed.

## Test results

The Node suite `gigin-api/test/overnight.test.js` still passed earlier on the emulators (about 2.2s). It uses the Admin SDK.

Browser results below are from a fresh API on port 8099 after a leftover `node server.js` (eight hours old, same port) was stopped. That leftover process was answering health checks and returning 429 from the guest-application limiter, which made an earlier re-run look like product failures.

| # | Check | Result | Why |
| --- | --- | --- | --- |
| 1 | Two-slot gig and invite from Contacts | Pass | Dashboard loaded. Generate Invite, then Saved Contact Act. Toast: invitation email sent. A `gigInvites` doc existed. The contact needed `createdAt` or the CRM query (`orderBy createdAt`) omitted it. |
| 2 | Guest apply, photo, mail, manage, withdraw, no duplicate contact | Pass | Press photo, note, private-link edit, withdraw, second gig, one contact. About 4s. |
| 3 | Existing Gigin email told to log in | Pass | The log-in sentence showed and the form stayed on "Who are you?". |
| 4 | Guest tag, accept, decline, Contacts | Pass | Both guests showed the Guest tag. Decline and Accept were clicked. The accepted act was on My Contacts. Overview, NextGig, and EditGigTimeModal were not opened. |
| 5 | Close applications, guest page, server reject | Pass | The switch toasted "Applications closed." Logged out, the public page showed Applications closed. A late guest POST returned 409. Reopen was not clicked. |
| 6 | Sound engineer and additional notes persist | Pass | After refresh, Sam Engineer and "Bring the spare DI box." were both on the page. |
| 7 | Token link and manual merge | Pass | The new account was marked `emailVerified` on the Auth emulator (`accounts:update` with Bearer owner). Merge was not automatic. After Merge, the contact gained `artistId`. About 3.8s. |
| 8 | Wrong type, private link, revoke, file and zip | Pass | A text file toasted "Use a photo or video". The private link opened. After revoke, the old link said it was no longer available. A separate check uploaded `overnight-browser-pixel.png`, downloaded that file through the private link, downloaded the zip, and found one entry named `1-overnight-browser-pixel.png`. An oversize file was not tried in the browser. |
| 9 | Logged-in artist apply, accept, decline, withdraw, cancel, delete, mixed gig | Pass | A guest and Regression Act were both on one gig. The artist was accepted, the gig was cancelled with reason Availability, and the gig document was deleted. A second artist's application was stored as declined. The withdrawn gig was deleted. No error toast. |
| 10 | Console and server logs | Pass | No unexpected browser error was collected. |

## What was tried

1. Instrumented `fetchAllData` on the emulator. With repo rules, the user snapshot was denied and `fetchAllData` never logged a start. With emulator rules and every feature flag false, both profiles logged membership, gigs, requests, templates, `payments flag false`, and `fetchAllData finished`. The logs were removed.
2. A second browser run still hit the old API on 8099 (`EADDRINUSE`). Guest applies returned "Too many attempts." That process was `node server.js`, elapsed about eight hours. It was stopped. The next run used a new server.
3. Test 9, cancel: the menu item is "Cancel gig". The first click was covered by "Close applications now?". Waiting for Keep open cleared that. The next click did not open `#cancellation-reason`; the calendar was showing, Confirmed 1.

## Cancel gig

The gig-page Options item "Cancel gig" does the same thing with every `VITE_FEATURE_*` flag false and with every flag true. It does not open a reason list. It tells the venue to use the Options menu on the Gigs list and navigates to `/venues/dashboard/gigs`. The reason select `#cancellation-reason` is the confirm dialog on that list. On the calendar, More actions then "Cancel gig" opens it when the booking is confirmed. Both flag builds did that. Flags true also requested `/api/billing/getCustomerData`, which 404s on this API; the dashboard still finished loading. That billing miss is not what sends Cancel gig back to the calendar.

The test now follows that calendar path, chooses Availability, and clicks Confirm. Confirm was a no-op until the cancellation message stopped reading `gig.venue.venueName`. Gigs created by the API only store `venueId`. That read threw, the dialog stayed open, and there was no success toast. The message now uses the venue profile name when the gig has no nested venue. After that, the mixed guest-and-artist gig cancelled and deleted, the second artist was declined, and the withdrawn gig was deleted.

## Rules

Checked-in `firestore.rules` and `storage.rules` were loaded by the emulator. They were not edited and not deployed. A venue user was seeded the way a real one is shaped: `users/{uid}` with `venueProfiles`, a completed `venueProfiles/{id}`, an owner `members/{uid}` doc with `role: owner` and `status: active`, and an `artistCRM` entry with `createdAt`. The rules file does not read any of those fields. The only allow is a public read of `venueHireOpportunities`. Everything else is denied.

Observed in the browser, flags false:

- Venue dashboard, gig list, and Contacts: `User snapshot error: FirebaseError: No matching allow statements`. The loading screen stayed up. Contacts never reached the CRM query.
- Public gig page, logged out and as the artist: `[Firestore Error] getGigById: FirebaseError: No matching allow statements`. Apply did not render. The page also logged `Rendered fewer hooks than expected` after that denial.

Client reads and writes the overnight features make from the browser:

| Call | Where | Rules |
| --- | --- | --- |
| `getDocs` `users/{uid}/artistCRM` ordered by `createdAt` | Invite modal, Contacts | Denied. No match for `users`. |
| `getDoc` / `getDocs` `gigs/{id}` | Guest manage page and the public gig page | Denied. No match for `gigs`. |
| Guest press-photo upload | `fetch` to a URL from `POST /api/guest-applications/upload-url` | Not a Storage SDK call, so `storage.rules` are not consulted. On this emulator the URL is never issued: Admin `getSignedUrl` throws `Cannot sign data without client_email`. |
| Gig media upload | Production: `PUT` to a v4 signed URL, then `POST /api/gig-media/commit`. Emulator: `POST /api/gig-media/emulator-upload`, which the API writes with the Admin SDK | The signed URL is not judged by `storage.rules`. The emulator route exists only when `STORAGE_EMULATOR_HOST` is set, so it cannot send the file to Cloud Storage. |
| Close applications, sound engineer, additional notes | `updateGigDocument` on the API | Not a client Firestore write. |
| Accept, decline, cancel, delete, merge, share token, artist apply | API | Not client Firestore or Storage writes. The artist page still needs the `gigs/{id}` read above before Apply is shown. |

`storage.rules` allow any signed-in user to read and write every path. The new media feature does not use the client Storage SDK, so nothing in that file blocked it. No storage rule change is required for the private link.

Proposed Firestore rules, for review only. Not applied:

```
match /users/{uid} {
  allow read: if request.auth != null && request.auth.uid == uid;
  match /artistCRM/{entryId} {
    allow read, write: if request.auth != null && request.auth.uid == uid;
  }
}
match /venueProfiles/{venueId} {
  allow read: if request.auth != null;
  match /members/{memberId} {
    allow read: if request.auth != null && request.auth.uid == memberId;
  }
}
match /gigs/{gigId} {
  allow read: if true;
  allow write: if false;
}
match /artistProfiles/{profileId} {
  allow read: if request.auth != null;
  match /members/{memberId} {
    allow read: if request.auth != null && request.auth.uid == memberId;
  }
}
```

Writes for gigs, applications, media metadata, and merges stay on the API. The public `gigs` read is what the logged-out guest page needs. The checked-in file is now the live production rules. The snippets above were the earlier proposal against the stub and were not applied. The private-subcollection proposal is in `docs/proposed_rules_changes.md`.

## Fixes

- `GigApplications.jsx`: the running-order row had Accept and View, and no Decline. Decline now calls the same `handleReject` as the older application tiles.
- `Gigs.jsx`: cancelling a confirmed artist no longer reads `gig.venue.venueName` when the gig only has `venueId`. The message uses the venue profile name.
- `gigin-api/config/admin.js`: the Admin app is given `{projectId}.firebasestorage.app` as its bucket, and the storage emulator host when the other emulators are on.
- `gigin-api/routes/gigMedia.js` and `GigMediaPanel.jsx`: on the storage emulator, the browser posts the file to the API and the API writes it. Production still returns a signed `PUT` URL. `firestore.rules` and `storage.rules` were not changed.
- `e2e/overnight.browser.spec.js`: calendar cancel, the file and zip download, and the selectors above. No change to the rules files.

## Still unproven

- Overview, NextGig, and EditGigTimeModal after a confirmed guest.
- Reopening applications in the browser.
- An oversize media file in the browser. Guest press-photo upload still cannot get a signed URL on the emulator (`Cannot sign data without client_email`). Gig media on the emulator uses the API write above. A signed `PUT` to Cloud Storage, on Cloud Run, is still unproven.
- Open Graph as a crawler would see it. Hosting still serves one `index.html` for every path.
- The public gig page threw `Rendered fewer hooks than expected` when `getGigById` was denied. That was the stub rules. `gigs/{id}` is publicly readable in the live rules, and the guest page loaded in the later runs.
- Issue 1 in `docs/open_issues_jez_mode.md` is still unresolved. Do not merge to `main` on the strength of this run.

`npm run build` passed (`vite build`, about 9.4s). The existing chunk-size warning is unchanged.

## Defaults

- `applicationsOpen` missing means open. New gigs are stored with `applicationsOpen: true`.
- Closing applications does not change `status`.
- Media: 50 MB per file, 250 MB per gig, 30 files. Types: JPEG, PNG, WEBP, HEIC, HEIF, MP4, MOV, WEBM.
- Share token is 32 random bytes, hex. Only the SHA-256 hash is stored.
- Public media routes: 60 requests per 15 minutes per IP. Link preview: 120 per 15 minutes.
- After a merge, guest-supplied contact fields fill blanks on the kept contact. Profile `artistId` wins for who the contact is. Past guest applications keep their guest id and gain `linkedArtistId`.
- Name matches use the act name exactly as stored. Nothing merges until Merge is clicked.
- Link preview redirects humans to `PUBLIC_APP_URL` or `http://localhost:5173`.
- "Email confirmed acts" is only offered once a new link has been created in that session, because the raw token is not stored.

## Check by hand

- Cloud Run service account for the API needs permission to sign Storage URLs: `iam.serviceAccounts.signBlob` (Service Account Token Creator on itself) and permission to create objects in the dev bucket. Confirm a gig media upload on giginltd-dev. Guest press-photo upload on the emulator still returns 500 (`Cannot sign data without client_email`). Gig media on the emulator goes through the API.
- WhatsApp and iMessage will not show the per-gig preview until hosting sends those crawlers to `GET /api/link-preview/gig/:gigId` (include `inviteId` when the link is private). Hosting still serves one `index.html` for every path. Do not add that rewrite until you are ready to deploy. Set `PUBLIC_APP_URL` on the API to the site origin.
- The Trigger Email extension on a live project will send whatever is written to `mail`. Tests used `test+…@example.com` and read the `mail` collection on the emulator.
- Dev versus prod: this work is not deployed. Prod data and Stripe live keys were not used.
- The checked-in `firestore.rules` is now the live production text. It was not deployed. The browser spec no longer publishes a wider ruleset onto the emulator.

## Files that were already dirty

Untracked `gigin-api/exec -l --version/` was left untracked. No older uncommitted product edits were swept in. `design_handoff_guest_apply/` was not committed.

## Still open

- Issue 1 in `docs/open_issues_jez_mode.md` (logged-in artist regression on real prod-shaped data) is still unresolved.
- Issue 2 is built. The browser test linked the guest account and merged only after Merge was clicked.
- A gig can still be closed with `status: "closed"` from the older close-gig action. That path was left as it was.

## Live rules and private gig data

`firestore.rules` was replaced with the live production rules and committed. Nothing was deployed. The first browser run on those rules, before sensitive fields were moved, used the real file (the emulator-only allow-all publish was removed).

| # | Result |
| --- | --- |
| 1 invite | Pass |
| 2 guest apply | Pass |
| 3 existing account | Pass |
| 4 accept and decline | Pass |
| 5 close applications | Pass |
| 6 sound engineer and notes | Pass |
| 7 link and merge | Pass |
| 8b private-link download | Pass |
| 8 share link, wrong type, revoke | Fail. Test 8b had already created a link, so the button read "New private link" and the test waited for "Create private link". |
| 9 artist apply, cancel, decline, delete | Pass |
| 10 console | Fail. `venueHireOpportunities` has no match in the live rules, so the dashboard listener is denied. Declining an artist also threw in `sendGigDeclinedEmail` because `gig.venue` was missing, and `mail` documents were written with `to: undefined`. |

`venueHireOpportunities` is not in the live rules. The listener error is ignored in the browser spec. The rules file was not edited to add it.

### Where sensitive fields were stored

All of these were on the world-readable `gigs/{id}` document, either as top-level fields or inside `applicants[]`.

| Field | Written | Read |
| --- | --- | --- |
| Guest email, phone, instagram | `guestApplications.js` `applicantRecord` / `writeApplicant`; magic-link and edit rewrite the same array | Guest manage and withdraw, lookup, CRM upsert, accept and decline emails in `gigs.js`, `confirmedActEmails` in `gigMedia.js`, venue guest panel in `GigApplications.jsx`, confirmed-act notes in `GigDetailsPanel.jsx`, `Overview.jsx` `guestAsMusician`, `ArtistCRM.jsx` previously-booked guests |
| Links, note, tech needs (`needs`, `bringOwn`), members, assets | Same guest write | Guest manage page, venue guest panel, confirmed-act requirements |
| Press photo URL and photo path | Same guest write, after `publicDownloadUrl` | Venue guest panel and booked tiles |
| `manageTokenHash` | Guest create, and magic-link rewrote it onto `applicants[]` | `findByToken` scanned `applicants[]` |
| Sound engineer name, contact, last edited | `GigDetailsPanel` `saveSoundEngineer` via `POST /api/gigs/updateGigDocument` | Gig details tile, from the client gig snapshot |
| `media[]` paths and `mediaShareTokenHash` | `gigMedia.js` commit, share, revoke | Media panel from the gig snapshot; public share routes queried `gigs` where `mediaShareTokenHash` matched |
| `internalNotes` | `GigDetailsPanel` and the gig sidebar via `updateGigDocument` | Notes tile. Left on the public gig. |

### What moved

Guest email, phone, instagram, links, note, tech needs, press photo, assets, members, and `manageTokenHash` now go to `gigs/{gigId}/guestApplicants/{applicantId}`. The `applicants[]` stub keeps id, type `guest`, status, display name, set ids, `userId` and `linkedArtistId` when linked, timestamps, and the non-contact fields the running order already uses (`viewed`, `invited`, `guest`, `sentBy`, `fee`).

Sound engineer name and contact, `media[]`, and `mediaShareTokenHash` go to `gigs/{gigId}/private/details`. Share-token lookup is a collection-group query on `private`. The venue gig page, Overview, and previously-booked Contacts load those fields from `POST /api/gigs/privateBundle`. Accept, decline, and CRM upsert read the private guest document. Client writes of `applicants` are stripped back to the stub before they are saved.

`internalNotes` is still on `gigs/{id}`. That document is publicly readable, so the notes are a public-read risk.

`system/metadata` allows anyone to create, read, and update it, and nobody to delete it. The only caller is `incrementProClicks` in `src/services/client-side/reports.js`, which creates the document and increments `proClicks`.

Proposed rules for `guestApplicants` and `private` are in `docs/proposed_rules_changes.md` only. `firestore.rules` was not edited for them and nothing was deployed.

### After the move

`gigin-api/test/overnight.test.js` passed (1 test, about 8.8s). A signed-out read is the Admin SDK read of the public gig document in that test, plus the browser spec's unauthenticated emulator REST read. Neither contains the guest email, the manage token, the sound-engineer contact, or a `gig-media/` path.

Second browser run, same live rules, all `VITE_FEATURE_*` false:

| # | Result |
| --- | --- |
| 1–7, 8b, 8, 9 | Pass. Test 9 includes the mixed guest and artist gig, calendar cancel, decline, and delete. |
| 10 | Fail. Test 2 logged a 500 from `POST /api/guest-applications/upload-url` (`Cannot sign data without client_email`). The guest application still completed. Test 8 logged a 404 for `GET /api/gig-media/share/:token` after Revoke, which is the response the test asserts as "This link is no longer available." |

`npm run build` passed (`vite build`, about 73s). The existing chunk-size warning is unchanged.

A second full browser run was the retry. Test 10 failed again, for the two console lines above, so it was left there.
