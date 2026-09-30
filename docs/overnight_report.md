# Overnight report

Branch: `jez-mode`. Nothing was pushed, deployed, or merged. Firebase project used for code is dev-shaped (`giginltd-dev`). Production (`giginltd-16772`) was not used. No real email addresses were written.

## Parts

| Part | Result | Notes |
| --- | --- | --- |
| 1. Invite from Contacts | Done | Picking a contact already existed on the gig page and in the share modal. Private gigs from the gig-page contact list now create an invite and email or copy that link. Guests are still email-only. After any new invite is created, the invite modal offers Contacts. |
| 2. Close applications | Done | New field `applicationsOpen`, default true when missing or on create. The gig-page switch writes that field instead of `status`, so closing applications does not mark the gig cancelled. After an accept, if every slot is filled the venue sees "Close applications now?" (Close / Keep open). If some slots are still open they see "Close applications for the rest". Guest and logged-in apply are rejected with "Applications for this gig are closed." The guest page uses the existing closed message. Manage and withdraw are unchanged. |
| 3. Confirmed gig and media | Done, signing not verified here | Running order, times, sound engineer, and additional notes were already on the page. Confirmed acts now list tech needs, what they bring, and compatibility. Photos and videos use the signed-upload pattern. Share links store only a SHA-256 hash. The public page needs no login and offers single download and a server-streamed zip. Revoke deletes the hash. |
| 4. Guest linking | Done | Private-token link sets `userId` and `linkedArtistId` on the guest applicant and `artistId` on the venue contact. The guest id is kept. Same email reuses one contact and no longer clears an existing `artistId`. An email that already belongs to a Gigin account is told to log in. Contacts shows "This looks like &lt;name&gt;: merge?" and merges only after a click. |
| 5. Notes and link previews | Done | Sidebar "Notes" is now "Additional notes" (same `internalNotes` field as the main tile). The old box that saves `notes` is labelled "Listing note" and is not on the card layout. Open Graph HTML is `GET /api/link-preview/gig/:gigId`. |

## Test results

| # | Check | Result |
| --- | --- | --- |
| 1 | Two-slot gig and invite from Contacts | Not run. Firebase emulators need Java, and this machine has no Java runtime. |
| 2 | Guest apply, mail collection, manage, withdraw, no duplicate contact | Not run. Same reason. The test is written in `gigin-api/test/overnight.test.js`. |
| 3 | Existing Gigin email told to log in | Not run. Covered by that test. |
| 4 | Guest tag, accept, decline, emails, Overview / NextGig / list / Contacts / EditGigTimeModal | Not run in the browser. |
| 5 | Close prompt, manual close and reopen, server reject | Not run. Server reject is in the test. |
| 6 | Sound engineer and additional notes persist | Not run. Save path is in the test. |
| 7 | Token link and manual merge | Not run. Covered by the test. |
| 8 | Upload, private link, download, zip, revoke, oversize and wrong type | Not run. Wrong type, oversize, share, and revoke are in the test. Zip and a real signed upload need Storage and were not executed. |
| 9 | Logged-in artist apply, accept, decline, withdraw, delete, mixed gig | Not run. Apply, accept, decline, withdraw, and delete are in the test. |
| 10 | Console and server logs | Not run. No browser session. |

Run them with Java installed:

```bash
firebase emulators:exec --only auth,firestore,storage --project giginltd-dev \
  'cd gigin-api && GCLOUD_PROJECT=giginltd-dev PORT=8080 node server.js & \
   sleep 3 && node --test test/overnight.test.js'
```

The test refuses to start unless `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST` are set, so it cannot hit dev or production by accident.

`npm run build` passed after parts 1–5.

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

- Cloud Run service account for the API needs permission to sign Storage URLs: `iam.serviceAccounts.signBlob` (Service Account Token Creator on itself) and permission to create objects in the dev bucket. `getSignedUrl` v4 failed closed here because it was not called against Cloud Run. Confirm a guest press-photo upload and a gig media upload on giginltd-dev.
- WhatsApp and iMessage will not show the per-gig preview until hosting sends those crawlers to `GET /api/link-preview/gig/:gigId` (include `inviteId` when the link is private). Hosting still serves one `index.html` for every path. Do not add that rewrite until you are ready to deploy. Set `PUBLIC_APP_URL` on the API to the site origin.
- The Trigger Email extension on a live project will send whatever is written to `mail`. Tests and this run did not write to a live `mail` collection. Guest confirmation, accept, and "Your photos and videos" all write there.
- Dev versus prod: this work is not deployed. Prod data and Stripe live keys were not used.

## Files that were already dirty

At the start of this run the working tree was clean apart from untracked `gigin-api/exec -l --version/` (left untracked). `BookingSummarySidebar.jsx` was edited on purpose: the applications switch, then the notes label. There were no older uncommitted edits left to preserve. `design_handoff_guest_apply/` was not present as an untracked path to commit.

## Still open

- Issue 1 in `docs/open_issues_jez_mode.md` (logged-in artist regression on real prod-shaped data) is still unresolved. Do not merge to `main` on the strength of this run.
- Issue 2 is BUILT, pending test results.
- Browser flows in the table above were not exercised.
- Signed upload and the zip download were not executed against Storage.
- A gig can still be closed with `status: "closed"` from the older close-gig action. That path was left as it was.
