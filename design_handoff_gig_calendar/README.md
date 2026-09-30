# Handoff: Venue gig calendar redesign (option 2a)

## Overview
A redesign of the venue dashboard's **My Gigs → Calendar** view (`GigsCalendarReact.jsx`, the `gigsView === 'react'` branch of `Gigs.jsx`). One calendar with three views:
- **Month**: the default. A dense month grid with gig chips.
- **Week**: an afternoon-to-late time grid, with each gig's sets listed inside its block.
- **Season**: 12 weeks at a glance. Regular nights with no gig show as empty slots to fill.

A fixed **right panel (340px)** is shared across all views. With nothing selected it summarises the visible range and lists what needs action. Clicking a gig swaps it to that gig's details. This replaces the current gig detail, artist booking and venue hire **modals**.

It uses the "Console" shell from `design_handoff_gig_table/` (sidebar, top bar, tokens, Geist fonts, status colours). Implement that first.

## About the design files
`gig-calendar-2a.html` is a **design reference built in HTML**: a self-contained prototype that opens in any browser. **Don't copy its markup.** Recreate it in the existing React + plain CSS setup. Sample data is design-only. The prototype treats "today" as Wed 30 Sep 2026, and the "now" line in Week is fixed at 17:20. Use the real date and time.

## Fidelity
**High-fidelity.** Colours, type, spacing, radii and states are final.

---

## Shell
Same as the gig table: sidebar 248px, top bar 64px with the **Calendar** segment active in the Calendar / Table switch, "Templates" and "New gig".

