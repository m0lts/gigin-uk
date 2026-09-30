Implement the venue gig details redesign described in `design_handoff_gig_details/README.md`. It builds on the gig table redesign in `design_handoff_gig_table/` (same tokens, fonts and sidebar), so do that one first if it isn't merged.

- Visual reference: `design_handoff_gig_details/gig-details-1b.html`. Open it, use the Open / Confirmed switch at the top, and match it exactly. It's a design reference, so don't copy its markup.
- Files to change: `src/features/venue/gigs/pages/VenueGigPageShell.jsx` (header + two-column layout), `src/features/venue/gigs/pages/panels/GigDetailsPanel.jsx` (artist-booking branch: running order), `src/features/venue/dashboard/GigApplications.jsx` (applicant row rendering only), `src/features/venue/gigs/components/BookingSummarySidebar.jsx` (right rail), `src/assets/styles/host/venue-gig-page.styles.css`.
- Scope is **artist booking** gigs. Leave venue-hire branches (`isVenueHirePage`, `venueHire*` props) working as they are today.
- Keep all existing data logic, permission checks, API calls and modals: `handleAcceptApplication` / `handleAccept`, `handleDeclineApplication` / `handleReject`, `handleCompletePayment`, `PaymentModal`, `ApplicantTechSetupModal`, `GigInvitesModal`, `handleSaveNotes`, cancel/delete/close/reopen, the options menu.

Work in this order and stop after each step so I can review:
1. Top bar (breadcrumb + actions) and page header (date line, title, status pill).
2. Two-column layout + right rail shell (sticky).
3. Running order timeline: ops rows + set cards (header row only).
4. Open set: applicant rows, Accept / View, "See all" + "Invite to this set".
5. Booked set: artist block, status chips, Tech setup / Message.
6. Right rail: Fill the night (open) / Fully booked checklist (confirmed), Documents, Notes.
