Implement the venue gig table redesign described in `design_handoff_gig_table/README.md`.

- Visual reference: `design_handoff_gig_table/gig-table-2a.html`. Open it and match it exactly. It's a design reference, so don't copy its markup.
- Files to change: `src/features/venue/dashboard/Gigs.jsx` (table view only, `gigsView === 'table'`), `src/features/venue/dashboard/Sidebar.jsx`, `src/assets/styles/shared/dashboard.styles.css`, `src/assets/styles/host/host-dashboard.styles.css`, `src/assets/global.styles.css` (new tokens + Geist fonts).
- Keep all existing data logic, grouping (`groupedGigs`), `getStatusDisplay`, permission checks (`hasVenuePerm`), API calls, modals and navigation. Re-enable the commented-out selection logic for bulk actions.
- Don't touch the calendar view (`GigsCalendarReact`) beyond making it sit inside the new shell.

Work in this order and stop after each step so I can review:
1. Tokens + fonts in `global.styles.css`.
2. Sidebar (expanded + collapsed rail).
3. Top bar + summary tiles (URL-backed filter).
4. Table rows, status pills, share, ⋯ menu restyle.
5. Past gigs toggle + bulk action bar.