Below the top bar the area is a grid: `minmax(0,1fr) 340px`. Left = calendar column (padding `22px 24px 24px`, flex column, gap 14px). Right = panel (bg #FFFFFF, border-left 1px #E5E7EB).

## Calendar header
**Row 1** (space-between):
- Left (gap 12px): title 22px/600, letter-spacing -0.01em, min-width 220px. Then prev / next (32×32, radius 8px, border 1px #E5E7EB, white, chevron 11px #4B5160, hover #F9FAFB) and "Today" (height 32px, padding 0 12px, same style, 13px/500).
  - Title per view. Month: `October 2026`. Week: `28 Sep – 4 Oct 2026` (or `5–11 Oct 2026` within one month). Season: `28 Sep – 20 Dec 2026`.
  - Prev / next steps one month, one week, or 4 weeks (Season). Today jumps each view to the current month / week / the 12 weeks starting this week.
- Right: view switch. Segmented, bg #EDEEF1, padding 3px, radius 8px. Buttons padding 5px 14px, radius 6px, 13px. Active: white, shadow `0 1px 2px rgba(0,0,0,.08)`, 600, #0F1115. Inactive: 500, #6B7280. Labels: Month / Week / Season. Persist in the URL (`?cal=month|week|season`) and default to month.

**Row 2**: filter chips (gap 6px). Each is height 30px, padding 0 11px, radius 8px, white, border 1px #E5E7EB, 13px/500 #4B5160, a 7px dot, the label, and a count in Geist Mono 12px #0F1115. Selected: `box-shadow: 0 0 0 1.5px #0F1115`.
| Chip | Dot | Matches |
|---|---|---|
| All | #0F1115 | everything |
| Needs action | #FF6C4B | awaiting payment, negotiating, or open with unviewed applicants (same rule as the table's tile) |
| Awaiting payment | amber | `awaiting payment` |
| Confirmed | green | confirmed, and confirmed venue hires |

Counts are for the **visible range**. Filters **dim** non-matching gigs (opacity .28, 150ms) rather than hiding them, so the calendar keeps its shape. Share the `?status=` param with the table.

## Status colours
The same as the table's status mapping (confirmed green, awaiting amber, negotiating blue, open neutral). Add one for **venue hire**:
`dot oklch(0.62 0.12 300) · text oklch(0.45 0.11 300) · bg oklch(0.95 0.03 300)`.
Gig chips and blocks use the status **bg** as their fill, the **dot** for the dot, and the **text** colour for the time.

"N new" badge (everywhere): 10.5px/600, #B5462C on #FFEDE7, radius 4px, padding 0 5px, `white-space:nowrap`.

---

## Month view
Card: white, border 1px #E5E7EB, radius 12px, overflow hidden, and it fills the remaining height (flex:1).
- **Weekday header**: height 34px, bg #FAFBFC, border-bottom 1px #E5E7EB, Monday first, 11.5px/500, letter-spacing .05em. MON–THU #6B7280, FRI–SUN #0F1115.
- **Grid**: 7 × (5 or 6) rows, rows share the height equally (`grid-auto-rows:minmax(0,1fr)`), 1px gaps on a #F0F1F3 background to draw the lines.
- **Cell**: padding 6px, flex column, gap 4px, overflow hidden. Background white, or #FAFBFC for past days and days outside the month.
  - Date: Geist Mono 12.5px/500 in a 22px pill (min-width 22px). Today: bg #FF6C4B, white text. Past / outside: #9AA0AA. The 1st of a month reads `1 NOV`.
  - Future days with no gig show a 22×22 "+" button top-right (#C9CDD4, hover bg #F3F4F6 and #0F1115). It opens `AddGigsModal` with that date.
- **Gig chip** (button, radius 7px, padding 6px 7px, flex column, gap 3px, bg = status bg):
  1. Row: 6px dot · start time (Geist Mono 11px, status text colour) · spacer · "N new" badge (flex-shrink 0).
  2. Title 12.5px/500 #0F1115, ellipsis.
  3. Sub-line 11.5px #4B5160, ellipsis. For multi-set gigs it starts with 10×4 set bars (green if booked, else #D6D0C9, gap 2px). Text: the artist name, "N applications", "Offer · {artist}" when negotiating, "x/y sets booked" for multi-set gigs, or "Hired · {name}" for venue hire.
  - **Days with 2 or more gigs** use a compact chip (rows 1–2 only) so two fit. With 3 or more, show 2 plus a "+N more" link that selects the day's first gig. This replaces today's per-day pill carousel (`visiblePillIndexByDate`).
  - Selected chip: `box-shadow: 0 0 0 1.5px #0F1115`.

## Week view
Same card. Monday–Sunday.
- **Day header** (height 56px, border-bottom 1px #E5E7EB): a 56px gutter, then 7 columns, each with border-left 1px #F0F1F3 and padding 0 10px. It shows the weekday (11.5px/500) and the date number (Geist Mono 19px/500). Today: both in #FF6C4B, bg #FFF7F4. Past: #9AA0AA. Future days get the same "+" button as Month.
- **Body**: scrolls vertically if needed. Hours **14:00 to 01:00** at **62px per hour**. Expand the range automatically if a gig starts earlier or ends later. Gutter labels Geist Mono 11px #9AA0AA, right-aligned. Hour lines are 1px #F0F1F3. Past day columns have bg #FAFBFC.
- **Gig block**: absolutely positioned, left/right 4px, top/height from start/end (inset 2px). Radius 8px, padding 7px, bg = status bg, flex column, gap 5px, overflow hidden.
  - Time range (Geist Mono 11px, status text colour, nowrap), title 12.5px/600, and the "N new" badge on its own line if present.
  - One row per set: white, radius 6px, padding 4px 6px, 11.5px, a 6px dot (green booked, amber booked but awaiting payment, blue negotiating, orange open). Text: "Set N · {artist | N applications}". Single-set gigs drop the "Set N ·" prefix. Venue hire shows one row, "Hired · {name}".
- Times after midnight (e.g. 01:00) belong to the previous evening.
- **Now line** in today's column: 2px #FF6C4B with an 8px dot at the left edge.
- Overlapping gigs on one day: split the column width between them.

## Season view
Same card.
- **Header**: a 76px gutter, then MON–SUN as in Month.
- **12 week rows**, sharing the height equally. Border-top between rows is 1px #F0F1F3, or 1px #E5E7EB where a new month starts.
- **Gutter**: month name (12px/600, letter-spacing .04em, e.g. `OCT`) on the first row of each month, and `W/C 05` in Geist Mono 11px #9AA0AA.
- **Cells** (padding 3px; Fri–Sun columns bg #FCFCFD):
  - **Gig**: button filling the cell. Radius 7px, padding 5px 8px, bg = status bg, space-between column. Top row: dot, date (Geist Mono 11px, ellipsis; `17 ×2` if the day has 2 gigs), and the new badge. Bottom row 12px/500 ellipsis: the artist(s) if fully booked, "Open · N apps", "x/y · N apps", "Offer · {artist}", or "Venue hire". When a day has several gigs, show the one needing attention. The `title` tooltip lists them all. Past gigs are at 55% opacity.
  - **Empty regular night** (future, no gig, weekday is a regular night): dashed 1.5px #F2B4A4, radius 7px, date and "+ Empty" in #B5462C 11–12px. Hover: bg #FFF7F4, border #FF6C4B. Click opens `AddGigsModal` for that date.
  - **Other empty day**: just the date, Geist Mono 11px (#9AA0AA, or #C9CDD4 if past).
- **Regular nights** is a venue setting. Default Thu, Fri, Sat. It's edited in the right panel (below). *New data:* store it on the venue profile (e.g. `regularNights: [4,5,6]`, JS `getDay()` numbers).

---

## Right panel (340px, shared by all views)

### Summary state (no gig selected)
Padding 22px, scrolls, sections gap 24px. Section titles 15px/600, with a right-hand Geist Mono 12.5px #4B5160 value.
1. **This month / This week / These 12 weeks** + `N OF M SETS BOOKED`. A progress row of segments (gap 2px, height 6px, radius 3px; booked #FF6C4B, open #E5E7EB). One segment per set, capped at 24 and scaled proportionally beyond that. Below: "N upcoming gigs · N confirmed" 13px #4B5160. Upcoming only (from today).
2. **Season only**: **Regular nights** (label 13px/500 #4B5160), 7 toggle buttons in a 7-column grid, gap 4px, height 28px, radius 6px, 11px/500. On: bg #111317, white. Off: white, border 1px #E5E7EB, #6B7280. Then **Empty regular nights** with an `N NIGHTS` count. It's a bordered list (1px #F0F1F3, radius 10px) of rows: the date (Geist Mono 12.5px, e.g. `SAT 05 DEC`) and an "Add gig" button (28px, radius 7px, border #E5E7EB, 12.5px/500) that opens `AddGigsModal` for that date. Show 5, then "and N more".
3. **Needs action** + count. A bordered list of up to 6 rows (padding 11px 12px, hover #FAFBFC): the title 13.5px/500 with the date (Geist Mono 11.5px #6B7280) on the right, and the reason 12.5px with a 6px dot. Reasons: "N new applications" (orange / #B5462C), "Awaiting payment" (amber), "Counter-offer from {artist}" (blue). Clicking selects the gig, and in Week or Month moves to its week or month. Empty: "Nothing waiting on you." 13px #6B7280.

### Gig selected state
Replaces the summary. Body padding `22px 22px 18px`, scrolls, gap 20px. Footer is sticky (padding 14px 22px, border-top 1px #E5E7EB).
- **Header**: `SAT 03 OCT · 19:30–23:00` (Geist Mono 12.5px #4B5160) and a ✕ (28×28, radius 6px) that returns to summary. Title 20px/600. Status pill (12.5px/500, padding 3px 8px, radius 6px) and visibility text 12.5px #4B5160: "Public" / "Invite only" / "Private" (hire).
- **Line-up · x/y booked** (section label 12px/500, uppercase, .05em, #6B7280). A bordered list (1px #F0F1F3, radius 10px) with rows in a `96px 1fr` grid, padding 10px 12px. Key in Geist Mono 12px #6B7280 (`SET 1 · 19:30`, or just the time for single sets). Value 13.5px with a status dot: the artist (500), "Offer out · {artist}", or "Open" (400, #6B7280).
  - **Venue hire** label "Booking". Rows: HIRED BY / DEPOSIT / BALANCE, from the existing hire fields (booker, deposit status, fee status).
- **Applications** (only while any set is open): a row on #FAFBFC with a 1px #F0F1F3 border, radius 10px, padding 12px. It shows the count (Geist Mono 14px), "applications", the "N new" badge, and a **Review** button (30px, bg #FF6C4B, white, 12.5px/600, hover #F25A38) → `gig-applications` page.
- **Share** (only while open). Public: a link field (36px, border #E5E7EB, radius 8px, URL in Geist Mono 12px, "Copy" button with a left border that shows "Copied" for 1.4s). Then an outlined **Invite artists** button (36px, envelope icon) → `InviteAndShareModal` / `FillThisSlotModal` as today. Invite only: just the invite button. Keep the `gigs.invite` permission check.
- **Sound manager** and **Notes** (border-top 1px #F0F1F3, padding-top 16px, gap 12px). The label is styled like the section labels, and the value is 13.5px / 13px with line-height 1.55. The value is editable in place: hover bg #F6F7F9, and click to edit with the existing `detailEditingNotes` / `detailEditingSoundManager` + `updateGigDocument` save. Only if the user can update.
- **Footer**: **Open gig** (flex 1, 36px, bg #111317, white, 13.5px/500) → `gig-applications` with `linkedGigIds` as today. **Edit** (outlined) → `AddGigsModal` edit. **⋯** (36×36) opens the existing actions menu: Copy link, Open in new tab, Duplicate, Make invite only / public, Cancel gig, Delete (the Cancel / Delete confirmations stay as they are, including the venue-hire notify-booker checkbox and the conversation lookup).

## Interactions summary
- View switch → `?cal=`. Filter chips → `?status=` (shared with the table).
- Prev / next / Today → range. Gig click → select, panel shows the gig; ✕ → summary.
- "+" / Empty slot / Add gig → `AddGigsModal` prefilled with the date.
- Needs action row → select + navigate to its range.
- Regular nights toggles → save to the venue profile.
- Transitions: opacity 150ms (filter dim), background 150ms.

## State
- `view` (URL), `cursorDate` (anchor for month / week / season), `selectedGigId` (replaces `selectedGigDetail`), `filter` (URL), `regularNights` (venue profile), `copiedGigId`.
- Derived: gigs in the visible range, filter counts, sets booked, needs-action list, empty regular nights.
- Remove: `visiblePillIndexByDate`, `react-calendar`.

## Tokens
Reuse the tokens from the table handoff. New values:
```css
--gn-hire-dot: oklch(0.62 0.12 300);
--gn-hire-text: oklch(0.45 0.11 300);
--gn-hire-bg: oklch(0.95 0.03 300);
--gn-empty-border: #F2B4A4;
--gn-today-bg: #FFF7F4;
--gn-weekend-col: #FCFCFD;
--gn-segment-bg: #EDEEF1;
```

## Open decisions
- **Wording**: "Invite artists" may become "Invite to apply" (plus a separate "Offer the gig" if direct offers are added). Confirm with the product owner.
- `regularNights` is new data. Until it's stored, default to Thu, Fri, Sat and keep it local.
- Mobile (`!isMdUp`): show Month only, with the panel as a bottom sheet. Not designed in this pass.

## Files
- `gig-calendar-2a.html`: self-contained interactive prototype.
- `CURSOR_PROMPT.md`: the prompt to paste into Cursor.
