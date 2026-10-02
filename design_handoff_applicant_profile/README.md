# Handoff: Applicant profile popup (guests and Gigin artists)

## Overview
On the venue gig page (Jez at Jesus College Bar), clicking an applicant's **name**, **photo** or the new **View profile** button opens an **almost full-screen popup** over the gig page. It shows the act's profile with a social-media style layout, plus the gig actions for this booking. **Guests and Gigin artists use exactly the same layout.** The only difference is the **Message** button: it works for Gigin artists (as a "coming soon" placeholder) and is greyed out for guests.

This replaces:
- **Guests:** the bare `GuestApplicantPanel` side panel (`GigApplications.jsx`, ~line 4031).
- **Gigin artists:** "View profile", which opened `/artist/:id` in a new tab. The full public profile page stays as it is; the popup links to it.

It builds on `design_handoff_multiset_apply/` (the applicant list, the Sets panel, accept with a set or "choose set later").

## About the design files
`applicant-profile.html` is a **design reference built in HTML**. Frame 1a is a Gigin artist (Maya Reid) and 1b is a guest (The Fen Street Trio), both opened over the multi-set gig page. Everything is clickable: the arrows, Esc, Message, the chevron menu, Accept with a set, Decline, and notes.

**Don't copy its markup.** Recreate it in React + plain CSS with the `--gn-*` tokens. Sample content (bios, photos, history numbers) is illustrative.

## Fidelity
**High-fidelity.** Colours, type, spacing, radii, copy and states are final.

## Don't change (already final in the codebase)
- **The sidebar:** `Sidebar.jsx` and the `.sidebar--console` styles in `dashboard.styles.css` (the collapse button at the top right, the venue selector without an avatar, the collapsed state). Don't modify Sidebar.jsx or the sidebar styles in dashboard.styles.css. They're already final.
- **Wording:** venue outreach is "Offer", not "Invite": "Offer gig", "Offer the gig to artist", "Offer gig to a saved Contact".

---

