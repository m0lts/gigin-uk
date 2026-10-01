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

## Test results

`gigin-api/test/overnight.test.js` was run with `firebase emulators:exec --only auth,firestore,storage --project giginltd-dev`. The API listened on port 8099 because 8080 was already taken. The suite is one Node test. It passed (about 2.2s). A second run in this follow-up also passed. That test uses the Admin SDK, so the checked-in `firestore.rules` (which deny almost every client read) do not apply to it.

Browser tests are in `e2e/overnight.browser.spec.js`. They were not in the repo, so they were written for this run. They use the Vite dev server, the local API, and the emulators. Addresses are `test+…@example.com` only.

| # | Check | Result | Why |
| --- | --- | --- | --- |
| 1 | Two-slot gig and invite from Contacts | Fail | The gig was created through the same API the form uses. The venue dashboard opened, then stayed under the loading screen with "All 0" gigs, so the contact invite was never clicked. Two attempts, then stopped. |
| 2 | Guest apply, photo, mail, manage, withdraw, no duplicate contact | Pass | In the browser: press photo, note, private-link edit, withdraw, and a second gig with the same email left one contact. The API test also queued the confirmation in `mail`. |
| 3 | Existing Gigin email told to log in | Pass | The guest form showed "This email already has a Gigin account. Log in to apply." and stayed on "Who are you?". The API test returns the same 409. |
| 4 | Guest tag, accept, decline, emails, Overview / NextGig / list / Contacts / EditGigTimeModal | Fail | Both guest applications were sent. Accept, decline, and the other surfaces sit on the venue dashboard, which never left the loading screen. |
| 5 | Close prompt, manual close and reopen, server reject | Fail in the browser. Pass on the API | The browser never reached the switch. The API test closes applications and the next guest apply returns 409. Reopen was not clicked. |
| 6 | Sound engineer and additional notes persist | Fail in the browser. Pass on the API | The browser never reached the fields. The API test writes both and reads them back. |
| 7 | Token link and manual merge | Fail | Signup from the guest page reached "Verify your email". The next venue login could not see the form because that screen was still up, so Merge was not clicked. The API test does link the contact and merge only after an explicit call. |
| 8 | Upload, private link, download, zip, revoke, oversize and wrong type | Fail in the browser. Partial on the API | The media panel is on the venue gig page, which did not load. The API test rejects a wrong type and a 60 MB file, creates a share, and gets 404 after revoke. A real file upload, single download, and zip were not executed. The guest press photo in test 2 did upload. |
| 9 | Logged-in artist apply, accept, decline, withdraw, delete, mixed gig | Fail | After sign-in the gig page still showed the logged-out "Apply to play" button, so the artist session was not ready. The API test covers artist apply, withdraw, and delete. |
| 10 | Console and server logs | Pass | The pages that loaded did not report an unexpected browser error or unhandled rejection. The API log for the passing Node test had no unhandled error. A revoked share correctly returned 404. |

## What was tried, and what was not changed

No product file was changed in this follow-up. The failures were in the browser harness, and the second attempt on the venue dashboard did not clear it.

1. The gigs page opens on the calendar, not the table. The spec now clicks Table. That was not enough: a full-page loading screen stayed on top and the count stayed at 0.
2. `firestore.rules` in the repo only allows public read of venue-hire documents. The guest page then crashed to "Oops! The app hit a snag." Updating rules inside the running emulator (not in the repo) let tests 2 and 3 pass, and the venue list queries never finished, so the loading screen stayed. A follow-up that would have written allow-all rules into `firestore.rules` was not done. That file is unchanged.

The login helper now waits for the auth-emulator response and clears IndexedDB before the next sign-in, so a verify-email screen cannot block the venue login. That helper was not re-run after the rules change was dropped.

## Fixes

None in application code. The new browser spec, Playwright config, and dev dependency are the only additions.

## Still unproven

- Invite from Contacts in the browser.
- Accept, decline, the close-applications switch, sound engineer, and additional notes in the browser.
- Overview, NextGig, Contacts, and EditGigTimeModal after a confirmed guest.
- Merge clicked in Contacts. The API merge is proven; the prompt is not.
- Logged-in artist apply, withdraw, and delete in the browser.
- A gig media upload, single download, and zip. Signed URLs against Cloud Run are still unproven. The guest press photo upload did succeed against the emulator.
- Open Graph as a crawler would see it. The API test checks `og:title`. Hosting still serves one `index.html` for every path.
- Issue 1 in `docs/open_issues_jez_mode.md` is still unresolved. Do not merge to `main` on the strength of this run.

`npm run build` passed after the browser spec was added.

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

- Cloud Run service account for the API needs permission to sign Storage URLs: `iam.serviceAccounts.signBlob` (Service Account Token Creator on itself) and permission to create objects in the dev bucket. Confirm a gig media upload on giginltd-dev. The guest press photo did upload in the browser test against the emulator.
- WhatsApp and iMessage will not show the per-gig preview until hosting sends those crawlers to `GET /api/link-preview/gig/:gigId` (include `inviteId` when the link is private). Hosting still serves one `index.html` for every path. Do not add that rewrite until you are ready to deploy. Set `PUBLIC_APP_URL` on the API to the site origin.
- The Trigger Email extension on a live project will send whatever is written to `mail`. Tests used `test+…@example.com` and read the `mail` collection on the emulator.
- Dev versus prod: this work is not deployed. Prod data and Stripe live keys were not used.
- The checked-in Firestore rules are a stub. A normal dev session that is not using the emulators is unaffected. Emulator UI tests cannot read gigs until those rules match the rules you actually deploy.

## Files that were already dirty

Untracked `gigin-api/exec -l --version/` was left untracked. No older uncommitted product edits were swept in. `design_handoff_guest_apply/` was not committed.

## Still open

- Issue 1 in `docs/open_issues_jez_mode.md` (logged-in artist regression on real prod-shaped data) is still unresolved.
- Issue 2 is built. The API test covers link and merge. The browser merge was not reached.
- A gig can still be closed with `status: "closed"` from the older close-gig action. That path was left as it was.
