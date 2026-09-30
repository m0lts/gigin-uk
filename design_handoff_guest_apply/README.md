# Handoff: Guest application flow (artist side)

## Overview
Artists can apply to a gig from a link, **with no account, profile or login**. The launch venue is **Jesus College Bar, Cambridge**, where Jez books the gigs. Artists open links on their phones from WhatsApp, Instagram DMs and email, so design and build **mobile first**, with a clean desktop layout.

Today, applying on `/gig/:gigId` (GigPage) requires a login plus a complete artist profile (`validateMusicianUser`, `NoProfileModal`, `ProfileCreator`). For guest-enabled gigs this is replaced by a 4-step guest wizard. **Only an act name, a contact name and one contact method are required.** The full flow should take under 2 minutes, and steps 2–3 are skippable.

There are **no payments, fees, ticketing or money** anywhere in this flow. Chat and messaging are hidden.

## About the design files
`guest-apply.html` is a **design reference built in HTML**: a self-contained, clickable prototype with a mobile phone frame, a desktop browser frame and all edge states. **Don't copy its markup.** Recreate it in React + plain CSS using the existing GigPage patterns and `--gn-*` tokens. Sample content (Jez, the Fen Street Trio, the kit list, the entry instructions) is illustrative. Jez's surname and the exact kit are placeholders.

## Fidelity
**High-fidelity.** Colours, type, spacing, radii and states are final.

## Design tokens
These are the existing tokens in `global.styles.css`: `--gn-font` Geist, `--gn-font-mono` Geist Mono, `--gn-ink` #0F1115, `--gn-ink-2` #4B5160, `--gn-muted` #6B7280, `--gn-line` #E5E7EB, `--gn-line-soft` #F0F1F3, `--gn-console-bg` #F6F7F9, `--gn-orange` #FF6C4B, `--gn-new-bg` #FFEDE7, `--gn-new-text` #B5462C.

Status colours are the same as the console: green `oklch(0.66 0.14 150)` / `oklch(0.45 0.11 150)` / `oklch(0.95 0.04 150)`, and amber `oklch(0.72 0.15 70)` / `oklch(0.48 0.11 60)` / `oklch(0.95 0.05 80)`.

New values:
```css
--gn-error: #E5484D;          /* invalid field border */
--gn-error-text: #C52A2F;
--gn-danger: oklch(0.52 0.16 25);  /* withdraw button */
--gn-warn-soft-bg: #FFF7F4; --gn-warn-soft-border: #FFD2C6; /* dupe, upload error */
```

Accessibility rules:
- Tap targets are **44px or larger**. Primary buttons are 54px on mobile and 52px on desktop.
- Inputs are **16px** so iOS doesn't zoom, and 52px tall.
- Focus is `outline: 2px solid #FF6C4B; outline-offset: 2px`.
- Body text is at least 14px. Contrast is 4.5:1 or better everywhere.

**Orange is only used for "Apply to play" and "Send application".** Continue and other primaries are #111317.

## Layout
- **Mobile (< 768px):** a 56px header (the `gigin.` logo plus the venue name, or step chrome), a scrolling content area with 18px side padding (max 640px), and a **sticky bottom action bar** (white, border-top, padding 12px 16px 18px) with the primary button.
- **Desktop (768px and up):** the content max-width is 1120px on the gig page and 960px on the steps, with padding 36px 32px. A **340px sticky aside** on the right shows the gig summary, plus the Apply button on the gig page. Actions sit inline, right-aligned, under the form, with no bottom bar.

---

## Screens

### 0. Link preview (WhatsApp)
There is nothing to build in-app except **server-rendered og tags** for `/gig/:gigId`:
- `og:title`: "Friday Night Live · Jesus College Bar"
- `og:description`: "Fri 13 Nov · 2 sets from 20:00 · Cambridge. Apply in 2 minutes, no sign-up."
- `og:image`: the venue's main photo, 1200×630.

