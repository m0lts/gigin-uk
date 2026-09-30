# Handoff: Venue gig table redesign ("Console", option 2a)

## Overview
A redesign of the venue dashboard's **My Gigs → List** view (`src/features/venue/dashboard/Gigs.jsx`, the `gigsView === 'table'` branch) and the venue **Sidebar** (`src/features/venue/dashboard/Sidebar.jsx`). The table becomes a dense, scannable console: summary tiles that filter, clear status pills, a set-booking indicator, the applications count with new badges, share/invite actions inline, bulk actions on selection, and a collapsible past-gigs section. The sidebar becomes black and supports expanded (248px) and collapsed (68px rail) states.

The calendar view (`GigsCalendarReact`) is **out of scope** for this handoff. It only needs to sit inside the new shell.

## About the design files
`gig-table-2a.html` is a **design reference built in HTML**. It's a self-contained prototype that opens in any browser, showing the intended look and behaviour. **Don't copy its markup.** Recreate it in the existing React + plain CSS setup (`Gigs.jsx`, `Sidebar.jsx`, and the styles in `src/assets/styles/**`), keeping all current data logic, permissions (`hasVenuePerm`), API calls, and modals.

## Fidelity
**High-fidelity.** Colours, type, spacing, radii and states are final. Match them exactly. The only design-only content is the sample data (gig names, artists, counts).

---

## Layout: dashboard shell
- `.dashboard` grid columns: **248px** expanded / **68px** collapsed (currently 275px / 72px). This uses the existing `sidebarCollapsed` from `VenueDashboardContext`.
- Window background: `--gn-console-bg` **#F6F7F9** (currently #fcfcfc).
- **Remove the breadcrumbs bar** on the Gigs route. The top bar replaces it.

## Sidebar (expanded, 248px)
Background **#111317**, padding `22px 14px 16px`, flex column.
1. **Logo row** (padding `0 8px`): `gigin` + orange `.` in Visby CF 600, 28px, white; BETA tag 10.5px/600, letter-spacing .06em, color #FF9C85, bg #1E1715, border 1px #3A2A26, radius 4px, padding 2px 6px, margin-top 4px.
2. **Venue switcher** (margin-top 24px): button, bg #1A1D22, border 1px #262A31 (hover #3A3F48), radius 10px, padding 10px, gap 10px. It contains a 30×30 radius-8 orange (#FF6C4B) square with venue initials (12px/600, white), the venue name (13.5px/600, white), a sub-line "N venues" (12px, #8A909C), and a chevron-down (10px, #8A909C). *New element:* it replaces the "Filter by Venue" select as the global venue filter. If there's only one venue, show it without the chevron.
3. **Section label** "MANAGE": 11px/500, uppercase, letter-spacing .08em, #6B7280, padding `0 12px`, margin `28px 0 8px`.
4. **Nav items** (gap 2px): padding `10px 12px`, radius 9px, gap 12px, 14.5px/500.
   - Default: text #9AA0AA. Hover: bg #1A1D22, text #FFFFFF.
   - Active: bg #1E2127, text #FFFFFF, icon #FF6C4B.
   - Items and icons (unchanged from today): Gigs (`faCalendar` solid), My Contacts (`faAddressBook`), Venue Settings (`faHouseWindow`). Messages and Finances keep their feature flags.
5. Spacer (flex:1).
6. **Close sidebar**: padding `10px 12px`, radius 9px, 14px/500, #8A909C, chevron-left 12px in an 18px-wide slot. Hover: bg #1A1D22, text white. Margin-bottom 10px.
7. **Account row**: border-top 1px #22252B, padding `12px 10px 0`, gap 10px. A 32px circle (#2A2E36, white initials 12px/600), name 13.5px/600 white, email 12px #8A909C (ellipsis), chevron-down. Clicking opens the existing Settings / Log Out menu. Style it as a dark popover: bg #1A1D22, items 14px, Log Out in #FF9C85.