## Popup shell
- **Backdrop:** `rgba(15,17,21,0.5)` over the gig page. Clicking it closes the popup.
- **Panel:** `position:absolute; inset:28px` within the dashboard window (not the sidebar), radius 16px, bg #F6F7F9, shadow `0 24px 64px rgba(15,17,21,0.35)`. It has `role="dialog"` and `aria-modal`, focus is trapped inside, and focus returns to the trigger on close.
- **Top bar** (60px, white, border-bottom #E5E7EB, padding 0 20px 0 24px):
  - Left: ‹ › buttons (34px, outlined) · `2 OF 10 APPLICANTS` (Geist Mono 13px #4B5160) · "· Friday Night Live" (13px #9AA0AA).
  - Right: hint "Esc to close · ← → to move" (12.5px #9AA0AA) and × (36px).
- **Keyboard:** Esc closes, and ← → move through the applicants **in the list's current filter and sort order** (wrapping round). Arrows don't fire while typing in a textarea.
- **URL:** open it via `?applicant=<id>` on the gig page, so the browser back button closes it and a link to the profile can be shared within the team.
- The body scrolls; content max-width 1240px, centred.

## Hero (full width, above the two columns; padding 20px 32px 0)
- **Cover:** 280px tall, radius 16, `object-fit:cover`.
  - Gigin artist: the profile hero image (`heroImage` / `heroMedia`), applying the saved `heroBrightness` and `heroPosition`.
  - Guest: their press photo (`photo.url`). With no photo: a neutral #E9E6E1 block.
- **Avatar:** a 140px circle with a 5px #F6F7F9 border and shadow `0 4px 14px rgba(15,17,21,0.12)`, overlapping the cover by 56px at the left (28px inset). It uses the profile picture, or for guests the press photo; the fallback is initials.
- **Name:** 32px/600, letter-spacing -0.02em. Then a tag:
  - Guest: **Guest** (white, border #E5E7EB, #4B5160, 12px/500, radius 5).
  - Gigin artist: **✓ On Gigin** (green soft: `oklch(0.95 0.04 150)` / `oklch(0.45 0.11 150)`).
- **Meta:** 15px #4B5160, `{kind} · {n} members · {town}`.
- **Right, aligned to the name:** the Message split button (see below).
- **Stats row** (padding 18px 8px 0 28px): value 18px/600 over a label 12.5px #6B7280, with a 28px gap.
  - Gigin artist: **{n}** gigs on Gigin · **{n}** times at the bar · **{n}** members.
  - Guest: **{n}** members · **New** to the bar · **Guest** no Gigin profile yet.
- **Link chips** on the right of the stats row: pill 36px, border #E5E7EB, an 8px brand dot plus the label (Spotify #1DB954, YouTube #FF0033, SoundCloud #FF5500, Instagram #E56969, Website #6B7280). Each opens the link in a new tab.

## Message split button (the only guest/artist difference)
A two-part button: **[ Message | ▾ ]**, 38px tall. The left part is radius 9px 0 0 9px, with a speech-bubble icon and 14px/500 text. The right part is a 36px chevron, radius 0 9px 9px 0. Both are outlined #E5E7EB on white.

**Gigin artist**
- The Message part is enabled. Clicking it (or Message in the menu) shows a dark popover under the button for 3.5s:
  - Title: **"Messaging is coming soon"** (13.5px/600)
  - Body: "For now, contact {first name} at {email}." (13px #C9CDD4). If there's no email: "For now, contact {first name} using the details in Contact."
- This is a placeholder while messaging is behind `FEATURES`. When it's back, it opens the existing conversation (`sendToConversation`).

**Guest**
- The Message part has `aria-disabled="true"`, bg #F3F4F6, text #9AA0AA, `cursor:not-allowed`. It stays focusable so the tooltip can be read.
- On hover or focus, show a dark tooltip (300px, 13px/1.5): **"{First name} doesn't have a Gigin account, so you can't message them here. Contact them by {methods} instead."**
  - `{methods}` lists the methods they gave, in order email, phone, WhatsApp, Instagram, joined with commas and "or". Lowercase "email" and "phone"; keep "WhatsApp" and "Instagram" capitalised.

**Chevron menu** (both; 240px, white, radius 10, padding 6, shadow; right-aligned under the button)
1. **Message**: 14px/500, with the sub-line:
   - Gigin artist: "Open a conversation on Gigin" (shows the coming-soon popover).
   - Guest: greyed out (#9AA0AA), sub-line "No Gigin account. Use email, phone or Instagram". Selecting it shows the tooltip.
2. **Offer gig**: a **solid orange row** (#FF6C4B, hover #F25A38, white text, 14px/600). Sub-line:
   - Gigin artist: "Pick one of your upcoming gigs".
   - Guest: "Send by email or WhatsApp".
   - It opens the **existing Offer a gig modal** (`ArtistCRM.jsx`, "Offer a gig" → "Send offer"), pre-selected with this act's CRM contact.

The menu closes on outside click and Esc, and supports arrow keys.

## Left column (main)
Cards: white, border #E5E7EB, radius 14, padding 18px 20px, gap 18px between cards. Card titles are 16px/600.
1. **Application post:** a 36px avatar, then "**{Act}** applied to Friday Night Live" (the gig name in #6B7280) and the time (12.5px #6B7280). The note follows at **17px/1.55** in curly quotes (or "No note with this application." in #6B7280). Then pills: the preference (**Prefers Set 2**, #FFEDE7 / #B5462C, or **No preference** grey; hidden on one-set nights) and **{n} members**.
2. **Photos and videos** ("1 video · 3 photos" on the right):
   - A 3-column grid, gap 6px.
   - A video tile spans all 3 columns at 16:7 with a 58px red play button (it plays the YouTube embed in place).
   - Photos are 1:1 tiles, radius 10. Clicking one opens a lightbox.
   - Sources:
     - Gigin artist: `videos` + profile photos.
     - Guest: `photo` + image `assets`.
3. **Music:** dark rows (#111317, radius 10). Each has a 40px brand tile with a play/pause button, the title, `Spotify · 4:12`, a progress bar and "Open in Spotify".
   - Gigin artist: `tracks` + the Spotify/SoundCloud links.
   - Guest: the music links via oEmbed.
   - Empty: "No music links added."
4. **About:** the bio at 15px/1.6.
   - Guest: "No bio yet. {First} applied as a guest, so this page shows what they sent with the application." (#6B7280).
   - Gigin artist with no bio: "No bio added."
5. Two cards side by side (`auto-fit minmax(260px,1fr)`):
   - **Who's in the band:** a 30px initials circle + name 14px/500 + instruments 12.5px #6B7280. Guests use `members[]`; artists use the profile/band members.
   - **Tech and the bar:** the `computeCompatibility` groups with dots: Provided by the bar (green) · Covered by the act (dark) · Needs a chat (amber). No money.
6. **At Jesus College Bar:** rows with a border-top, label left and a mono 12.5px value right: Played here **2 TIMES** · Last played **4 OCT 2025** · In My Contacts since **MAR 2025**. For a first-timer: "First time applying to the bar" · Added to My Contacts **TODAY**. Derived from the venue's past gigs and the CRM entry `createdAt`.

## Right column (340px, sticky). Keep as designed; this is the part you liked
1. **This gig:** "Friday Night Live" 15px/600 with the status chip (the same chips as the applicant card), and `FRI 13 NOV · TWO SETS` in mono.
   - **Waiting:** **Decline** (outlined, 42px) · **Accept** (orange, 42px, wider).
   - **Accept:** opens the set chooser inline. "They'd prefer Set 2. Pick any open set." / "No preference, so any open set works." Set buttons are 48px: their pick in orange outline, taken sets disabled with "Taken · {act}". Then **Cancel** · **Accept, choose set later**. On one-set nights Accept books them straight away.
   - Accept and Decline call the same handlers as the list (toast + Undo, the 5-minute delayed decline email).
   - **Already decided:** a line instead of buttons: "Accepted for Set 1. Change it from the Sets panel." / "Accepted, no set yet. Give them a set from the Sets panel." / "Declined. You can undo this from the applicant list." / "Withdrew on 12 Nov."
2. **Contact:** "{contact name} · applied as a guest" or "· on Gigin". Then 40px rows (label 84px #6B7280 + value 500), each a link:
   - **Email** → mailto
   - **Phone** → tel
   - **WhatsApp** → `wa.me` (only if opted in)
   - **Instagram** → the profile
   - **Gigin** "Open full Gigin profile" → `/artist/:id` in a new tab (artists only)
3. **Your notes on this act:** sub "Saved to My Contacts". Uses the CRM entry's existing `notes` field (`users/{ownerId}/artistCRM/{id}.notes`, as shown in `ContactDetailsModal`).
   - Empty: a dashed **+ Add a note** button.
   - Has notes: the text plus an **Edit** button.
   - Editing: textarea · **Cancel** · **Save note**.

## Data
- **Guest:** everything is already on the guest applicant entry (`photo`, `assets`, `links`, `members`, `needs`, `bringOwn`, `note`, `contacts`, `preferredSlotGigIds`), plus `crmEntryId` for notes.
- **Gigin artist:** the artist profile (`heroImage`/`heroMedia`, `heroBrightness`, `heroPosition`, profile picture, `bio`, `tracks`, `videos`, links, members) plus the application entry. Load the profile when the popup opens and cache it per session.
- If a guest has since linked an account (`linkedArtistId`), show the profile data and treat them as a Gigin artist.

## Files
- `applicant-profile.html`: frames 1a (Gigin artist) and 1b (guest), both clickable.
- `CURSOR_PROMPT.md`: the prompt to paste into Cursor.
