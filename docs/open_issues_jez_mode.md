# Open issues: Jez mode and guest apply

Logged 2026-09-30. Status: UNRESOLVED. Decide before anything is merged to `main` or deployed.

## 1. Existing artist profiles and venues: regression risk

No data migration is needed (new fields are additive; nothing has been deleted; feature flags only hide UI). But existing users will meet the changed app, and deploying `jez-mode` to `main` changes the live site for EVERYONE, not just Jez.

Risks to check:
- Flags hide UI for in-flight data: payouts / Stripe Connect setup, finances pages, pending or upcoming paid gigs, chat threads, reviews and disputes, bands. An existing artist owed money or with a paid gig coming up could lose the screen where they manage it. Check what data exists in prod before turning these off for real users.
- The logged-in artist apply flow must be unchanged. A logged-in artist with a profile opening `/gig/:id` must still go through the normal flow, and guests through the guest flow.
- Mixed applicants arrays: ~49 files read `gig.applicants`, but only GigApplications.jsx and GigPage.jsx know about `type: 'guest'`. Other screens (venue calendar, gig table, gig details panel, running order, booking sidebar, artist dashboards, badge counts, emails, scheduled functions) may miscount, crash or mis-render a guest entry that has no artist profile.
- Server changes to accept / decline / cancel / delete in gigin-api/routes/gigs.js skip profile reads for guests. Regression-test the normal artist path on all of them.
- Test with a copy of real prod-shaped data (dev project), including an existing artist, an existing paid gig and an existing conversation.

## 2. Guest vs real account, and the venue contacts list

How it works today (from the code):
- A venue's contacts live in `users/{venueOwnerId}/artistCRM`. `artistId` set = linked to a Gigin profile (details pulled live from the profile). `artistId` null = standalone contact (not on Gigin).
- A guest submission upserts a standalone contact (matched by the invite's crmEntryId, else email/phone). It never sets `artistId`.
- When a guest later makes an account, `POST /api/guest-applications/:token/link` only stamps `userId` on the guest applicant entry. The contact stays unlinked and the applicant stays `type: 'guest'` with a guest id (not the artist profile id), so the venue still sees a guest.

Problems this creates:
- An existing Gigin artist applies as a guest: a second, unlinked contact appears next to their linked one.
- A guest later makes an account: two records for the same act.
- Same act, different email or phone across applications: more duplicates.
- Gig history applied for as a guest does not appear on the new profile.

Options:
A. Stay guest forever on the venue side; merge by hand. Simple, but messy over time.
B. Auto-link when the guest creates an account from their private application link (the token proves they control the application). Set `artistId` on the contact and mark the guest applicants as linked to the profile; display resolves to the profile. Safe because of the token.
C. For weaker matches (same verified email with no token, phone only, similar act name), show Jez a "merge?" prompt. Never auto-merge on name alone.

Suggested direction (not decided): B for the token path, C for probable matches, and stop duplicates at the source: if a guest's email matches an existing Gigin account, tell them to log in (or attach the application to that profile) instead of creating a parallel contact. Keep the guest-supplied details as a fallback; let profile fields win on display.

Questions to settle: what does Jez see after a merge (profile page vs guest details)? Which record wins for contact details? Do past guest gigs get re-pointed to the profile id or just linked by `linkedArtistId`?


## DECISION 2026-09-30: guest vs account/contacts = B + C + prevent duplicates at source. MUST BE BUILT.
- B: guest creates account via private token -> set artistId on the venue contact and userId on the guest applicant(s). Build with Phase 6.
- C: weaker matches (same email/act name, no token) -> "merge?" prompt to Jez. Never auto-merge on name alone.
- Source prevention: on guest submit, reuse an existing contact with the same email; if email matches an existing Gigin account, ask them to log in.
- Do before Jez has many guest contacts.