### Sidebar (collapsed rail, 68px)
Background #111317, column centred, padding `20px 0`, gap 8px.
- `g.` logo (Visby 26px, white, orange dot), margin-bottom 20px.
- Nav icon buttons 40×40, radius 10px. Default icon #9AA0AA; hover bg #1E2127, icon white. Active: bg #FF6C4B, icon white. Add a `title` tooltip with the label.
- Spacer, an expand button (40×40, chevron-right), and a 34px avatar circle (#2A2E36).

## Top bar (Gigs page)
Height 64px, bg #FFFFFF, border-bottom 1px #E5E7EB, padding `0 32px`, space-between.
- **Left:** "Gigs" 18px/600 · a 1×18 divider in #E5E7EB · an "All venues ▾" ghost button (14px/500, #4B5160, padding 6px 10px, radius 8px, hover bg #F3F4F6). This mirrors the sidebar venue switcher, so pick one in implementation (recommended: keep it here and make the sidebar switcher account-level).
- **Right** (gap 10px):
  - Search: 240px wide, bg #F3F4F6, radius 8px, padding 7px 10px, magnifier icon 13px #8A909C, placeholder "Search gigs, artists…" at 14px, and a `/` key hint (Geist Mono 11px, border 1px #D9DCE1, radius 4px, padding 1px 5px). The `/` key focuses the search. It searches gig name **and** confirmed artist name.
  - View switch: segmented control, bg #F3F4F6, padding 3px, radius 8px; buttons padding 5px 12px, radius 6px, 13px. Active: white bg, shadow `0 1px 2px rgba(0,0,0,.08)`, weight 600. Inactive: #6B7280 at 500. Labels "Calendar" / "Table" map to the existing `gigsView` 'react' / 'table'.
  - "Templates": secondary button (white, border 1px #E5E7EB, radius 8px, padding 8px 14px, 14px/500, hover #F9FAFB). Opens the existing Manage Templates modal.
  - "New gig": primary button (bg #111317, white, radius 8px, padding 8px 14px, 14px/500, hover #2A2E36). Opens `AddGigsModal` in `bookNew` mode. "Add existing gig" moves into a split-button menu on New gig, or the ⋯ menu. Your call, but keep it reachable.

## Content area
Padding `24px 32px`, flex column, gap 20px.

### Summary tiles (these are filters)
Grid of 4 equal columns, gap 12px. Each tile is a button: bg white, border 1px #E5E7EB, radius 12px, padding `14px 16px`, gap 6px, left-aligned.
- Label row: a 7px dot plus the label at 13px/500 #4B5160.
- Count: Geist Mono 26px/500 #0F1115.
- Selected: `box-shadow: 0 0 0 1.5px #0F1115`.

| Tile | Dot | Filter |
|---|---|---|
| All upcoming | #0F1115 | every future gig group |
| Needs action | #FF6C4B | future groups where any slot has unviewed applicants (`!a.viewed && a.invited !== true`), OR status is Awaiting payment or Negotiating |
| Awaiting payment | amber dot | `statusClass === 'awaiting payment'` |
| Confirmed | green dot | `statusClass === 'confirmed'` |

These replace the old All/Confirmed/Upcoming/Past tabs. Keep them URL-backed via `?status=` as today (`all`, `attention`, `awaiting`, `confirmed`).

### Table card
bg white, border 1px #E5E7EB, radius 12px, overflow hidden.

**Grid columns** (use CSS grid on rows or a `<table>` with `<colgroup>`), expanded sidebar at 1440px wide:
`44px | 124px | 108px | 1fr | 124px | 132px | 96px | 168px | 104px | 40px`
Checkbox · Date · Time · Gig · Line-up · Applications · Visibility · Status · Share · ⋯
(With the collapsed rail, give the extra width to Gig.)

**Header row:** height 40px, bg #FAFBFC, border-bottom 1px #E5E7EB, 11.5px/500, uppercase, letter-spacing .05em, #6B7280. The first cell has a select-all checkbox.

**Body row:** height 56px, border-bottom 1px #F0F1F3, 14px Geist, #0F1115. Hover bg #F9FAFB. Selected bg #FFF7F4. Clicking the row navigates to `gig-applications` exactly as today. Clicking the checkbox, share or ⋯ must `stopPropagation`.
- **Checkbox:** 14×14, radius 4px, border 1.5px #C9CDD4. Checked: bg and border #FF6C4B with a white 8px check. Only future gigs are selectable (as in the commented-out code).
- **Date:** Geist Mono 13px, letter-spacing .02em, uppercase, format `EEE dd MMM` → `FRI 02 OCT`.
- **Time:** Geist Mono 13px, #4B5160, `HH:mm–HH:mm` (en dash). Groups show first start to last end (existing logic).
- **Gig:** name 14px/500, ellipsis. Strip the `(Set N)` suffix as today. For multi-slot groups, append a tag "N sets": 12px, #6B7280, bg #F3F4F6, radius 4px, padding 1px 6px.
- **Line-up:** one 18×6 radius-3 bar per slot (gap 3px). Green `oklch(0.66 0.14 150)` if the slot has a confirmed applicant, otherwise #D6D0C9. Then `booked/total` in Geist Mono 12.5px #4B5160.
- **Applications:** total applicants across the group in Geist Mono 14px. If there are unviewed applicants, add a badge "N new": 11.5px/600, #B5462C on #FFEDE7, radius 4px, padding 2px 6px.
- **Visibility:** "Public" / "Invite only", 13px, #4B5160. This replaces the toggle column. The toggle action moves to the ⋯ menu ("Make invite only" / "Make public"), using the same `updateGigDocument` on all `group.gigIds`.
- **Status pill:** inline-flex, gap 6px, 12.5px/500, padding 3px 8px, radius 6px, with a 6px dot. Colours are below.
- **Share:** 30px-tall button, padding 0 9px, radius 7px, border 1px #E5E7EB (hover #9AA0AA), 12.5px/500, gap 6px, `white-space:nowrap`.
  - Public: `faLink` icon + "Copy link" → existing `copyToClipboard`. Show "Copied" for about 1.4s.
  - Invite only: `faEnvelope` icon + "Invite" → existing `GigInvitesModal` (keep the `gigs.invite` permission check and disabled state).
  - Confirmed or past: show "—" in #9AA0AA.
- **⋯:** 28×28, radius 6px, #6B7280, hover bg #F3F4F6. It opens the **existing options menu with the same conditional items**, restyled: white, border 1px #E5E7EB, radius 10px, shadow `0 8px 24px rgba(15,17,21,.12)`, padding 6px, items 14px padding 8px 10px radius 6px, hover #F3F4F6, Delete/Cancel in `oklch(0.48 0.13 25)`. Add these items: **Edit sound manager**, **Edit notes**, **Make invite only / Make public**.

### Status mapping (reuse `getStatusDisplay`)
| Existing result | Pill label | Dot | Text | Background |
|---|---|---|---|---|
| confirmed | Confirmed | oklch(0.66 0.14 150) | oklch(0.45 0.11 150) | oklch(0.95 0.04 150) |
| awaiting payment | Awaiting payment | oklch(0.72 0.15 70) | oklch(0.48 0.11 60) | oklch(0.95 0.05 80) |
| Negotiating | Negotiating | oklch(0.62 0.13 260) | oklch(0.45 0.12 260) | oklch(0.95 0.03 260) |
| N Pending Applications (open) | Open for applications | #B8AFA6 | #5E5750 | #F1EEEA |
| closed (not open) | Closed | #B8B8B8 | #6B7280 | #F3F4F6 |
| past | Played | #B8B8B8 | #6B7280 | #F3F4F6 |
| expired | Expired · unbooked | oklch(0.62 0.15 25) | oklch(0.48 0.13 25) | oklch(0.95 0.03 25) |
| in dispute | In dispute | oklch(0.62 0.15 25) | oklch(0.48 0.13 25) | oklch(0.95 0.03 25) |

The pending count and "x/y slots booked" sub-text move into the Applications and Line-up columns, so the pill is always one short label.

### Past gigs
Remove the "Past Gigs" filler row. Add a full-width toggle row at the bottom of the card: padding 14px 16px, bg #FAFBFC, 13.5px/500 #4B5160 (hover #0F1115), with a chevron-right that rotates 90° when open (150ms), the text "Past gigs", and a count in Geist Mono 12px #6B7280. When open, past groups render as 48px rows, text #6B7280, border-top 1px #F0F1F3, sorted **newest first**. There's no checkbox, share or visibility. The Line-up cell shows the confirmed artist name, or "Unbooked".

### Bulk action bar
Show it when 1 or more rows are selected. It's positioned absolutely, centred horizontally, 28px from the bottom of the content area. bg #111317, white text, radius 12px, padding `8px 8px 8px 18px`, gap 6px, shadow `0 10px 30px rgba(0,0,0,.25)`.
- "N selected" (14px/500, margin-right 10px).
- Ghost buttons (padding 7px 12px, radius 8px, 13.5px, #E5E7EB, hover bg #2A2E36): **Duplicate** (`handleDuplicateSelected`), **Make template** (loop `handleCloneAsTemplate`), **Set invite only**, and **Delete** in #FF9C85 (`handleDeleteSelected`, via the existing confirm modal).
- A divider (1×20 #2F333B) and a close ✕ (30×30) that runs `clearSelection`.
All the handlers already exist in `Gigs.jsx`. Selection must expand to full `group.gigIds`, as the existing handlers do.

### Empty state
A single row with padding 48px, centred, 14px #6B7280: "No gigs match this filter." For All upcoming with no gigs: "No upcoming gigs yet", plus a New gig button.

## Interactions summary
- Tile click → sets `?status=`.
- Row click → gig applications page.
- Checkbox → toggle selection.
- Share → copy link / invite modal.
- ⋯ → options menu. Close it on outside click, as today.
- Past toggle → expand or collapse, persisted in `localStorage` (`gigs.showPast`).
- Close sidebar / expand → `setSidebarCollapsed`, which is already in context.
- Transitions: background colours 150ms linear, chevron rotate 150ms.

## State (additions to `Gigs.jsx`)
- `selectedGigs` (already exists; re-enable)
- `showPast` (bool, localStorage)
- `copiedGigId` (string or null, 1.4s timeout)
- Derived per group: `totalApplicants`, `newApplicants`, `slotsBooked[]`, `needsAction`
- Status filter values: `all | attention | awaiting | confirmed`

## Design tokens (add to `global.styles.css`)
```css
--gn-ink: #0F1115;
--gn-ink-2: #4B5160;
--gn-muted: #6B7280;
--gn-muted-2: #9AA0AA;
--gn-console-bg: #F6F7F9;
--gn-line: #E5E7EB;
--gn-line-soft: #F0F1F3;
--gn-surface-2: #FAFBFC;
--gn-hover: #F9FAFB;
--gn-chip: #F3F4F6;
--gn-side-bg: #111317;
--gn-side-hover: #1A1D22;
--gn-side-active: #1E2127;
--gn-side-line: #22252B;
--gn-side-text: #9AA0AA;
--gn-selected-row: #FFF7F4;
--gn-new-text: #B5462C;
--gn-new-bg: #FFEDE7;
/* existing: --gn-orange #FF6C4B */
```
Radii: 4 (tags/checkbox), 6 (pills, small buttons), 7–8 (buttons/inputs), 10 (nav, rail icons), 12 (cards, tiles, bulk bar).
Type: **Geist** 400/500/600 for the dashboard UI, **Geist Mono** 400/500 for dates, times and counts (Google Fonts). Visby CF stays for the logo. Scale: 11.5 / 12.5 / 13 / 13.5 / 14 / 14.5 / 18 / 26px.

## Assets
- All icons are existing Font Awesome imports from `Icons.jsx`: faCalendar (solid), faAddressBook, faHouseWindow, faMagnifyingGlass, faLink, faEnvelope, faEllipsis, faChevronDown/Left/Right, faCheck, faXmark.
- Fonts: Geist and Geist Mono (new, Google Fonts). Visby CF (existing, `src/assets/fonts`).

## Out of scope / open decisions
- **Sound manager & Notes columns are removed from the table.** They move to ⋯ menu items that open the existing editor popovers. If venues rely on seeing them at a glance, add a small notes icon beside the gig name when notes exist.
- Choose between the venue switcher in the sidebar and the one in the top bar (keep one).
- The calendar view (next handoff).
- Mobile: the current mobile behaviour for `!isMdUp` stays as is for now.

## Files
- `gig-table-2a.html`: self-contained interactive prototype. Open it in a browser. Click rows to select them, try the tiles, "Past gigs", "Close sidebar", and the share buttons.
- `CURSOR_PROMPT.md`: the prompt to paste into Cursor.
