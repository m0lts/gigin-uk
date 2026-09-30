# Handoff: New gig flow redesign (option 2a: three routes, one ending)

## Overview
Creating a gig currently happens in `AddGigsModal` (date multi-select step → one long `BookNewEventWizard` form → `InviteMethodsModal`). It's replaced by **three routes** onto the same draft, all ending on the **same "created" panel**:

| Route | Where | Best for | Opened from |
|---|---|---|---|
| **Quick create** | 460px drawer over the calendar | Regular nights, templates | Calendar day "+", or the New gig menu |
| **Full form** | 1180×880 modal over the dashboard | Seeing everything, with a live listing preview | New gig menu (default) |
| **Step by step** | Full-page wizard | First-time venues | New gig menu |

Each route covers **Find an artist** (`addGigsMode 'bookNew'`), **Already booked** (`'addExisting'`), and **Start from a template**. Venue hire and editing stay on the current UI for now.

**Wording:** approaching an artist directly is now **"Offer the gig"** everywhere (replaces "Invite artists").

## About the design files
`new-gig-2a.html` is a **design reference built in HTML**: a self-contained prototype of the gigs calendar with the New gig split button. **Don't copy its markup.** Recreate it in React + plain CSS, reusing existing logic and APIs. Sample data (contacts, templates, dates) is design-only. The calendar behind it is the calendar handoff.

## Fidelity
**High-fidelity.** Colours, type, spacing, radii and states are final. Tokens are the same as the table handoff (`--gn-*`), with Geist / Geist Mono.

---

## Shared draft (`useNewGigDraft`)
All three routes read and write one draft object so the user can switch routes without losing input (Quick create → "Use the full form instead" carries the template, kind, artist, times and fee).

| Draft field | Existing gig field |
|---|---|
| `kind: 'find' \| 'booked'` | `addGigsMode: 'bookNew' \| 'addExisting'`, `bookingMode: 'artist'` |
| `templateId` | existing template apply (`applyBookNewTemplateToGig` / `…AddExisting`) |
| `dates[]` | `selectedDates` / `gigsByDate` (multi-date → one gig per date as today) |
| `start`, `end` | slot 0 `startTime` + `duration` |
| `loadIn`, `soundcheck`, `vacateBy` (nullable) | `OPTIONAL_WHOLE_EVENT_STEPS` include/time keys |
| `sets[] {start, end, fee}` | extra slots + `slotBudgets` (`onSlotCountChange`, `onAddSlot`) |
| `pay: 'fee' \| 'none'` | `paymentModel: 'venue_pays_artist' \| 'no_fee'` |
| `fee` | `unifiedFeeAmount` (single set) / `slotBudgets[i]` (multi) |
| `tickets: 'venue' \| 'artist' \| 'free'` | `ticketingModel: 'venue' \| 'artist' \| 'free_entry'` |
| `title` | `gigName` (default "Gig at {venue}" as today) |
| `description` (max 250) | `extraInformation` |
| `lookingFor[]`, `genres[]` | `gigType` (`toggleLookingForOption`), genres |
| `showOnProfile` | `showOnVenueProfile` |
| `artistId` (booked) | CRM artist / `slotArtistNames` for addExisting |
| `paidVia: 'gigin' \| 'outside' \| 'none'` | addExisting payment handling |

Respect `FEATURES.payments` / `FEATURES.ticketing`: hide those sections when the flags are off, as today.

