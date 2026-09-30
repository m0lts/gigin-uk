Implement the venue gig calendar redesign described in `design_handoff_gig_calendar/README.md`. It builds on `design_handoff_gig_table/` (tokens, fonts, sidebar, top bar), so do that first if it isn't merged.

- Visual reference: `design_handoff_gig_calendar/gig-calendar-2a.html`. Open it, try Month / Week / Season, the filter chips and clicking gigs, and match it exactly. It's a design reference, so don't copy its markup.
- Files to change: `src/features/venue/dashboard/GigsCalendarReact.jsx` (the `gigsView === 'react'` branch of `Gigs.jsx`), `src/assets/styles/host/gigs-calendar-react.styles.css`. New files are fine for the three views and the side panel (e.g. `calendar/MonthView.jsx`, `WeekView.jsx`, `SeasonView.jsx`, `CalendarSidePanel.jsx`).
- Replace `react-calendar` with a hand-built CSS grid (Month and Season) and a time grid (Week). Remove the `react-calendar` CSS import once nothing uses it.
- Keep all existing data logic, grouping, permissions (`hasVenuePerm`), API calls (`updateGigDocument`, `updateVenueHireOpportunity`, `postCancellationMessage`), and modals (`InviteAndShareModal`, `FillThisSlotModal`, cancel / delete confirms, venue-hire conversation). The side panel replaces the gig detail / artist booking / venue hire modals, but keep all their actions.

Work in this order and stop after each step so I can review:
1. Calendar header: title, prev / next, Today, view switch (URL-backed), filter chips.
2. Month view grid + gig chips.
3. Right panel: summary state (range stats + Needs action).
4. Right panel: gig selected state (artist booking + venue hire variants), wired to the existing actions.
5. Week view.
6. Season view + regular nights + empty nights.
