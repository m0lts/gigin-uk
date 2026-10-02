Implement "apply once to the night, venue assigns the set" as described in `design_handoff_multiset_apply/README.md`. Launch venue: Jesus College Bar (Jez). This builds on the guest flow already on `jez-mode` (`design_handoff_guest_apply/`) and the Console gig details (`design_handoff_gig_details/`).

- Visual reference: `design_handoff_multiset_apply/multiset-apply.html`. Click through A1 (mobile) and V1 (venue): accept, choose set later, drag between sets, swap, undo. Then check every state frame. Match the copy exactly. It's a design reference, so don't copy its markup.
- Key fields: applicant `preferredSlotGigIds: string[]` (`[]` = no preference) and `assignedSlotGigId: string | null`, stored once on the group's `applicationsRootGigId`. Slot docs: `bookedApplicantId`, plus a `status: 'confirmed'` mirror in the slot's `applicants[]` so existing per-slot screens keep working.
- Files to change: `gigin-api/routes/guestApplications.js`, the gigs routes (accept / assign / decline / close), `src/features/gig-discovery/guest/` (`GuestWhoStep.jsx`, `GuestReviewStep.jsx`, `GuestApplied.jsx`, `ManageGuestApplication.jsx`, `GuestGigPage.jsx`, `GuestApplyWizard.jsx`), `GigPage.jsx` (logged-in apply), the venue `GigApplications` page, and the email templates.
- Keep the logged-in artist flow working; it now sends one application too. Read old entries with `slotGigIds` as the preference and de-duplicate by applicant id.

Work in this order and stop after each step so I can review:
1. Data model + migration reads: `applicationsRootGigId`, `preferredSlotGigIds`, `assignedSlotGigId`, `bookedApplicantId`, the confirmed mirror, and public `slots[].taken`.
2. Server: create/patch write once to the root; withdraw allows accepted; the venue accept / assign (transactional swaps) / decline with a 5-minute delayed email + undo / close with declineWaiting.
3. Artist gig page: set rows with Open / Taken / Closed, one "Apply to play", and the full / closed / already-applied banners.
4. Artist step 1 preference block (No preference default, taken disabled, hidden for one set) + review row + applied screen copy.
5. Manage page statuses: accepted with the set to be confirmed, accepted with a set (+ .ics), declined, "I can't play any more".
6. Emails 1–5 and 7 from the README.
7. Venue left-column tabs (Applications / Running order) + the running order timeline with droppable set cards. Then the applicant list: tabs, Prefers filter, cards (Guest tag, music preview via oEmbed, tech, note, preference), Listen / Contact / Decline / Accept panels, toasts with Undo.
8. Venue Sets panel: to-do line, slots, suggestions, the "no set yet" tray, Assign / Change menus, drag and drop (mouse + touch), the withdrawn notice, the conflict state.
9. Sound tech and Notes cards (empty / view / inline edit), then the close applications card (all filled / the rest / closed + reopen), and one-set behaviour (accept = booked, no preference UI).
10. Tablet layout (icon rail sidebar) and a pass on 4–5 set gigs.
