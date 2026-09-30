# Handoff: Venue gig details redesign ("Running order", option 1b)

## Overview
A redesign of the venue **gig details page** (`/venues/dashboard/gigs/gig-applications`, rendered by `VenueGigPageShell` → `GigDetailsPanel` → `GigApplications`) for **artist-booking** gigs. The page shows the night top to bottom as a running order. Each set is a card: open sets list their applicants with Accept inline, booked sets show the artist and what's outstanding. A sticky right rail handles sharing and invites while the gig is open, and becomes a checklist once it's fully booked.

It continues the "Console" look from `design_handoff_gig_table/` (same shell, sidebar, tokens and fonts). Implement that first; this handoff assumes its tokens exist.

The set tabs (`venue-gig-applications-set-tabs`) are replaced by the running order: every set is visible at once.

Venue-hire pages are **out of scope**. Keep their branches working unchanged.

## About the design files
`gig-details-1b.html` is a **design reference built in HTML**: a self-contained prototype that opens in any browser. A switch at the top toggles the **Open** and **Confirmed** states. In Open, "Accept" on an applicant books them into that set so you can see the transition. **Don't copy its markup.** Recreate it in the existing React + plain CSS setup.

## Fidelity
**High-fidelity.** Colours, type, spacing, radii and states are final. Sample data (gig, artists, times, fees, messages) is design-only.

---

## Shell
Same as the gig table handoff: sidebar 248px (Gigs active), window bg `--gn-console-bg` #F6F7F9. Remove the breadcrumbs bar on this route; the top bar replaces it.

