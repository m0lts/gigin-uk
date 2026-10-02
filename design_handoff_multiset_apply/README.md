# Handoff: Applying to a multi-set gig (artist + venue)

## Overview
Today applications are **per set**: a guest picks one or more sets and the server writes the applicant into each slot gig's `applicants[]`. The new model:

- An artist applies **once to the whole night**.
- The artist can add an optional **set preference** (one or more open sets, or "No preference", the default). It's only a preference sent with the application. It doesn't reserve anything and doesn't limit who can apply.
- The venue **accepts** applicants and **assigns** each accepted act to a set, either at the moment of accepting or later ("choose set later"). Acts can be reassigned at any time.
- One-set nights use the same flow with a single set. Accepting assigns the set automatically.

The launch venue is still Jesus College Bar (Jez). Everything not mentioned here (guest steps 2–3, invites, duplicate detection, offline, account linking) is unchanged from `design_handoff_guest_apply/`. The venue side builds on `design_handoff_gig_details/` (Console shell, tokens).

## About the design files
`multiset-apply.html` is a **design reference built in HTML**: a self-contained canvas with clickable mobile, desktop and tablet frames and every state. **Don't copy its markup.** Recreate it in React + plain CSS with the existing `--gn-*` tokens and the guest-apply / gig-details components. Sample artists, times and copy marked as sample are illustrative.

## Fidelity
**High-fidelity.** Colours, type, spacing, radii, copy and states are final. Tokens, the status colours and accessibility rules are the same as the guest-apply handoff (44px+ tap targets, 16px inputs, 2px orange focus ring, 4.5:1 contrast). On the artist side, orange is still only used for **Apply to play** and **Send application**. On the venue side, orange is used for **Accept** and the preference highlight.

---

## Data model

### Applicant entry (guest and logged-in artists)
Stored **once per application**, on the group's **applications root gig** (see below), not on every slot.

| Field | Type | Notes |
|---|---|---|
| `preferredSlotGigIds` | `string[]` | **New.** The slot gig ids the artist would prefer. `[]` = "No preference" (the default). Only slots that were open when they applied can be added. Replaces `slotGigIds`. |
| `assignedSlotGigId` | `string \| null` | **New.** The set the venue has given the act. `null` until assigned. |
| `status` | `'pending' \| 'accepted' \| 'declined' \| 'withdrawn'` | Public names are unchanged: sent / accepted / declined / withdrawn. |
| `acceptedAt`, `assignedAt`, `declinedAt`, `withdrawnAt` | timestamp | |
| `declineEmailSendAt` | timestamp | now + 5 minutes; cleared by Undo. |
| `withdrawnAfterAccept` | `boolean` | For the venue notice and the artist copy. |

Everything else on the guest entry (actName, contacts, photo, links, members, needs, bringOwn, note, manageTokenHash…) is unchanged.

**Migration / read compatibility:** when reading an old entry with `slotGigIds` and no `preferredSlotGigIds`, treat `slotGigIds` as the preference. If the same applicant id appears on several slot docs, de-duplicate by `id`.

### Gig (slot) docs
- `applicationsRootGigId: string` on every slot in a multi-slot group. This is the earliest slot by start time. Single-slot gigs point at themselves.
- `bookedApplicantId: string | null` on each slot. Set on assign, cleared on unassign or withdraw.
- `hint` (already added in the guest handoff) stays.
- When an act is assigned, **mirror** them into that slot's `applicants[]` with `status: 'confirmed'` so the existing per-slot readers (gig table, calendar, running order, badge counts) keep working. Remove the mirror on reassign or unassign. Never mirror unassigned or pending applicants.
- Closing applications sets `applicationsOpen: false` on **every** slot in the group.

### "Taken" (artist side)
A set is **taken** when its slot has a `bookedApplicantId`. The public gig payload returns `slots: [{ gigId, startTime, duration, hint, taken }]`, with no act names.

---

## Artist side (mobile first, no login)

