Implement the applicant profile popup described in `design_handoff_applicant_profile/README.md` for the venue gig page (Jesus College Bar). It builds on `design_handoff_multiset_apply/`.

- Visual reference: `design_handoff_applicant_profile/applicant-profile.html`. In frames 1a (Gigin artist) and 1b (guest), try the arrows, Esc, Message (hover it on the guest), the chevron menu, Accept with a set and notes. Match it exactly. It's a design reference, so don't copy its markup.
- Guests and Gigin artists use the same component. The only difference is the Message button (coming-soon popover for artists; disabled with a tooltip for guests). Offer gig in the chevron menu opens the existing Offer a gig modal from `ArtistCRM.jsx`.
- Replace `GuestApplicantPanel` and the "View profile" new-tab link in `GigApplications.jsx` with the new `ApplicantProfileModal` (new: `src/features/venue/gigs/components/ApplicantProfileModal.jsx` + a CSS file). Open it from the name, the photo and "View profile", controlled by `?applicant=<id>`.
- Don't modify Sidebar.jsx or the sidebar styles in dashboard.styles.css. They're already final. Keep the "Offer" wording. Reuse the existing CRM `notes` field, `computeCompatibility` and the accept/decline handlers. Don't add new fields.

Work in this order and stop after each step so I can review:
1. The modal shell: backdrop, panel, top bar, Esc / ← → through the filtered list, the `?applicant` URL param, focus trap.
2. The hero: cover, overlapping avatar, name + Guest / On Gigin tag, meta, stats row, link chips.
3. The Message split button + chevron menu (coming soon / guest tooltip / Offer gig → existing modal).
4. The left column cards: application post, photos and videos grid + lightbox, music players, about, band, tech, history at the bar.
5. The right column: gig status + Accept (inline set chooser) / Decline wired to the existing handlers, Contact links, notes saved to the CRM entry.
6. Data loading for Gigin artists (profile fetch + cache) and linked guests (`linkedArtistId`).
