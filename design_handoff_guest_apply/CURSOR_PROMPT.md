Implement the artist-side guest application flow described in `design_handoff_guest_apply/README.md`. Launch venue: Jesus College Bar, Cambridge.

- Visual reference: `design_handoff_guest_apply/guest-apply.html`. Open it and click through the mobile frame (starting in the WhatsApp message) and the desktop frame, then check each edge state. Match it exactly, mobile first. It's a design reference, so don't copy its markup.
- Files to change: `src/features/gig-discovery/GigPage.jsx` (guest branch + apply wizard), `src/assets/styles/artists/gig-page.styles.css`, `src/services/client-side/gigs.js` (invite lookup), `src/services/utils/techRiderCompatibility.js` (guest input mode). New: `src/features/gig-discovery/guest/` (`GuestApplyWizard.jsx`, `GuestWhoStep.jsx`, `GuestAssetsStep.jsx`, `GuestTechStep.jsx`, `GuestReviewStep.jsx`, `GuestApplied.jsx`, `ManageGuestApplication.jsx`), a route `/gig/:gigId/application/:token`, a server endpoint + email template.
- Guests never see login, profile creation, fees, ticketing or messaging. Keep the existing logged-in artist flow working unchanged.
- Reuse existing pieces: the slot data behind `gig-page-slot-carousel`, `getTechRiderForDisplay` / the venue tech rider, `computeCompatibility` groups, `getGigInviteById`, `useBreakpoint`, and the app's Geist / `--gn-*` tokens.

Work in this order and stop after each step so I can review:
1. Data model + server: the `guestApplications` shape, an unauthenticated create/update/withdraw endpoint (rate-limited), signed image uploads, the manage token.
2. Gig page guest view: invite greeting and pre-fill, set list, "what the bar provides", where, the sticky Apply bar (mobile) / Apply card (desktop), and og tags for link previews.
3. Apply step 1 (Who you are) + duplicate detection.
4. Apply step 2 (Photo and links) + upload errors.
5. Apply step 3 (Tech rider) + compatibility summary.
6. Apply step 4 (Note and review) + offline draft saving and retry.
7. Applied screen + account prompt; confirmation email.
8. Manage application page (view, edit, withdraw).
9. Edge states: closed, past, expired invite, invite opened by someone else.
10. Venue side: show guest applicants (with a "Guest" tag) in the applications list and running order.