### Gig page
Same as the guest handoff, with these changes:
- Section heading by count: "One set" / "Two sets" / "Three sets" / "Four sets" / "Five sets". On the right (13.5px #6B7280), when some but not all are taken: "{open} of {total} still open". When all are taken: "All booked". Hidden when every set is open, and on one-set nights.
- Each row: `Set N` (or `The set` for one set) · `20:00–21:00 · 60 min` in mono (length in #6B7280) · hint · tag.
  - Open: "Open" (#FFEDE7 / #B5462C).
  - Taken: "Taken" (#F3F4F6 / #6B7280). The row bg is #FAFBFC and the name/time are #6B7280.
  - Closed (applications closed, set not booked): "Closed" (grey).
- **One** primary action for the whole gig: **Apply to play** (orange), with the sub-line "About 2 minutes · no account needed". It's the same on mobile (sticky bar) and desktop (aside). The desktop aside lists each set with its tag.

| State | Banner | Primary |
|---|---|---|
| Sets open / some taken | none (invite greeting if invited) | "Apply to play" (orange) |
| All sets taken | grey "All sets are filled" · "Jez has booked every set for Friday 13 November, so this gig isn't taking applications any more. Follow the bar on Gigin to hear about future nights." · button "Follow Jesus College Bar" | disabled "Line-up is full" |
| Applications closed | grey "Applications have closed" · "Jez has stopped taking applications for 13 November. Follow the bar on Gigin to hear about future nights." · "Follow Jesus College Bar" | disabled "Applications closed" |
| Already applied | white, green ✓ "You've applied to this gig" · "{Act} applied on {2 November}. Jez hasn't decided yet. You can change or withdraw your application from your private link." | dark #111317 "View my application" → manage page |

"Already applied" is detected from the device (`guestApplicationLink` in storage) or by the existing duplicate lookup on step 1.

### Step 1: Who you are
The "Which set would you like?" block is replaced:
- Label: **Which set would you prefer?** plus " optional" (400, #6B7280).
- Sub-line: **"Jez will confirm which set you're playing."** (use the booker's display name).
- Options (same 64px cards and 22px checkbox as before):
  1. **No preference**: sub "Happy to play whichever set Jez picks". This is selected by default. Selecting it clears the others.
  2. One card per set: "Set N" + time in mono, with the hint as the sub. Ticking a set clears No preference. Unticking the last one returns to No preference. Several can be ticked.
  3. Taken sets: card bg #FAFBFC, checkbox #F3F4F6, the text is #6B7280, the sub reads "Already booked", there's a "Taken" tag on the right, and `disabled` + `cursor:not-allowed`. They can't be ticked.
- **Hidden on one-set nights.**
- No validation. Remove "Choose at least one set." and the server check `"Choose a set."`.
- Invite pre-fill: if the invite has a slot, pre-tick it as the preference (if it's still open).

### Step 4 review and the manage page
- The review row "Set" becomes **Set preference**: "No preference" (muted) / "Prefers Set 1" / "Prefers Set 1 or Set 2" / "Prefers Set 1, Set 2 or Set 3". It's hidden on one-set nights.

### Applied screen
- Sub: "Jez has your application for Friday 13 November{, and knows you'd prefer Set 1}. We've emailed a copy to {email}."
- What happens next:
  1. **Jez reviews applications**: "Jez looks at everyone who applied for the night and picks the acts."
  2. **You hear back either way**: "By email{ or WhatsApp}. If you're in, Jez confirms which set you're playing, straight away or a little later."
  3. **Change your mind any time**: "Use the private link in your email to edit or withdraw."

### Manage page (private link), by status
| Status | H1 | Pill | Body |
|---|---|---|---|
| Sent | "Your application" | amber "Sent · Jez hasn't decided yet" | The review list with Edit (as today) and "Withdraw my application" |
| Accepted, no set | "You're in" | green "Accepted · set time to be confirmed" | A booking card (see below) and "I can't play any more" |
| Accepted, set | "You're playing Set 1" | green "Accepted · Set 1, 20:00–21:00" | A booking card, "Add to calendar" (.ics) and "I can't play any more" |
| Declined | "Your application" | grey "Not this time" | "Jez has picked the line-up for Friday 13 November and couldn't fit {Act} in this time. Thanks for applying. The bar has your details for future nights." · button "See upcoming gigs at the bar" |
| Withdrawn | "Your application" | grey "Withdrawn" | Before acceptance: the existing copy. After acceptance: "We've told Jez {Act} can't play on Friday 13 November, so the set can go to someone else. Thanks for letting the bar know." |

**Booking card** (radius 14, border #E5E7EB). Header bg `oklch(0.97 0.025 150)`, border-bottom `oklch(0.9 0.05 150)`, mono label "YOUR SET" in `oklch(0.45 0.11 150)`.
- Set assigned: "Set 1" at 30px/600, then `20:00–21:00 · 60 minutes` in mono 16px.
- Not assigned: "To be confirmed" at 24px/600, then "Jez will choose which set you're playing and we'll email you as soon as it's set.{ You said you'd prefer Set 1.}" Below it, "The night's sets" lists each set and time, with "Your preference" (#B5462C) on the preferred ones.
- Rows (84px label column): **Doors** 19:30 · **Where** address + `arrivalNotes` · **Booked by** {bookerDisplayName}, {bookerRole}.

**Editing:** allowed only while Sent (as today). Accepted applications are read-only.

**"I can't play any more"** (accepted only, red text link, under "Plans changed?" / "Let Jez know as soon as you can, so the set can go to someone else.") opens the bottom sheet:
- "Tell Jez you can't play?" / "Jez will be told {Act} can't make Friday 13 November, and the set will be offered to someone else. This can't be undone." / **Yes, I can't play** (`--gn-danger`) / **Keep my booking**.
- Server: `POST /guest-applications/:token/withdraw` now allows `accepted`. It sets `status: 'withdrawn'` and `withdrawnAfterAccept: true`, clears `assignedSlotGigId` and the slot's `bookedApplicantId` and mirror, and emails the venue.

### Emails
All are from Gigin, with the existing shell. The button goes to `/gig/:gigId/application/:token`. Footnote: "This link is just for you, so please don't forward this email. It works until a week after the gig." Footer: "Gigin · You're getting this because you applied to a gig on gigin.co.uk."

**1. Application received** (update to the existing one)
- Subject: `You've applied to play {gigName} at {venueName}`
- "Hi {first}," / "Thanks for applying. {booker} at {venueName} has your application for **{Friday 13 November}**, and will get back to you by email{ or WhatsApp}."
- Box "YOUR APPLICATION": **{Act}** · "Set: you'd prefer {Set 1}. {booker} will confirm which set you're playing." or "Set: no preference. {booker} will confirm which set you're playing." · "{n} members". Omit the Set line on one-set nights.
- "Need to change something, or can't make it any more? Use your private link:" · button **Change or withdraw your application**

**2. Accepted, set to be confirmed** (accept with "choose set later")
- Subject: `You're in: {gigName} at {venueName}`
- "Hi {first}," / "Good news. {booker} has accepted {Act} for {gigName} at {venueName} on **{Friday 13 November}**." / "Your set time is still to be confirmed. {booker} will choose which set you're playing, and we'll email you again as soon as it's set."
- Box "YOUR BOOKING": **{Act} · {Friday 13 November}** · "Set: to be confirmed{ (you said you'd prefer Set 1)}" · "Doors {19:30} · {address}"
- "Can't make it after all? Let {booker} know from your private link, so the set can go to someone else." · button **View your booking**

**3. Accepted with a set**, also sent when a set is assigned later
- Subject: `You're playing {Set 1} at {venueName} on {Fri 13 Nov}`. On one-set nights: `You're playing at {venueName} on {Fri 13 Nov}`
- "Hi {first}," / "Good news. {booker} has accepted {Act} for {gigName}, and you're playing **{Set 1, 20:00–21:00} on {Friday 13 November}**."
  If it was assigned later (the act already had email 2), the second line is: "{booker} has confirmed your set for {gigName}: you're playing **{Set 1, 20:00–21:00} on {Friday 13 November}**."
- Box "YOUR SET": **{Set 1} · {20:00–21:00} ({60 minutes})** · "Doors {19:30}" · "{address}. {arrivalNotes}"
- Same pre-button line · button **View your booking**

**4. Set changed** (reassign or swap; not drawn, same shell as 3)
- Subject: `Your set time has changed: {gigName}`
- "{booker} has moved {Act} to **{Set 2, 21:30–22:30}** on {Friday 13 November}." The box is the same as email 3.

**5. Removed from a set** (unassign; still accepted)
- Subject: `Your set time is to be confirmed: {gigName}`
- "You're still playing at {venueName} on {Friday 13 November}, but {booker} has changed the running order. We'll email you as soon as your new set time is confirmed."

**6. Declined**: the existing template, sent at `declineEmailSendAt` (5 minutes after Decline) unless undone.

**7. To the venue, when an accepted act withdraws**
- Subject: `{Act} can't play on {Fri 13 Nov}`
- "{Act} has withdrawn from {gigName}. {Set 1} is open again. You can give it to someone you've accepted, or accept someone who's waiting."

Undoing an accept or an assignment within the toast window (7s) cancels a queued email. Send emails 2–5 with a **10-second delay** so Undo can cancel them.

---

## Venue side (desktop + tablet)

Route and shell: as in the gig details handoff (sidebar 248px; a 72px icon rail on tablet < 1180px; top bar 64px). The page replaces the per-set running-order cards **for application review** with the layout below. Grid: `minmax(0,1fr) minmax(300px,380px)`, gap 24px. The right column is sticky.

Top bar right: **Preview listing** · **Edit gig** · **Cancel gig**. Cancel gig is outlined in red: border `oklch(0.85 0.06 25)`, text `oklch(0.48 0.16 25)`, hover bg `oklch(0.97 0.02 25)`. It opens a centred dialog: "Cancel {gigName}?" / "All {n} acts who applied, including the {n} you've accepted, will get an email saying the gig is off. This can't be undone." / **Keep gig** · **Yes, cancel gig** (`--gn-danger`). Use the existing cancel-gig flow. Afterwards the pill reads "Cancelled".

Header: mono `FRIDAY 13 NOVEMBER · JESUS COLLEGE BAR · TWO SETS`, the title at 30px/600, and a pill:
- "Open for applications" (neutral #F1EEEA / #5E5750)
- "Applications closed" (grey)
- "Confirmed" (green; closed and all sets filled)

### Left column tabs
Underline tabs above the left column (42px, 15px; the active one is 600 #0F1115 with a 2px #0F1115 underline, the inactive one is 500 #6B7280):
- **Applications** with a count badge of waiting acts (#FFEDE7 / #B5462C, hidden at 0). This is the default.
- **Running order** with a mono badge `1/2` (sets filled).
The Sets panel on the right stays visible on both tabs.

### Running order tab
The timeline from the gig details handoff (56px time column, a 2px rail with dots, ops rows for Load-in, Sound check, Doors, Break · {n} min (derived from the gap between sets) and Curfew). Set cards:
- Header: "Set N" 16px/600 · range · length in mono, plus a pill: **Filled** (green) / **Open** (orange soft) / **Open again** (amber, after a withdrawal).
- Filled: a 48px photo, name + Guest tag, `{kind} · {n} members`, chips for the fit ("Their pick" / "Preferred Set 2" / "No preference") and the tech summary, and **Change ▾** (the same menu as the Sets panel). The row is draggable.
- Empty: the withdrawn notice if any, a dashed "Drag an act here" zone with **Assign ▾**, and the suggestion line.
- Footer (empty sets only, when relevant): "{n} waiting applicants prefer this set" · **See them**. This switches to Applications with Waiting + "Prefers Set N" applied.
- Set cards are drop targets, with the same rules and highlight as the Sets panel slots.
- The rail dot is green when filled and orange when open.

### Applicant list (Applications tab): one list for the night, not grouped by set
**Toolbar:**
- Segmented tabs (34px, bg #ECEDF0, the active one is white with a shadow): **All · Waiting · Accepted · Declined**, each with a mono count. Withdrawn acts appear in All only.
- "Prefers" filter chips: **Any set · Set 1 · Set 2 …** (32px pills; the active one is #111317). A set filter shows acts who prefer that set **plus** acts with no preference. Hidden on one-set nights.
- Sort: Waiting first, with New (unviewed) at the top, then Accepted, Declined, Withdrawn. Within each group, newest first.

**Applicant card** (white, border, radius 12, padding 16px 18px, grid `64px 1fr`, gap 16):
1. Photo 64×64, radius 10 (the guest `photo.url` or the profile image; initials fallback).
2. Name 16px/600 + a **Guest** tag (11.5px/500, #F3F4F6, border #E5E7EB, radius 4) for `type: 'guest'`. Meta 13.5px #6B7280: `{kind} · {n} members · applied {2h ago}`.
3. Status chip, top right (12.5px/500): **New** (orange soft) · **Waiting** (grey) · **Accepted · Set 1** (green) · **Accepted · no set yet** (amber) · **Declined** (grey) · **Withdrew 12 Nov** (grey). One-set nights show "Accepted".
4. Tag row (13px pills):
   - Preference: **Prefers Set 2** (#FFEDE7 / #B5462C) · **No preference** (#F3F4F6 / #4B5160). If every set they prefer has been given to another act (and they're not assigned): amber **Prefers Set 2 · given to Maya Reid**.
   - Music preview: a brand dot + `Spotify · Blue in Green (live)`. Use the first of `links.spotify`, `links.youtube`, a SoundCloud link, or `links.instagram`. Fetch the title via oEmbed and cache it on the applicant.
   - Tech: a dot + text from `computeCompatibility`. Green "Fits the bar's kit"; amber "Needs a chat: guitar amp, monitors"; grey "Tech rider not filled in".
5. Note: 14px #2F3440 in curly quotes. "No note" in #6B7280 if empty.
6. Actions (36px buttons, radius 8):
   - Left: **Listen** (or **Watch** for YouTube/Instagram) · **Contact**.
   - Right, waiting: **Decline** (outline) · **Accept** (orange).
   - Right, accepted: a set button: **Set 1 ▾** (outline), or **Choose a set ▾** (dark) if not assigned. It opens the set panel in "change" mode.
   - Right, declined: **Undo decline** (text).
   - Withdrawn: no right actions; the card's photo and name are muted.
7. Inline panels (one open per card, toggled by the button that opened it):
   - **Listen**: a dark #111317 player row with a 44px brand tile, the title, `Spotify · 4:12`, and "Open in Spotify". In the build, use the Spotify / YouTube / SoundCloud embed iframe at 80px (audio) or 16:9 at 320px (video).
   - **Contact**: "Contact {contactName}{ (applied as a guest, no Gigin profile)}" and a 36px chip per method: Email (mailto), Phone (tel), WhatsApp (wa.me, only if opted in), Instagram, Gigin (Open profile, for profile artists). No in-app messaging.
   - **Accept** (set panel): title "Accept {Act} for which set?". Note: "They'd prefer {Set 2}. You can pick any open set." or "No preference, so any open set works." Then a grid of set buttons (`auto-fill minmax(150px,1fr)`, 56px+):
     - Their pick: border #FF6C4B, bg #FFF7F4, sub "Their pick" (#B5462C, 600).
     - Open: white, sub "Open".
     - Taken: disabled, grey, sub "Taken · {Act}".
     - Footer: **Cancel** · **Accept, choose set later**.
     - When every set is filled: title "All sets are filled", note "You can still accept them and give them a set later, for example if someone drops out."
   - **Change** (set panel for an accepted act): title "Move {Act} to which set?" and note "…Picking a taken set swaps the two acts." Taken sets are enabled with the sub "Swap with {Act}". The current set is disabled, with "Current set". Footer: **Cancel** · **Remove from set**.
   - **One-set nights:** Accept books the act immediately (no panel) if the set is free. If it's already filled, the panel opens with "The set is filled" and "Accept, choose set later".

### Sets panel (right)
Card titled **Sets** (or **The set**), with the mono `1 OF 2 FILLED` and a segmented progress bar (orange = filled).

**To-do line** (radius 9, 18px status circle):
- No one accepted: grey · "No acts accepted yet" / "Accept applicants, then give each one a set." For one set: "No act accepted yet" / "Accept an applicant and they're booked for the set."
- Partly done: amber ! · **"{2 acts} accepted, {1 set} still to assign"**, with the sub "{1 accepted act} waiting for a set" or "Accept another act to fill it".
- Done: green ✓ · **"All sets filled"** (or "Set filled"), with the sub "{n acts} still waiting to hear back" or "Everyone has heard back".

**Slots**, one per set (radius 10, border 1.5px, padding 12px; 9px 10px from 4 sets up):
- Header: "Set N" 14px/600 · `20:00–21:00` mono · the length on the right in mono.
- **Filled:** a draggable act row (grip, 30px avatar, name, and a fit line: green "Their pick" / "Preferred Set 2" / "No preference") plus a **Change ▾** menu. The menu lists accepted acts with no set (preference matches first, tagged "Prefers this set"), acts on other sets ("Swap with Set 1"), and "Remove from this set" (red; "{Act} stays accepted").
- **Empty:** a dashed drop zone, "Drag an act here" (or "No act yet" / "Drop here" while dragging), plus an **Assign ▾** menu.
  - **Suggestion** under it, when there are accepted acts with no set: "Suggested: **{Act}**, prefers this set". If nobody prefers it, use an act with no preference ("no preference"), or else one whose preferred set is taken ("wanted Set 2, now taken"). There's an inline **Assign** button. A suggestion never assigns on its own.
- **Withdrawn notice** on an empty slot (amber soft, 12.5px): "{Act} withdrew on {12 Nov}, so Set 1 is open again." Clear it when the slot is filled.
- **While dragging:** slots the dragged act prefers get a #FFB6A5 border and a "Their pick" tag. The hovered slot gets a #FF6C4B border and #FFF7F4 bg.
- **Drop rules:** dropping on an empty slot assigns. Dropping on a filled slot swaps the two acts: the displaced act goes to the dragged act's old set, or to "no set yet".

**Accepted, no set yet** tray (under the slots, only if any): draggable rows with a grip, avatar, name, and the preference line (#B5462C; amber "Prefers Set 2, given to Maya Reid" on a conflict), plus an **Assign ▾** menu of sets ("Their pick · open" / "Open" / "Replace {Act} (they'll have no set)"). The caption on the right reads "Drag onto a set".

Drag and drop must also work with touch (tablet). Use pointer events or a small DnD library. The Assign / Change menus are the accessible fallback, and they're keyboard-operable.

### Close applications card
- All sets filled (border 1.5px #FF6C4B): "**All sets filled. Close applications now?**" (one set: "Set filled. Close applications now?").
  - With waiting acts: "{n acts} still waiting to hear back. Closing stops new applications." and a checkbox (default on) "Send a polite no to the {n} still waiting".
  - Without waiting acts: "Nobody else is waiting. Closing stops new applications and takes the gig off the bar's page."
  - Buttons: **Close applications** (dark) · **Not yet** (hides the card until something changes).
- Some sets still open, and at least one act accepted: "**Close applications for the rest?**" / "{n sets} still to fill. Closing stops new applications. You can still accept acts already waiting, or give a set to anyone you've accepted." · **Close applications** (outline).
- Closed: "Applications closed" / "The line-up is set. Nobody new can apply." (or "Nobody new can apply. You can still accept acts who applied and give them a set.") · **Reopen applications**.

### Share card
While open: the "Share the gig" link field with **Copy** (shows "Copied" for 1.4s) and **Invite from My Contacts**. Hidden when closed.

### Sound tech card (always shown, under Share)
White card, radius 12, padding 16px 18px. Title "Sound tech" 15px/600.
- **Set:** a 40px dark avatar (initials), the name 14.5px/600, and the line `{role} · {phone} · arrives {18:30}` in 13px #4B5160. Top right: an outlined **Edit** button (32px, with a pencil icon).
- **Empty:** "Nobody added yet. Add who's running the desk so you have their number on the night." plus a full-width dashed 40px button **+ Add sound tech**.
- **Editing (inline, the same card):** labelled 38px inputs for **Name**, **Role** (default "House engineer"), **Phone** and **Arrives at**. Footer: **Remove** (red text, only when editing an existing tech) · **Cancel** · **Save** (dark). Save needs a name.
- Data: `gig.soundTech: { name, role, phone, arrives } | null` on the root gig. Default it from `venue.defaultSoundTech` if one is set.

### Notes card (always shown, under Sound tech)
Title "Notes" + the sub "Only you and your team see these" (12px #6B7280).
- **Has notes:** the text at 13.5px/1.55 with `white-space:pre-wrap`, plus an outlined **Edit** button at the top right.
- **Empty:** a full-width dashed 40px button **+ Add a note**.
- **Editing:** a 4-row textarea (placeholder "e.g. Load-in through the side gate. Two drinks per act on the house.") · **Cancel** · **Save note** (dark). Saved with the existing `handleSaveNotes`.

### Toasts and Undo
A dark toast, bottom centre, for 7s, with **Undo**:
- "{Act} accepted for Set 1. We've emailed them their set time."
- "{Act} accepted. We've told them their set time is still to be confirmed."
- "{Act} declined. They'll get a polite email in 5 minutes."
- "{Act} assigned to Set 2. We'll email them their set time."
- "{Act} is now on Set 2. {Other} moved to Set 1. We'll email both."
- "{Act} removed from Set 1. They're still accepted, with no set yet."
- "Applications closed.{ n acts will get a polite no.}"

### Scaling (1 → 5 sets)
- **1 set:** no preference question for artists. No preference tags, filter, tray or set panels for the venue. Accept = booked into the set. Labels read "The set".
- **2–3 sets:** as drawn.
- **4–5 sets:** compact slot padding. Filter chips wrap. The set-panel grid wraps to 2–3 columns.

---

## Server changes (`gigin-api/routes/guestApplications.js` + gigs routes)
- **Create:** validate `preferredSlotGigIds` (optional; each id must be in the group and not taken). Write **one** applicant to `applicationsRootGigId`. Don't loop over slots. Remove `"Choose a set."`. `setLabel` → the preference label.
- **Patch:** accept `preferredSlotGigIds`. Write only to the root.
- **Withdraw:** allow `accepted` (see the manage page). Free the slot.
- **New venue endpoints** (auth: venue members with `gigs.update`):
  - `POST /gigs/:rootGigId/applications/:id/accept` `{ slotGigId | null }`
  - `POST /gigs/:rootGigId/applications/:id/assign` `{ slotGigId | null }`. This handles swaps in a single transaction.
  - `POST /gigs/:rootGigId/applications/:id/decline`, and `…/undo` (within the window).
  - `POST /gigs/:rootGigId/close` `{ declineWaiting: boolean }`
  - Run every assign/swap in a Firestore transaction across the root and the affected slot docs, so two tabs can't double-book a set.
- **Public gig payload:** `slots[].taken`.
- **Logged-in artists:** the same model. The logged-in apply on `GigPage` sends one application with `preferredSlotGigIds` instead of one per slot.

## Files
- `multiset-apply.html`: the canvas with every frame (artist A1–A15, venue V1–V11 plus V1b for the running order tab), states and edge cases.
- `CURSOR_PROMPT.md`: the prompt to paste into Cursor.
