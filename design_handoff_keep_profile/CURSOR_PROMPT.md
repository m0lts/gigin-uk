Implement "Keep my profile", the venue finder and the addendum (press kit, contact visibility, venue page, artist home) described in `design_handoff_keep_profile/README.md`. It follows on from guest apply (`design_handoff_guest_apply/`) and builds on `design_handoff_multiset_apply/` and `design_handoff_applicant_profile/`. Build those first.

- Visual reference: `design_handoff_keep_profile/keep-profile.html`. Frame 1a is the full mobile flow: tap Keep my profile → open the email → Confirm → Find venues. Sections 8 to 12 are the addendum. 1g, 4e, 5c, 8h, 8i, 11c, 11d and 12d are artist-side desktop. 8j, 8k and 10h are the venue console. Match it exactly. It's a design reference, so don't copy its markup.
- The domain is **giginmusic.com** everywhere (links, og tags, profile URLs). Emails come from **noreply@giginmusic.com**.
- Everything goes behind four new flags in `src/config/features.js` (default off): `keepProfile`, `publicProfile`, `venueFinder`, `pressKit`. The README says what each one hides when it's off. The artist contact visibility rules are not flagged. They apply always.
- Reuse what exists: the `GuestApplied`, `GuestTechStep` and `ManageGuestApplication` components and the `ga-*` styles, `checkGuestEmailAccount`, `linkGuestApplication`, `buildGuestTechRider`, `computeCompatibility`, `useMapbox`, the `artistProfiles` fields (`name`, `bio`, `heroMedia`, `spotifyUrl`, `youtubeUrl`, `instagramUrl`, `websiteUrl`, `techRider`), the `/artist/:artistId` (`ArtistProfileViewer`), `/find-venues` (`VenueFinder`) and `/venues/:venueId` (`VenuePage`) routes, the existing gig page running order, and the guest email template in `gigin-api/routes/gigs.js` (`emailGuest`).
- Privacy is a requirement, enforced on the server:
  - Phone and email are never in public reads. They come only from the contact endpoint, which checks for an application to, or a booking by, the requesting venue.
  - Venue contact placeholders are static grey lines, and the real values are never sent to a viewer who isn't allowed them.
  - Press kit files sit in private storage, served by short-lived signed URLs after a confirmed-booking check.
  - Pending profiles are never readable, and nothing goes live until the confirm link is tapped.
- Keep the "Offer" wording on the venue side. Don't add payments, fees, ticketing or chat. Don't modify Sidebar.jsx or the sidebar styles in dashboard.styles.css. They're already final.
- The venue specs and contact details in the finder are sample data. Seed `listedVenues` with empty fields for Jez to fill in, not with the prototype values.

Work in this order:
1. Data + server: the `artistProfiles` new fields + private contact subdoc, `profileTokens`, the keep-profile / confirm / edit-link endpoints, the artist-contact and venue-contact endpoints with their access checks, the `pressKit` storage + rules + download endpoint, `venues.finderListing` + `contactVisibility`, `listedVenues`, `venueClaims`, Firestore and Storage rules, and the four flags.
2. The offer card in `GuestApplied` (rich / sparse / no photo / no email / account exists / Not now), plus making `GuestWhoStep` non-blocking for existing accounts.
3. The What we'll keep screen, the confirm email, the expired / used link states and the "Your profile is live" screen with copy + share.
4. The public profile at `/artist/:slug`: sections, hidden-when-empty, the contact area for each viewer type (section 9 table), Played at, og tags and the generated no-photo og image.
5. The venue finder: list, filters, the On Gigin / Listed distinction, map, the contact strip on each card (section 10 table), View venue, the Send my profile sheet (request / message / copy), no-results and empty-area states.
6. The venue page as artists see it (On Gigin and Listed), the contact block, Claim this venue, and Venue Settings › Finder listing with "Who can see my contact details" and the live preview.
7. The press kit: the artist Press kit screen + editor row, the always-visible Download press kit button (active / greyed with tooltip or tap explanation / downloading / error / none yet / access ended), and the press kit block on the confirmed gig page.
8. The returning artist and the artist home: the pre-filled wizard with "Also update my profile", the manage-page profile card, the light editor (hide / delete), the quiet reminder in the accepted / declined emails, and `/home` for every logged-in artist, including existing ones.

Build all steps in one go without pausing for review. When you're done, give me a short summary of what changed, any assumptions you made, and anything you couldn't finish.
