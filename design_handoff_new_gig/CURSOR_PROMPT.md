Implement the new gig flow redesign described in `design_handoff_new_gig/README.md`. It builds on `design_handoff_gig_table/` (tokens, fonts) and `design_handoff_gig_calendar/` (calendar, side panel). Do those first if they aren't merged.

- Visual reference: `design_handoff_new_gig/new-gig-2a.html`. Open it, use the New gig split menu and the Jump to buttons, click through all three routes to the end, and match it exactly. It's a design reference, so don't copy its markup.
- Files to change: `src/features/venue/dashboard/AddGigsModal.jsx` (orchestration, submit), `src/features/venue/dashboard/BookNewEventWizard.jsx` (fields), `BookNewEventListingPreview.jsx` (live preview), `Gigs.jsx` (New gig split button), `GigsCalendarReact.jsx` (day "+" opens Quick create), `src/assets/styles/shared/modals.styles.css`. New components are fine: `NewGigQuickDrawer.jsx`, `NewGigFullForm.jsx`, `NewGigWizard.jsx`, `NewGigCreatedPanel.jsx`, and a shared `useNewGigDraft` hook.
- Scope: `addGigsMode === 'bookNew'` (find an artist) and `'addExisting'` (already booked), plus templates. **Leave venue hire (`bookingMode: 'rental'`, `paymentModel: 'artist_pays_venue'`) and edit mode on the current UI** for now.
- Keep all existing data logic and API calls: `postMultipleGigs`, `saveGigTemplate`, template apply, `createGigInvite` / `inviteToGig` / `sendGigInvitationMessage`, `createArtistCRMEntry`, permissions (`hasVenuePerm`), validation (`isBookNewGigComplete`, `getFirstMissingField`), and multi-date + multi-slot behaviour.

Work in this order and stop after each step so I can review:
1. `useNewGigDraft` hook: one draft shape shared by all three routes, mapped to the existing gig fields.
2. New gig split button + route menu + "last used" preference.
3. Full form (modal) with live preview and readiness checklist.
4. Created panel (offer the gig / publish / finish setting up), shared by all routes.
5. Quick create drawer (from calendar "+" and the menu), including "Use the full form instead".
6. Step-by-step wizard (full page).
7. Analytics event for which route created each gig.