## New gig split button (Gigs top bar)
Replaces the "New gig" primary button (both the Calendar and Table views).
- Main part: height 36px, padding 0 14px, radius `8px 0 0 8px`, bg #111317, white, 14px/500, hover #2A2E36. It opens the **last-used route**, stored in `localStorage` as `gigs.newGigRoute`, default `full`.
- Chevron part: 32×36, radius `0 8px 8px 0`, border-left 1px #2F333B. It opens the menu.
- **Menu**: 320px, white, border 1px #E5E7EB, radius 12px, shadow `0 12px 32px rgba(15,17,21,.16)`, padding 6px, 8px below the button, right-aligned.
  - Items: a grid of `32px 1fr auto`, gap 12px, padding 10px, radius 8px, hover #F3F4F6. A 32px #F3F4F6 radius-8 glyph tile, title 14px/600, description 12.5px #6B7280, and a "Default" tag (11px/600, #F3F4F6) on the current last-used route.
  - Quick create: "Four fields in a side panel. Fill in the rest later." Full form: "Everything on one page, with a live preview of the listing." Step by step: "One question at a time. Good for your first gig."
  - Footer (border-top #F0F1F3, 12.5px #6B7280): "New gig opens whichever you used last."
- "Add existing gig" and "Templates" remain reachable. Both are now inside the routes ("Already booked" kind, template pickers), so the old separate entry can go.
- Calendar day "+" always opens **Quick create** with that date.
- Offer-gig / CRM entry (`bookNewAwaitingFirstDateFlow`) keeps working. Open Full form with the artist preselected.

---

## Route 1: Quick create (drawer)
Right-aligned drawer, width 460px, full height, white, shadow `-12px 0 40px rgba(0,0,0,.18)`. Backdrop `rgba(15,17,21,.28)`; clicking it closes the drawer.
- **Header** (64px, border-bottom): "New gig" 17px/600 + date `SAT 07 NOV` (Geist Mono 12.5px #4B5160) + ✕.
- **Body** (padding 22px, gap 24px):
  1. **Start from**: pill chips (34px, radius 999px, 13.5px/500): "Blank" plus the venue's templates. Selected: #111317 bg, white. Applying a template fills times, fee, sets, description and looking-for.
  2. **Have you already booked someone?**: two cards in a 2-column grid (padding 13px, radius 10px, border #E5E7EB, selected ring `0 0 0 1.5px #0F1115`): "No, find an artist" / "Offer it to artists you know, or let artists apply." and "Yes, add them" / "Adds a confirmed gig to your calendar."
  3. If booked, **Who?**: a list of the 4 most recent contacts (30px avatar, name 14px/500, radio), in a bordered list with radius 10px.
  4. **Starts / Ends / Fee** in one row (3 equal columns, `min-width:0`), 42px inputs, Geist Mono 14.5px. The fee label is "Fee offered" or "Agreed fee".
  5. An info note (bg #FAFBFC, border #F0F1F3, radius 10px, 22px dark "i" circle, 13px #4B5160) explaining what happens next, or explaining the template's sets.
- **Footer**: primary "Create gig" / "Add to calendar" (44px, #FF6C4B, 15px/600) and a text link "Use the full form instead" → Full form with the draft.
- Quick create uses a single date and a single set unless a template adds sets.

## Route 2: Full form (modal)
Modal 1180×880 (max 94vw/94vh), bg #F6F7F9, radius 16px, shadow `0 24px 80px rgba(0,0,0,.35)`. Backdrop `rgba(15,17,21,.48)`.
- **Header** (68px, white): "New gig" 18px/600. A segmented control "Finding an artist | Already booked" (bg #EDEEF1). On the right, a **Template** dropdown button ("Template  None ▾"). Its menu is 280px, with "Blank gig" plus templates, each with name and when-line in Geist Mono 11.5px. Then ✕.
- **Body**: grid `1fr 420px`.
  - **Left** (padding 24px, gap 14px): section cards (white, border #E5E7EB, radius 12px, padding 20px). Each title has a 22px completion circle (done #FF6C4B with ✓, otherwise #F3F4F6).
    - **When**: date field (Geist Mono) + Starts / Ends (96px) + a dashed "+ Repeat on more dates" button that opens the existing multi-date picker. A "Split the night into sets" toggle row (bg #FAFBFC) reveals the set rows.
    - **Fee and tickets** (find): fee per set (130px £ inputs) and a Tickets segmented control "Not ticketed | I sell | Artist sells". Helper: set 0 for no fee.
    - **Listing** (find): Title, Description (250 counter), Looking for chips, "Show on my venue profile" toggle.
    - **Who's playing** (booked): a 2-column contact grid, agreed fee, "Pay through Gigin" checkbox. **Note to the artist** textarea.
  - **Right** (white, border-left, padding 24px): **live preview**.
    - Find: "WHAT ARTISTS WILL SEE" and a listing card. The venue photo is 120px, from the venue profile. Then date/time, title (placeholder "Gig at {venue}"), venue and capacity, a set/fee table, tags (looking-for + ticketing), description (placeholder in italic #9AA0AA), and a disabled "Apply" button. Reuse `BookNewEventListingPreview` data.
    - Booked: "WHAT THE ARTIST WILL GET", a confirmation message preview.
    - **Ready to publish** checklist below with `N/M`. Rows have a 16px circle (green ✓ or empty) and a label. The right-hand note is "Required" or "Recommended" in #B5462C. Required: date and times, fee, title (find). Artist and fee (booked). Recommended: description, looking for.
- **Footer** (72px, white): "Save as template" text button on the left (existing save-template modal). Right: Cancel · "Create & offer the gig" (outlined, find only) · primary "Publish gig" / "Add to calendar" (#FF6C4B). Disable primary until the required items are done, and scroll to the first missing field on click (reuse `focusInvalidField`).

## Route 3: Step by step (full page)
A full viewport page (no dashboard sidebar). Grid `300px 1fr`.
- **Left rail** (#111317, padding 26px 22px): `gigin.` logo, "NEW GIG" label, and the step list. Each step is a 26px circle (done: #FF6C4B ✓; current: white with dark number; future: 1.5px #3A3F48 ring) with the label 14.5px/500. Done steps show a summary line (12.5px #8A909C) and are clickable to jump back. At the bottom, a **First time?** tip card (bg #1A1D22, border #262A31) with step-specific help.
- **Top bar** (64px): `STEP N OF M` (Geist Mono) + segmented progress bar (4px). On the right: "Save draft" and ✕.
- **Content**: max-width 720px, centred, padding 48px 32px. Question 30px/600 + sub 15px #4B5160.
- **Footer** (76px): Back (outlined) and Continue (#111317). On the last step it's Publish gig / Add to calendar (#FF6C4B). A disabled state uses #C9CDD4 with a hint to the left ("Choose an option to continue", etc.).
- **Steps (find):** Start → Date & time → Fee & tickets → Listing → Review. **(booked):** Start → Date & time → Who's playing → Review.
  1. **Start**: three radio cards (44px glyph tile, title 16px/600, desc 14px): Find an artist / I've already booked someone / Start from a template. Choosing template shows a 3-column template grid.
  2. **Date & time**: a month picker (multi-select for find, single for booked; dots on nights with existing gigs, coloured by status). A selected-dates list with ✕. Time inputs, plus dashed chips "+ Load-in", "+ Soundcheck", "+ Vacate by". A "One set | Several sets" segmented control with set rows and "+ Add another set". **"Your night" timeline**: a 40px bar with load-in, soundcheck, sets (#FF6C4B) and pack-down blocks, with hour ticks. It updates live.
  3. **Fee & tickets**: pay cards ("I'll pay a fee" / "No fee"), £ inputs per set, a line explaining when payment happens, and 3 ticket cards.
  3b. **Who's playing** (booked): contact search + 2-column contact cards, agreed fee, "How are you paying?" segmented (Through Gigin / Another way / No fee), and an explainer.
  4. **Listing**: title, description (250), looking-for and genre chips, visibility toggle card.
  5. **Review**: a summary table (`140px 1fr auto`, Edit links jump to steps). **How do you want to fill it?**: two checkbox cards, "Publish the listing" and "Offer the gig to artists you know". The second reveals contact chips to select.

---

## Shared ending: Created panel
After any route submits, show the **Created** state in the drawer (460px, same chrome), over the calendar with the new gig visible.
- Header: the gig name. A 40px green check circle, "Gig created" / "Added to your calendar", and a status line ("Nobody can see it yet. Offer it or publish it below." / "Offered to N artists. Waiting for a reply.").
- **Offer the gig** ("First to accept gets it"): a bordered list of recent contacts (32px avatar, name, genre and last gig) with an **Offer** button (30px, #111317). After sending it shows **Offered** (#FFF7F4 bg, #B5462C text, #FFD2C6 border). Then "Search all contacts". Uses `createGigInvite` + `sendGigInvitationMessage` (keep `InviteMethodsModal` options reachable from "Search all contacts").
- **Or let artists apply**: a "Publish the listing" toggle (sets `showOnVenueProfile` / listing status). When on, show the link field with Copy ("Copied" for 1.4s).
- **Finish setting up** (optional): rows with an empty circle, label and sub-line, and an "Add" action. Rows: Describe the night, Who you're looking for, Load-in and soundcheck, Split into sets. Hide rows that are already filled. Each one opens the Full form scrolled to that section.
- Footer: "Open gig page" (#111317) → gig details (running-order page from the details handoff), and "Done".
- If the route already offered or published (wizard review / full form), reflect that state here.
- Already booked: skip Offer and Publish. Show that the details were sent, plus Finish setting up.

## Analytics
Log one event per created gig: `gig_created { route: 'quick' | 'full' | 'wizard', entry: 'menu' | 'default' | 'calendar_day' | 'crm', kind: 'find' | 'booked', usedTemplate: bool, switchedFrom?: 'quick' }`. This is so you can see which route venues use.

## Tokens
Reuse the table and calendar tokens. New values used here:
```css
--gn-modal-backdrop: rgba(15,17,21,.48);
--gn-drawer-backdrop: rgba(15,17,21,.28);
--gn-segment-bg: #EDEEF1;
--gn-offered-bg: #FFF7F4;
--gn-offered-border: #FFD2C6;
```

## Open decisions
- **"Offer the gig" = first to accept gets it.** Today invites ask artists to apply. Confirm the product rule: auto-book on accept (then payment), or accept → venue confirms.
- Venue hire (`artist_pays_venue`) is not in these routes. For now keep the existing modal path for it via a "Venue hire" item in the New gig menu.
- Edit mode stays on the current modal.
- Multi-date in Quick create: single date only. Use the Full form or wizard for repeats.
- Mobile (`!isMdUp`): the Full form becomes full-screen; the drawer becomes a bottom sheet. Not designed in this pass.

## Files
- `new-gig-2a.html`: self-contained interactive prototype.
- `CURSOR_PROMPT.md`: the prompt to paste into Cursor.