Invite links look like `/gig/:gigId?invite=<inviteId>`. That's the existing `inviteId` param; alias `invite` to it.

### 1. Gig page, guest view
The order of content:
1. **Invite greeting** (only if the invite is valid and unclaimed): a 40px avatar and "**Hi Sam,** Jez invited you to apply for this gig at Jesus College Bar." Use `crmEntry.name` for the first name.
2. Hero photo (radius 14px, 190px tall on mobile, 300px on desktop).
3. Date line in Geist Mono 13px (`FRIDAY 13 NOVEMBER 2026 · DOORS 19:30`), the title (32px/600 mobile, 40px desktop), and the venue line.
4. **Sets**: a bordered list with rows in a `64px 1fr auto` grid. Each row shows "Set N", the time in mono, a hint line (new optional `slot.hint` field; hide it if empty) and a status tag: Open (#FFEDE7 / #B5462C), Booked or Played (#F3F4F6 / #6B7280). Use the slot sibling data (`findSlotSiblingsFromFlatGigs`).
5. **About the night**: `gig.extraInformation`, 16px, line-height 1.6.
6. **What the bar provides**: a grid of `auto-fill minmax(160px,1fr)` chips (white, border, radius 10px), each with a green tick, label and quantity, from `getTechRiderForDisplay(venue.techRider)`. Only list items the venue has. Below: one line naming notable items the bar doesn't have.
7. **Where**: a map card (reuse `useMapbox`), the address, the entry instructions (new optional venue field `arrivalNotes`) and an "Open in Maps" link.
8. "Booked by {name}, {role}", 13.5px muted.
- The primary button is "Apply to play" (orange), with the sub-line "About 2 minutes · no account needed".

### 2. Step 1 of 4: Who you are
Step header (56px): a back button (44×44), `STEP 1 OF 4` in mono plus the step name centred, and a Skip button on the right on steps 2–3 only. Below it, a 4-segment progress bar (4px; done #FF6C4B, current #0F1115, future #E5E7EB).
- Title "Who are you?" (26px/600) and the sub-line "Only your act name, your name and one way to reach you are needed."
- **Act or band name**\* and **Your name**\*: 52px inputs.
- **How can Jez reach you?**\* at least one of: Email / Phone / Instagram. Each is a 52px row with a fixed 84px label. When a phone number is entered, show a checkbox "Jez can message me on WhatsApp on this number" (default on).
- **Invite pre-fill:** name, act and email from the CRM contact, with the note "Filled in from Jez's invite. Change anything that's out of date."
- **Which set would you like?**: multi-select cards (min-height 64px, a 22px checkbox that fills orange when on, the time in mono, and the hint). Default is the set Jez invited them for; otherwise none.
- Validation happens on Continue: empty required fields get a `--gn-error` border, and the contact hint becomes "Add at least one so Jez can get back to you."
- **Duplicate check (E3)**: on blur of email or phone, look up existing applications for this gig by normalised email or phone. If one is found, show a soft card: "You've already applied with this email", when and which set, and two buttons: **View my application** (sends a magic link to the matched contact; the prototype jumps straight to Manage) and **Apply as another act**.

### 3. Step 2 of 4: Photo and links (skippable)
- Sub-line: "Jez uses these to promote the night on the bar's socials. Optional."
- **Press photo**: a dashed 168px drop zone ("Add a press photo", "From your camera roll · JPG or PNG, up to 10 MB"). After upload: a thumbnail (88px), the filename, the size, and Replace / Remove.
- **Links**: Spotify, YouTube, Instagram, Website. Each is a 52px row with a brand dot (use the existing `--gn-spotify-green` etc.).
- **Other files** for posters and posts: up to 5 files, as a list with ✕, plus a dashed "+ Add files" button.
- **Upload error (E4)**: a soft card saying what failed and the limit ("fen-trio-hires.tif is 38 MB, and the limit is 10 MB…"), with **Choose another photo** and **Skip photo**. The message makes clear nothing else is lost. Compress on the client before upload, and use signed upload URLs.

### 4. Step 3 of 4: Tech rider (skippable)
- **Who's in the band?**: one card per member. An optional name input and instrument chips (Vocals, Guitar, Bass, Double bass, Drums, Keys, Sax, Violin, Other; multi-select; selected is #111317). "+ Add a member".
- **What do you need from the bar?**: a table with the columns *Item / Bar has / We need*. Rows come from the **full** `techRiderConfig` list the venue has filled in, including items where the bar has "No". Each row is a 56px button that toggles a 26px checkbox. Rows ticked where the bar has "No" get a #FFF7F4 background.
- **We'll bring our own**: removable dark chips, plus an input and an "Add" button.
- **What Jez will see**: a live summary using the existing `computeCompatibility` groups, relabelled and with money removed:
  - **Provided by the bar** (green dot): items ticked that the bar has.
  - **Covered by your act** (dark dot): the bring-own list.
  - **Needs a chat** (amber dot): items ticked that the bar doesn't have.
  - Guests have no profile tech rider, so build a temporary rider object from the ticks and bring-own list, and pass that to `computeCompatibility`. **Don't show any hireable or hire-fee UI** for guests.

### 5. Step 4 of 4: Note and review
- Title "Nearly done". An optional **Note to Jez** (500-character limit with a counter).
- **Review list**: rows for Act and contact · Set · Photo and links ("Skipped" in muted if empty) · Tech rider (N members, using N of the bar's items, bringing N). Each row has an **Edit** link (#B5462C) that opens that step with the header showing `EDITING` and the primary button "Save". Save returns to review.
- Small print: "Jez will see everything above. We'll email you a copy with a private link to change or withdraw it."
- Primary button: **Send application** (orange).
- **Offline or slow (E7)**: keep the whole draft in `localStorage` (keyed by gig + invite) from step 1 onwards. If submit fails or `navigator.onLine` is false, show a dark toast above the bottom bar: "No connection. Your application is saved." and "Everything you've typed is kept on this phone…", with a **Retry** button. The primary button shows "Waiting for connection…" (disabled). Retry automatically on the `online` event. Make the request idempotent with a client-generated `applicationId`.

### 6. Applied
- A 56px green check, "Application sent to Jez" (28px/600), and "Jez has your application for Set 1 on Friday 13 November. We've emailed a copy to {email}."
- **What happens next**: three numbered rows: Jez reviews applications · You hear back either way (by email, or WhatsApp if ticked) · Change your mind any time (private link).
- **Account prompt** (soft, dismissible, #FAFBFC card with a ✕): "Save your details for next time?" and "…Your application is sent either way.", with **Create a free account** (pre-fills sign-up and links the guest application to the new profile) and **Not now**. Remember a dismissal per device.

### 7. Confirmation email
- Subject: "You've applied to play {gig} at {venue}". It's from Gigin.
- The body contains: a greeting by first name; that Jez has the application for the date and will reply by email (or WhatsApp); a bordered summary (act, set, members); one button, **Change or withdraw your application** → `/gig/:gigId/application/:token`; a line saying the link is private and not to forward it (valid until the gig date); and a footer.
- Also send **when edited or withdrawn**, and when the venue accepts or declines (that's a separate template, not designed here).

### 8. Manage application (private link)
- The header's right side reads "Private link for {first name}".
- Date line, "Your application", and a status pill: *Sent · Jez hasn't decided yet* (amber) / *Accepted* (green) / *Not this time* (grey) / *Withdrawn* (grey).
- The same review list with Edit, plus a "Note to Jez" row. Edits save immediately and notify the venue. Editing is allowed until the venue confirms the line-up or the gig date passes.
- **Withdraw my application** (red text link) opens a bottom sheet (a centred dialog on desktop): "Withdraw your application?" and "Jez will be told you can't make {date}. You can apply again while the gig is still open.", with **Yes, withdraw** (`--gn-danger`) and **Keep my application**. After withdrawing, the status becomes Withdrawn, with an explainer and "Back to the gig".

## Edge states
| ID | State | Behaviour |
|---|---|---|
| E1 | Gig closed or full (`isGigClosedToNewApplicants`) | Grey banner "Applications have closed" plus "Follow Jesus College Bar". Set tags show Booked. Primary is disabled: "Applications closed". |
| E2 | Gig date passed | Banner "This gig has already happened" plus "See upcoming gigs at the bar". Sets show Played. Primary disabled. |
| E3 | Already applied | See step 1. |
| E4 | Upload failed or too big | See step 2. |
| E5 | Invite expired | Amber banner "This invite link has expired", "The gig is still open, so you can apply as normal." No greeting and no pre-fill. **Don't block access** (today this sets `inviteValidation = 'expired'`). |
| E6 | Invite opened by someone else | Neutral banner "This invite was sent to Sam Okoro", "Not Sam? … we won't fill in Sam's details." Triggered when the invite has already been claimed by a submitted application, or the guest taps "Not you?". No pre-fill. |
| E7 | Offline during submit | See step 4. |

## Data changes
**New collection `guestApplications`** (or applicant entries with `type: 'guest'` on the gig):
```
{ applicationId, gigId, slotGigIds[], venueId, inviteId?, crmEntryId?,
  actName, contactName,
  contacts: { email?, phone?, whatsapp: bool, instagram? },
  photo?: { path, width, height }, assets: [{ path, name, size }],
  links: { spotify?, youtube?, instagram?, website? },
  members: [{ name?, instruments: [] }], needs: [techRiderKey], bringOwn: [string],
  note?, status: 'sent'|'accepted'|'declined'|'withdrawn',
  manageTokenHash, createdAt, updatedAt, source: 'invite'|'public' }
```
- **`gigInvites`**: add `claimedByApplicationId` and `claimedAt` (for E6). Expired invites fall back to public apply on guest-enabled gigs.
- **Gig slots**: an optional `hint` string per set.
- **Venue**: an optional `arrivalNotes`, and `bookerDisplayName` / `bookerRole` (for "Booked by…").
- **Gig flag**: `guestApplications: true` (enable per venue; starting with Jesus College Bar).

## Server
- An unauthenticated `POST /guest-applications` (create), `PATCH /guest-applications/:token` (edit) and `POST /guest-applications/:token/withdraw`. Rate-limit by IP and gig, with a captcha fallback after repeated attempts.
- Signed upload URLs: images up to 10 MB (JPG/PNG/HEIC→JPG), other assets up to 20 MB.
- The duplicate lookup returns only "exists / set / date", never the details. Viewing an existing application goes through a magic link sent to the matched contact.
- Tokens: 32+ bytes random. Store the hash only. They expire at gig date + 7 days.

## Venue side (needed for this to work)
Guest applicants appear in the applications list and the running order (the gig details handoff) with a **Guest** tag. There's no profile, so the details show the photo, links, contact methods (email / phone / WhatsApp / Instagram) and the tech summary. Accepting or declining sends email (and WhatsApp if opted in). Messaging stays hidden.

## Changes to existing components
- `GigPage.jsx`: a guest branch that skips `validateMusicianUser`, `NoProfileModal` and `ProfileCreator`, and hides fee, ticketing, negotiation and messaging UI. `applyWizardStepList` becomes `['who','assets','tech','review']` for guests.
- The equipment-check step's JSX is adapted into `GuestTechStep` (no hireable section).
- `computeCompatibility`: accept a guest rider object.
- `gigs.js`: `getGigInviteById` stays; add `claimInvite`.
- The `invite` query param is an alias for `inviteId`.

## Files
- `guest-apply.html`: the clickable prototype (mobile + desktop + edge states + notes).
- `CURSOR_PROMPT.md`: the prompt to paste into Cursor.