## Top bar
Height 64px, bg #FFFFFF, border-bottom 1px #E5E7EB, padding `0 32px`, space-between.
- **Left breadcrumb** (gap 10px, 14px): "Gigs" link (#6B7280, 500) → back to the gigs table · chevron-right 10px #9AA0AA · gig name (600, #0F1115).
- **Right** (gap 10px): "Preview listing" and "Edit gig" secondary buttons (height 34px, padding 0 12px, radius 8px, border 1px #E5E7EB, white, 13.5px/500, hover #F9FAFB), then a 34×34 ⋯ button opening the **existing options menu** (restyled as in the table handoff).
  - Preview listing → existing `onPreviewGigPost`. Label "Preview listing" for artist booking.
  - Edit gig → existing edit flow (`setShowAddGigsModal` with edit data).
  - The existing "invite only" checkbox in the header (`venue-gig-page__invite-only`) moves into the right rail toggles (below).

## Content layout
Scrolling area below the top bar. Padding `28px 32px 40px`. Grid `minmax(0,1fr) 340px`, gap 28px, `align-items:start`. The right rail is `position:sticky; top:0`.

### Page header (left column, margin-bottom 24px, gap 8px)
- Date line: Geist Mono 13px #4B5160, uppercase: `SATURDAY 3 OCTOBER · THE CROWN & ANCHOR` (weekday, day, month, venue name).
- Title row (gap 12px): gig name 30px/600, letter-spacing -0.015em, then the status pill (12.5px/500, padding 3px 8px, radius 6px, 6px dot). Use the table's status mapping (`getStatusDisplay`): "Open for applications" or "Confirmed", etc.

## Running order (left column)
A vertical timeline. Each item is a 3-column grid `56px 24px minmax(0,1fr)`, gap 12px.
- **Time** column: Geist Mono 13px. Sets #0F1115, ops rows #6B7280. For sets, padding-top 16px so the time aligns with the card header.
- **Rail** column: a 2px #E5E7EB vertical line through all items (starts at the first dot, ends at the last). A dot sits on it with a `0 0 0 4px #F6F7F9` ring:
  - Ops row: 8px dot #C9CDD4, margin-top 4px.
  - Set: 12px dot, margin-top 19px. Orange #FF6C4B = open, amber `oklch(0.72 0.15 70)` = accepted/awaiting payment, green `oklch(0.66 0.14 150)` = booked.
- **Content** column: padding-bottom 20px (sets) / 22px (ops).

### Items
Build the list from the gig's timings, sorted by time:
- **Ops rows** (14px #4B5160): Load-in, Sound check, Doors, Break (between consecutive sets), Curfew. Use the fields the gig already stores (load-in / sound check / doors / curfew timings, see `venueHireGigDetailsTimings.js` helpers and `normaliseGig.js`). Skip any that aren't set. Break is derived from the gap between one set's end and the next set's start; omit it if there's no gap.
- **Set cards**: one per slot in the multi-slot group (`multiSlotGigGroup.js` / `linkedGigIds`). Single-slot gigs show one set card.

### Set card
bg white, border 1px #E5E7EB, radius 12px, overflow hidden.

**Header row** (padding 14px 18px, border-bottom 1px #F0F1F3, space-between, gap 12px):
- Left (baseline aligned, gap 12px): "Set N" 16px/600 · time range Geist Mono 13px #4B5160 (`19:30–21:00`, en dash) · slot fee Geist Mono 13px #6B7280 (`£150`, from the slot budget).
- Right (gap 10px): "N applications" 13px #4B5160 · "N new" badge when the slot has unviewed applicants (11.5px/600, #B5462C on #FFEDE7, radius 4px, padding 2px 6px; hidden once booked) · a status pill (12px/500, padding 2px 7px): Open for applications / Awaiting payment / Booked.

**Open set body** (no confirmed applicant): the top **3** applicants, unviewed first, then most recent.
Each applicant row: grid `34px 190px minmax(0,1fr) 64px auto`, gap 14px, padding 12px 18px, border-bottom 1px #F0F1F3, hover bg #FAFBFC.
1. Avatar 34px circle (profile image; initials fallback 12px/600).
2. Name 14px/500, with a 6px #FF6C4B dot after it if unviewed. Sub-line 12.5px #6B7280, ellipsis: `genre · rating`.
3. Their application message in quotes, 13px #4B5160, single line, ellipsis.
4. Proposed fee, Geist Mono 13.5px, right-aligned.
5. Buttons (gap 6px), height 30px, radius 7px, 12.5px:
   - **View** (border 1px #E5E7EB, hover #9AA0AA, 500): opens the existing applicant profile / detail view and marks the application viewed as today.
   - **Accept** (bg #FF6C4B, white, 600, hover #F25A38): calls the existing `handleAcceptApplication` for that slot's `gigId`, which leads into the existing payment flow. For negotiating applicants keep the existing counter-offer UI reachable from View.
   Decline stays in View (not on the row) to keep rows compact.

Footer row (padding 11px 18px, bg #FAFBFC, 13px, space-between):
- "See all N applications" (500, #0F1115, hover orange) → expands the card in place to list every applicant for the slot (same row design). Collapse link "Show fewer".
- "Invite to this set" (envelope icon 11px, 500, #4B5160, hover #0F1115) → existing `GigInvitesModal` scoped to that slot's gigId (keep `gigs.invite` permission check).

If a set has no applicants: one row, padding 18px, 13.5px #6B7280, "No applications yet", with the footer still shown.

**Booked set body** (padding 18px, gap 16px, flex row):
- Avatar 52px circle.
- Name 18px/600, genre 13px #6B7280, then status chips (gap 6px, wrap). Chips: 12px/500, padding 2px 8px, radius 999px, 6px dot, green or amber colours from the status table:
  - Accepted, not yet paid: "Awaiting payment" (amber), "Tech fits" / "Tech check needed" (green / amber, from the applicant tech setup vs venue tech spec).
  - Paid: "Paid £150" (green), "Tech confirmed" (green), "Agreement signed" (green) or "Agreement pending" (amber).
- Right buttons (gap 8px, height 32px, padding 0 12px, radius 8px, border 1px #E5E7EB, 13px/500): **Tech setup** → `ApplicantTechSetupModal`; **Message** → existing messaging for that artist. When awaiting payment, add a primary **Pay now** button (bg #111317, white) → existing `handleCompletePayment` / `PaymentModal`.
- Artist cancellation / remove stays in the ⋯ options menu as today.

## Right rail (340px, gap 14px)
All cards: bg white, border 1px #E5E7EB, radius 12px, padding 18px. Card titles 15px/600.

### While any set is open: "Fill the night"
- Title row: "Fill the night" + `N OF M SETS BOOKED` (Geist Mono 13px #4B5160).
- Progress: grid of M equal segments, gap 4px, height 6px, radius 3px. Booked = #FF6C4B, open = #E5E7EB.
- **Share the listing** (section label 12px/500, uppercase, letter-spacing .05em, #6B7280):
  - Link field: height 38px, border 1px #E5E7EB, radius 8px. The URL in Geist Mono 12.5px #4B5160 (ellipsis), and a "Copy" button divided by a left border. Shows "Copied" for 1.4s. Uses the existing `handleCopyGigLink` / `copyToClipboard`.
  - "Invite from My Contacts" primary button (height 38px, bg #111317, white, 13.5px/500, radius 8px, address-book icon) → `GigInvitesModal` for the whole gig.
- Toggles (border-top 1px #F0F1F3, padding-top 14px, gap 12px). Each: label 13.5px/500 + sub-line 12px #6B7280, and a 32×18 switch (on #111317, off #C9CDD4, 14px white knob, 150ms):
  - "Show on venue profile" / "Anyone can find and apply" → the existing `showVenueProfileVisibilityToggle` / `gigInfo.private` (inverted).
  - "Accepting applications" / "Turn off to close the listing" → existing close / reopen (`handleCloseGigLocal`, `handleReopenGig`).
  Respect `canUpdateGigs`: hide the toggles if the user can't update.

This replaces `SendGigDetailsTile`, `InviteArtistPromoterTile` and `ArtistFillThisSlotTile` for artist booking.

### When every set is booked: "Fully booked"
- Header: 36px green circle with a check (bg `oklch(0.95 0.04 150)`, icon `oklch(0.45 0.11 150)`), "Fully booked" 15px/600, sub-line 12.5px #6B7280 "N days to go · N things left to do" (or "All done").
- Checklist (border-top, padding-top 14px, gap 10px), 13.5px rows: a 16px status circle (green ✓ / amber !) + label, and a Geist Mono 12px #6B7280 value on the right:
  - Payments `2/2 PAID` · Tech setup `2/2 OK` · Agreements `1/2 SIGNED` · Gig details sent `29 SEP` (date sent, or a "Send" action if not sent, via the existing send-gig-details flow).
- Primary button (height 38px, bg #111317): the single most useful next action, e.g. "Chase Maya for signature". If nothing is outstanding, hide it.

### Documents (always)
List of rows (padding 10px 12px, border 1px #F0F1F3, radius 8px, 13px, ellipsis) with an optional state tag (11.5px/500, radius 4px, padding 1px 6px): "Signed" green, "Unsigned" amber. Performance agreements appear once artists are booked; the venue tech spec is always there. Use the existing documents/agreements source. Clicking opens the document.

### Notes (always)
"Notes" title + the gig notes, 13px, line-height 1.55, #4B5160. Click to edit inline, saved with the existing `handleSaveNotes`.

## States
- **Open**: at least one set without a confirmed applicant. Right rail = Fill the night.
- **Accepted, awaiting payment**: set card shows the booked block with amber dot/pill/chips and Pay now. Counts towards "N OF M" only once paid (match current "booked" definition).
- **Confirmed**: every set booked. Right rail = Fully booked checklist. Gig pill "Confirmed".
- **Past / cancelled**: keep current behaviour for now; show the running order read-only (no Accept, no rail share card).

## Interactions summary
- Accept → existing accept flow → payment; the set card switches to the booked block.
- View → applicant detail. See all → expand set. Invite to this set → invites modal (slot).
- Copy → copy link, "Copied" 1.4s. Toggles → visibility / close-reopen.
- Tech setup → tech modal. Message → messages. Pay now → payment modal.
- Transitions: bg colours 150ms, toggle knob 150ms.

## Tokens
Reuse the tokens from `design_handoff_gig_table/README.md` (`--gn-ink`, `--gn-line`, `--gn-console-bg`, etc.). New values used here:
```css
--gn-orange-hover: #F25A38;
--gn-open-dot: #FF6C4B;
--gn-rail-line: #E5E7EB;
--gn-dot-ops: #C9CDD4;
```
Green / amber / blue / neutral status colours are the same as the table's status mapping.
Type: Geist 400/500/600, Geist Mono 400/500 for dates, times, fees and counts. Scale: 11.5 / 12 / 12.5 / 13 / 13.5 / 14 / 15 / 16 / 18 / 30px.

## Assets
Font Awesome icons already in `Icons.jsx`: faChevronRight, faEllipsis, faEnvelope, faAddressBook, faCheck. Avatars use artist profile images.

## Open decisions
- Tech/Documents/Notes live in the right rail. If a venue has long notes or many docs, the rail may need a max-height with its own scroll.
- Whether "Accept" should go straight to payment or confirm first (the current flow is kept).
- Mobile (`!isMdUp`): stack the rail below the running order; no other mobile work in this pass.

## Files
- `gig-details-1b.html`: self-contained interactive prototype. Use the Open / Confirmed switch; press Accept on applicants in Open.
- `CURSOR_PROMPT.md`: the prompt to paste into Cursor.
