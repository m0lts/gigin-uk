# Handoff: Keep my profile + venue finder (artist side, after guest apply)

## Overview
After a guest artist sends an application (`design_handoff_guest_apply/`), we offer to keep what they typed (act name, photo, links, band, tech rider) as a Gigin profile, with a link they can send to any venue. Confirming also unlocks the venue finder. The offer is something they get, not a signup wall. The application is already sent either way. Yes is one tap, there's a clear "Not now", and no password.

The domain is **giginmusic.com** and emails come from **noreply@giginmusic.com**.

Build after `design_handoff_multiset_apply/` and `design_handoff_applicant_profile/`. The launch venue is Jesus College Bar (Jez). The finder launches in Cambridge only.

There are **no payments, fees, ticketing or chat** anywhere in this flow.

## About the design files
`keep-profile.html` is a **design reference built in HTML**: a self-contained, clickable prototype with mobile phone frames, desktop browser frames and every state. **Don't copy its markup.** Recreate it in React + plain CSS using the existing guest-apply components (`src/features/gig-discovery/guest/`), the `ga-*` classes and the `--gn-*` tokens. Sample content (the Fen Street Trio, the bio, Clare Cellars' gig, and all the venue specs in the finder) is illustrative. **The venue specs are not verified.** Get real values from each venue before launch.

## Fidelity
**High-fidelity.** Colours, type, spacing, radii and states are final.

## Design tokens
These are the same as guest apply: `--gn-font` Geist, `--gn-font-mono` Geist Mono, `--gn-ink` #0F1115, `--gn-ink-2` #4B5160, `--gn-muted` #6B7280, `--gn-line` #E5E7EB, `--gn-line-soft` #F0F1F3, `--gn-console-bg` #F6F7F9, `--gn-orange` #FF6C4B, `--gn-new-bg` #FFEDE7, `--gn-new-text` #B5462C, `--gn-danger` oklch(0.52 0.16 25), and the green and amber status colours.
- **Orange is only used for "Send application" and the email buttons** (same rule as guest apply). Every other primary is #111317.
- Toggle switch: a 46×28 track inside a 44px hit area. On is #111317, off is #D9DCE1, and unavailable is #EEF0F2 (disabled).
- Tap targets are 44px or larger, primary buttons are 54px, inputs are 52px with 16px text, and the focus ring is 2px #FF6C4B.

## Layout
Mobile first. These are the same rules as guest apply: a 56px header, 18px side padding and content at max-width 640px. On desktop (768px and up) the content column is 640px centred. The public profile is 1040px with two columns (main `flex: 1 1 440px`, aside max 340px). The finder is a 480px list plus the map. Sheets are bottom sheets on mobile (radius 18 18 0 0) and centred 480px dialogs on desktop.

---

## Screens

### 1. Applied screen + offer card (`GuestApplied.jsx`)
Keep the existing check, the "Application sent to {booker}" heading, the line and "What happens next". **Replace** the `ga-account` prompt ("Save your details for next time?") with the offer card. "Back to the gig" stays last.

Offer card (white, 1px #E5E7EB, radius 16, padding 18, soft shadow):
- Mono label `FOR NEXT TIME · FREE` (#B5462C).
- Title **"Keep this as your Gigin profile"** (20/600).
- Body: "Your bio, photos, links, band info and tech rider in one place, with a link you can send to any venue when you're looking for gigs."
- **Mini preview** (#F6F7F9, radius 12) built from the draft. It has a 60px photo (or initials on #2A2E36), the act name, a sub-line and `giginmusic.com/artist/{slug}` in mono. Below are link chips (a brand dot plus the name) and a dark "Tech rider" chip if any needs or bring-own items exist.
  - **Sparse:** the sub-line is "Just your act name so far", with dashed chips "+ Photo", "+ Music link", "+ Band" and the line "Add these any time after you confirm. Venues usually look for a photo and something to listen to."
  - **No photo:** initials, a dashed "+ Add a photo" chip and "You can add a photo after you confirm. Without one, your page uses your initials."
- Finder line with a pin icon in a #FFEDE7 tile: **"And unlock the venue finder"**, then "Find venues near you, see what each one wants (PA, door deal, capacity, how they book), and send them your profile link." (Hide this when `VITE_FEATURE_VENUE_FINDER` is off.)
- **No email on the application** (phone or Instagram only): add a "Your email" field with "You applied with your phone number. We need an email to send the confirm link."
- Primary **"Keep my profile"** (#111317, 54px). The line under it: **"We'll email you a link to confirm. No password."** Then a ghost **"Not now"** button.

States:
- **Keep tapped:** the request goes out immediately and the card becomes "Check your email": "We've sent a link to {email}. Tap it to put your profile live. Nothing is public until you do." It has an outlined "Choose what's public" button (with an "optional" tag) → screen 2, plus "Resend the link" and "Wrong email?" links. After screen 2 it shows "✓ Your choices are saved."
- **Not now:** collapses to a dashed line: "No problem. If you change your mind, there's a link in the emails we send about this application." with **Undo**. Store `keepProfileOffer: 'dismissed'` on the guest application (server), not only in localStorage, so the emails know.
- **Email already has an account** (`checkGuestEmailAccount` → `hasAccount`): the card shows `YOU'RE ALREADY ON GIGIN`, "{email} has a Gigin account" and "Log in and we'll add this application to your account, so everything is in one place. Your application to Jez is sent either way.", with **"Log in instead"** and Not now. **Change `GuestWhoStep`** so this no longer blocks applying ("This email already has a Gigin account. Log in to apply."). Let them send as a guest, and make the offer here.

### 2. What we'll keep (optional, `/profile/keep?t=<token>` or a step inside the applied view)
- The title "What we'll keep", "Choose what goes on your public profile. You can change this any time.", and **Skip** at the top right.
- **ON YOUR PUBLIC PROFILE**: rows with switches. Each shows the label and a detail line:
  - Press photo (the filename), Bio, Music and video links (the names), Band members (the names), Tech rider (a one-line summary).
  - All are on by default if filled in. If something isn't filled in, its switch is disabled and the row says "Not added yet".
  - **Bio**: the guest form doesn't collect one, so this row has an optional textarea ("One or two lines about your act"). The detail line reads "You didn't add one when you applied. Optional."
- **PRIVATE**: Email and Phone, each with a lock and "Private". Under them: "Never shown on your profile. Venues reach you through a contact form, and you reply from your own email."
- **NOT CARRIED OVER**: "Your note to Jez, your set preference and any extra files you sent. They stay with this application and only Jez sees them."
- Primary **"Save my choices"**, ghost **"Skip, use the defaults"**, then "Nothing is public until you tap the link in your email."
- Saves to the pending profile and returns to the applied view.

### 3a. Confirm email
- **Subject:** "Confirm your Gigin profile for {actName}". **From:** Gigin <noreply@giginmusic.com>. Use the same template as the guest application emails.
- The body:
  > Hi {firstName},
  > You asked to keep the details from your application to {venueName} as a Gigin profile. Tap the button to put it live. Nothing is public until you do.
- A bordered box: `PUBLIC ON YOUR PROFILE`, then **{actName}** · {list of enabled sections}. Then `PRIVATE`, "Your email and phone number. Venues contact you through Gigin."
- Button (orange): **"Confirm my profile"** → `/profile/confirm/:token`.
- "Want to change what's public first? **Choose what's public**" → screen 2 with the same token.
- Small print: "This link works once and expires in 7 days. If you didn't ask for this, ignore this email and nothing will be published."
- Footer: "Gigin · You're getting this because you applied to a gig on giginmusic.com and asked to keep your details as a profile."

### 3b. Your profile is live
- A green check, **"Your profile is live"**, and "Anyone with the link can see it. Your email and phone number stay private."
- `YOUR LINK`: a mono URL field and **Copy** (→ "Copied ✓" for 1.6s), plus **"Share to WhatsApp, Instagram…"**, which calls `navigator.share` on mobile. The fallback sheet offers WhatsApp (`wa.me/?text=`), Instagram (copies the link: "For Instagram we copy the link so you can paste it into your bio or a DM."), Messages and Copy link.
- Preview card of the public page → opens it.
- A dark **NEXT STEP** card: "Find venues to send it to", "See what each Cambridge venue has and wants, and send them your link.", and a white button **"Find venues"** → `/find-venues`.
- "Edit, hide or delete your profile any time from the link in your email. **Edit profile**"
- Confirming also sets a long-lived device session (an httpOnly cookie) so the returning-artist pre-fill works on this phone.

### 3c. Link preview (og tags, server-rendered for `/artist/:slug`)
- `og:title`: "{actName} · Gigin"
- `og:description`: "{first sentence of bio, max 120 chars}. Music, band and tech rider in one place." Sparse: "Artist profile on Gigin."
- `og:image`: the press photo cropped to 1200×630. With no photo: a generated card (#111317 background, initials and the gigin. wordmark).
- `twitter:card = summary_large_image`.

### 4. Public profile (`/artist/:slug`, the existing `ArtistProfileViewer` route; add slug resolution)
The order:
1. Hero: the press photo (280px mobile full-bleed, 340px desktop, radius 16) or a dark block with an 84px initials circle.
2. The act name (32px / 40px desktop), the sub-line from the band ("Trio · vocals, guitar, double bass, drums"), and link chips (40px pills).
3. Mobile: **"Contact the act"** (dark, flex 1) + **Share**. Desktop: the same in a card at the top of the aside, plus "Copy profile link" and "Messages go to the artist by email. Their contact details stay private."
4. `ABOUT`: the bio. `MUSIC AND VIDEO`: a Spotify card and a YouTube embed that **only loads its iframe on tap** (to keep the page fast). `BAND`: the members.
5. Aside: `TECH RIDER` with "Needs from the venue" chips (grey) and "Brings their own" chips (dark), then `PLAYED AT`, which lists each venue that confirmed them: "{venue}, {city} · {date} · confirmed by the venue".
6. Footer: "Artist profile on gigin." and "Report this profile".

**Hide sections that aren't filled in or are switched off. Never show empty states to viewers.** A sparse profile shows "{actName} is new on Gigin. Get in touch to hear more."

**Contact form** (sheet or dialog): Your name, Your email, Venue or event (optional), Message. Copy: "We'll send this to the artist by email with your email address, so they can reply to you. Their contact details stay private." After sending: "Sent. {actName} will reply to your email." Rate-limit by IP and add a captcha fallback.

**Hidden profile:** the page shows "This profile isn't available" with a 404-equivalent status, and og tags are not rendered.

**Performance:** server-render or pre-render the shell and og tags. Lazy-load embeds. Serve photos at responsive sizes, and use WebP. The target is an LCP under 2.5s on 4G.

### 5. Venue finder (`/find-venues`, the existing `VenueFinder` route behind its own flag)
- Title **"Find places to play"**, plus an area selector (Cambridge at launch).
- Explainer, always visible: "Venues that put on live music, what each one has and wants, and a quick way to send them your profile. Venues decide who they book, so this is a way to find places to play, not a promise of gigs."
- A segmented control: **All N · On Gigin N · Listed N**. Filter chips: **Has a PA**, **Takes originals**, then **Capacity** (Any / Up to 80 / 80 to 150 / 150+) and **Genre** dropdowns. Active filters are #111317 filled.
- A count line: "{n} venues in Cambridge so far. We're adding more."
- **Venue card**: the name, the area and distance, and a badge (**On Gigin** #FFEDE7/#B5462C, or **Listed by Gigin** #F3F4F6/#4B5160). A 2×2 spec grid with mono labels: SOUND (✓ green / ✕ red + text), CAPACITY, DEAL (door deal / fee model), HOW THEY BOOK. A genre line + "originals welcome". If they applied there: a green "You applied for {date}". After a request: a grey "Profile sent. The venue will be in touch if a night fits." A **Send my profile** button and the source line ("Details from the venue" / "From public info · checked {month year}").
- Legend card: On Gigin vs Listed explained, plus "Know a venue we've missed? **Tell us about it**" (a sheet with one input).
- Map: reuse `useMapbox`. Pins are orange for On Gigin and #111317 for Listed. Hovering a card (desktop) or tapping a pin enlarges the pin. On mobile it's a 170px strip above the list. On desktop the list is 480px and the map takes the rest.
- **No results:** "No venues match these filters", "There are only a handful of venues in Cambridge so far, so a broad search works best.", and **Clear filters**.
- **Empty area:** "No venues here yet." "Tell us where you'd like to play. We're starting in Cambridge and adding places where artists ask for them." A town input + **Tell us** → "Thanks. We'll email you when there are venues near {town}." Then "See Cambridge venues (16 miles away)".

**Send my profile** (sheet):
- **On Gigin venue:** "{venue} books through Gigin." The primary is **"Request to be considered"**, with the line "Sends your profile to {venue}. They see your public profile, not your email or phone." Then a **Copy my profile link** row. Done state: "Sent to {venue}. They now have your profile. If a night fits, they can offer it to you, and you'll hear by email. Sending your profile doesn't book a gig." The venue receives it as a new CRM contact (`source: 'profile_request'`) in My Contacts, where they can "Offer Gig" with the existing flow.
- **Listed venue:** "{venue} isn't on Gigin. They book by email, and their address is on their website." (For promoter-run venues: "They book through promoters, so send your link to the promoters who run nights there.") Then the rows **Write a message** → an editable pre-written message, **Copy my profile link**, and **Open their website ↗**.
- Pre-written message:
  > Hi,
  > I'm {contactFirstName} from {actName}, {bio first clause, if any}. We'd love to play at {venue}.
  > Our music, band and tech needs are all here:
  > giginmusic.com/artist/{slug}
  > Thanks,
  > {contactFirstName}

  The buttons are **Open in email** (a `mailto:` with the subject "{actName}: gigs at {venue}") and **Copy** (→ Copied ✓). The note under it: "This opens in your own email app, so the venue replies to you directly. Edit anything you like first." We never send email to listed venues on the artist's behalf.

### 6a. Returning artist: pre-filled application
When the device has a profile session (from confirming), the guest wizard opens on a single review page instead of step 1:
- A greeting: "**Welcome back, {first}.** We've filled this in from your Gigin profile. **Not you? Start blank**" (clears the session for this flow).
- Rows: Act and contact · Photo and links · Band · Tech rider. Each row has **Change**, which opens an inline editor plus the checkbox **"Also update my profile"** (default off), with "Unticked, the change only goes to {venue} with this application." Changed rows get a tag: "This application only" (grey) or "Also updating your profile" (dark).
- **The tech rider is re-checked** against the new venue with `computeCompatibility`. Show the amber line for anything that needs a chat ("Checked against Clare Cellars: they have 1 vocal mic, so the second needs a chat.").
- "Note to {venue} (optional)" starts empty, with "Notes aren't copied from earlier applications."
- **Send application** (orange). The applied screen then shows "Your profile is up to date" (or "Your changes were saved to your profile too.") with **Open** instead of the offer card.
- **With no session but a matching email:** after the email field loses focus, show "You have a Gigin profile. We'll email you a link to fill this in from it." Never pre-fill from an email address alone.
- The guest application stores `artistProfileId`. **The profile is updated, never duplicated.**

### 6b. Manage page (`ManageGuestApplication.jsx`)
- Add a profile card under the status pill: "Your Gigin profile", the mono URL, **Open** and **Edit**.
- If they chose Not now: a #F6F7F9 block at the end with "**Keep this as your Gigin profile?** Your details in one place, with a link you can send to other venues. No password." and a **Keep my profile** link (same request as the offer card).

### 6c. Light profile editor (`/profile/edit/:token`, from the email, no password)
- "Edit your profile", the URL and **View**. The sections: PHOTO (an 88px thumbnail, Replace / Remove), BIO, LINKS (Spotify / YouTube / Instagram / Website rows like guest apply), BAND (rows with ✕, "+ Add a member"), TECH RIDER (a summary + Edit, which reuses `GuestTechStep` without venue columns), WHAT'S PUBLIC (the same switches, plus a fixed row "Email and phone · Always private"), and WHO CAN SEE YOUR PROFILE (Public / Hidden segmented, with explainer lines).
  - Public: "Anyone with your link can see your profile."
  - Hidden: "Your link shows "This profile isn't available". Venues you've applied to still see your applications."
- **Save changes** → "Saved. Your profile is up to date."
- **Delete my profile** (red link) opens the sheet "Delete your profile?": "Your page and link stop working straight away, and we delete your profile details. Applications you've already sent stay with those venues. If you only want a break, hide your profile instead." The buttons are **Delete my profile** (danger) and **Hide it instead**. After deleting: "Your profile is deleted", "Your page and link have stopped working. Applications you've already sent stay with those venues until the gig date."
- Edit tokens: single-use. Each one starts a 30-day editor session (cookie). The editor offers "Email me an edit link" any time.

### Emails with the quiet reminder (only when the offer was dismissed or ignored)
Add a #F6F7F9 block under the main button of the existing guest **accepted** ("You're booked to play {gig}") and **declined** ("Update on your application for {gig}") emails in `gigs.js` (`emailGuest`):
> **Keep your details for next time?** Turn this application into a Gigin profile with a link you can send to other venues. No password.
> Keep my profile → (a signed link that sends the confirm email)

Only include it if there's no linked profile and `keepProfileOffer !== 'confirmed'`. Send it at most twice per artist email address, ever.

### Link states
- **Expired** (7 days): "This link has expired", "Confirm links last 7 days. Your application to Jez is still sent, and nothing has been made public.", and **Email me a new link** → "Sent. Check s•••@domain."
- **Already used:** "This link has already been used", "Your profile is already live. For your security each link works once, so we can email you a fresh one to make changes.", with **Open my profile** and **Email me an edit link**.
- **Log in instead** (from the account-exists card): "Log in to Gigin", "We'll add your application to {venue} to your account once you're in.", the email shown read-only, **Email me a login link** and **Use my password** (the existing auth modal). Then "Application added to your account", "…Anything new you sent (photo, links, tech rider) is waiting for you to add to your profile, if you want it there.", and **Review what to add** (opens the editor with those items unticked).

---

## Data

### `artistProfiles` (existing collection; reuse its fields)
| Field | Source | Default |
|---|---|---|
| `name` | `actName` | public, always |
| `heroMedia` | the guest `photo.path`, copied to profile storage | public (toggle `publicFields.photo`) |
| `bio` | the keep screen (optional) | public if filled (`publicFields.bio`) |
| `spotifyUrl`, `youtubeUrl`, `instagramUrl`, `websiteUrl` | guest `links.*` | public (`publicFields.links`) |
| `members[]` `{ name, instruments[] }` | guest `members` (empty rows dropped) | public (`publicFields.members`) |
| `techRider` | `buildGuestTechRider({ needs, bringOwn, members })` | public (`publicFields.tech`) |
| `playedAt[]` `{ venueId, venueName, city, gigId, date, confirmedAt }` | written on venue accept | public |
| `contactEmail`, `contactPhone`, `whatsapp` | guest contacts | **private, never in public reads** (store in `artistProfiles/{id}/private/contact`) |

New fields on `artistProfiles`:
```
slug, source: 'guest_keep', status: 'pending'|'live'|'hidden'|'deleted',
publicFields: { photo, bio, links, members, tech },   // booleans
guestApplicationIds: [], userId: null,                 // no account needed
createdAt, confirmedAt
```
- `status: 'pending'` profiles are **never readable** publicly (Firestore rules + API). They only go `live` via the confirm token.
- `slug`: from `actName` (kebab-case), unique. Add `-2` etc. if it's taken.
- Not carried over: `note`, `preferredSlotGigIds`, `assets[]`.

### Guest application (`gigs/{gigId}/guestApplicants/{id}`)
Add `artistProfileId?`, `keepProfileOffer: 'none'|'sent'|'dismissed'|'confirmed'` and `reminderCount`.

### Tokens (new `profileTokens`, hash only)
`{ hash, profileId, kind: 'confirm'|'edit'|'prefill', expiresAt, usedAt }`. Confirm: 7 days, single use. Edit: single use, starting a 30-day session. 32+ random bytes, same as the manage tokens.

### Venues for the finder
Add `finderListing` to `venues` (for On Gigin venues), plus a new `listedVenues` collection for venues not on Gigin:
```
{ name, area, location: {lat,lng}, city, hasPA: bool, soundSummary, capacity,
  dealModel: 'door'|'fee'|'split'|'agreed'|'room_hire', dealLabel,
  howTheyBook, takesOriginals: bool, genres: [], websiteUrl,
  source: 'venue'|'public_info', checkedAt }
```
On Gigin venues get the PA and capacity from `techRider` / `venue.capacity` where these exist.

## Server
- `POST /guest-applications/:token/keep-profile` `{ email? }` → creates the pending profile from the application and emails the confirm link. Idempotent per application.
- `PATCH /profiles/pending/:token` (keep screen choices + bio).
- `POST /profiles/confirm/:token` → sets the profile live, links the guest application, sets the device session, returns the slug. Errors: `expired`, `used`.
- `POST /profiles/edit-link` `{ email }` (always returns 200, so there's no account enumeration).
- `GET/PATCH /profiles/me` (editor session), `POST /profiles/me/hide`, `DELETE /profiles/me`.
- `POST /profiles/:slug/contact` (contact form → emails the artist with reply-to set to the sender; rate-limited).
- `POST /venues/:venueId/profile-requests` (Request to be considered → a CRM entry + a venue email). Rate-limit to 1 per venue per profile per 30 days.
- `POST /finder/area-requests` `{ town, email }`.
- On a guest accept (`gigs.js` accept handlers): if `artistProfileId` is set, append to `playedAt`.

## Privacy and trust (must ship with v1)
- Phone and email are never public. They're only returned to a venue the artist applied to or that booked them (section 9).
- Venue contacts are shown only per the venue's setting (section 10). Placeholders are never the real values.
- Press kit files are private and served only to booked venues (section 8).
- Nothing becomes public until the confirm link is tapped.
- Hide and delete are reachable from every email and from the editor.
- The plain wording on the card, the keep screen and the email is final. Don't shorten it.
- Add a short section to `PrivacyPolicy.jsx`: guest profiles, what's public, and how to hide or delete.

---

# Addendum: press kit, contact visibility, venue page, artist home

Prototype frames are 8a to 12d (artist side, mobile + desktop) and 8j, 8k, 10h (venue console, with the real sidebar).

## 8. Press kit (flag `pressKit`)

### Artist side: Press kit screen (`/profile/press-kit`, from the editor row, the artist home and the editor email link)
- Title "Press kit", with the line "Files a venue can use to promote your gig. They're stored privately and aren't on your public profile. Only venues with a confirmed gig with you can download the ones you switch on."
- Four sections, each with mono labels:
  - **BIO**: one press bio, plain text, with Edit.
  - **LOGO**: one file, PNG or SVG.
  - **HIGH-RESOLUTION PRESS PHOTOS**: up to 8 files, JPG or PNG, up to 25 MB each, stored at full size with no compression.
  - **VIDEOS**: up to 4 files, MP4 or MOV, up to 500 MB each.
- Each asset is a card: a 52px thumbnail (an image, or the file type in mono), the name, the detail and size, **Replace** (Edit for the bio) and ✕. A footer row has a switch: **"Venues who book me can download this"** (default on for new uploads). Uploading shows "Uploading… N%" with a 6px bar.
- Below each section: a dashed "+ Add a photo" / "+ Add a video" / "+ Add a logo" / "+ Add a press bio" button plus the limits line. Hide the button when the section is full.
- **Rights confirmation**: a checkbox card, "I have the right to share these so a venue can promote my gig." If Save is pressed with any file switched on and the box unticked, the card gets a #E5484D border and the line "Tick the box above to share your press kit." Store `pressKitRightsConfirmedAt`.
- **Save press kit**, then "Saved. Venues who've booked you can download N files." The footnote: "Nothing here is public. Venues see a "Download press kit" button on your profile, and it only works for venues who've booked you."
- Editor row (6c): `PRESS KIT`, then "{shared} of {total} files shared with venues who book you" (or "Not set up yet"), "Private. Only venues who've booked you can download what you switch on.", and **Manage** / **Set up**.

### Venue side: Download press kit on the public profile
**Always visible** while `pressKit` is on: a 48px outlined button with a download icon. It sits under the contact area (mobile) or in the aside card (desktop).
- **Active** (a signed-in venue owner or staff member, with a confirmed gig with this artist): a #111317 border on white. Tapping it opens a sheet or dialog titled "Press kit · {act}", with "What {act} shares with venues who've booked them, to promote the gig." It lists the switched-on files (type, name, detail incl. photo credit, size). Then:
  - **Download zip · {total}** → "Preparing {slug}-press-kit.zip N%" with a progress bar and Cancel → "Downloaded {slug}-press-kit.zip ({total})" + Download again.
  - Footnote: "For promoting your gig with the act. Credit photos as shown."
- **Disabled** (everyone else): #F3F4F6 background, #8A909C text, `aria-disabled="true"` (not the `disabled` attribute, so it can still take focus and taps). Desktop shows a tooltip above on hover and focus. Phones have no hover, so a tap opens the same dark box inline under the button: **"You can download this artist's bio and media once you've booked them."**
- **Access ended** (booking cancelled): disabled, with "Press kit access ended when the booking for {date} was cancelled."
- **Error**: a #FFF7F4 / #FFD2C6 box: "**The download didn't finish.** The connection dropped while we were building the zip. The files are fine, so try again." and **Try again**.
- **None yet** (booked, but no files switched on): disabled. Under it: "This artist hasn't added a press kit yet." and **Ask them for one** → "Asked ✓" (emails the artist, max one per venue per artist per 30 days).
- Assumption (confirm): access continues after the gig date and stops if the booking is cancelled.

### Venue side: the confirmed gig page
In the running order, each confirmed act gets a #F6F7F9 block under its row (indented to the name). It shows "Press kit" with a summary line ("Bio, logo, 1 press photo, 1 video · 54.5 MB"), a **Download press kit** button (dark, 40px), a compact file grid (type chip, name, size), and the same downloading, done, error, none-yet ("{act} hasn't added a press kit yet." + **Ask for one**) and access-ended states. Footnote under the running order: "Press kits sit under each confirmed act. Files are for promoting this gig. Access stays after the gig and stops if the booking is cancelled."

### Data and server
- Storage: `artist-press-kits/{profileId}/{assetId}` (private). Doc: `artistProfiles/{id}/pressKit/{assetId}` `{ kind: 'bio'|'logo'|'photo'|'video', name, size, contentType, width?, height?, durationSec?, credit?, bioText?, shareWithBookedVenues: bool, uploadedAt }`. Profile: `pressKitRightsConfirmedAt`.
- `GET /artists/:profileId/press-kit` (venue auth) → the file list if the venue has a booking with `status: 'confirmed'` (any date, not cancelled) for this artist; otherwise 403 with `reason: 'not_booked'|'cancelled'|'empty'`. The UI uses this to pick the state.
- `POST /artists/:profileId/press-kit/zip` → streams a zip of the switched-on files, or returns a signed URL (15 minutes). Log each download as `{ venueId, userId, at }`.
- `POST /artists/:profileId/press-kit/request` (Ask for one).

## 9. Who sees an artist's contact details (always on, no flag)
| Viewer | Profile | Contact form | Email | Phone | Press kit |
|---|---|---|---|---|---|
| Anyone with the link | Yes | Yes | No | No | Greyed |
| Signed-in artist | Yes | Yes | No | No | Greyed |
| Venue, no relationship | Yes | Yes | No | No | Greyed |
| Venue the artist applied to | Yes | Replaced by details | Yes | Yes | Greyed |
| Venue that booked them | Yes | Replaced by details | Yes | Yes | Download (switched-on files) |
| Venue, booking cancelled | Yes | Replaced by details | Yes | Yes | Greyed, access ended |
| The artist | Yes | n/a | Yes | Yes | Manage |

- "Applied to that venue" means any guest or Gigin application to any gig at that venue, including withdrawn ones. "Booked" means a confirmed booking.
- The contact area:
  - For a signed-in venue, it starts with a mono line, `SIGNED IN AS {VENUE}`.
  - **No relationship:** "Contact the act" (the form). The line under it: "Their email and phone show here if they apply to {venue} or you book them. Until then, messages go to them by email."
  - **Applied or booked:** a bordered list with Email and Phone (with "WhatsApp ok" if ticked), each with **Copy**, and the line "Shown because {act} applied to {venue}." / "Shown because you've booked {act} for {date}."
  - **Public viewers:** "Messages go to the artist by email. Their contact details stay private."
- `GET /artists/:profileId/contact` (venue auth) returns `{ email, phone, whatsapp, reason: 'applied'|'booked' }` or 403. Never include these in the profile payload.

## 10. Venue contact details as the sign-up carrot (flag `venueFinder`)
| Venue setting | Not signed in | Signed-in artist | Invited by this venue |
|---|---|---|---|
| Artists with a Gigin profile (default) | Placeholder + "Create your profile to see how to contact this venue" | Booker, email, phone | Booker, email, phone |
| Only artists I've invited | "{venue} only shares contact details with artists they've invited. Send your profile and they can offer you a gig." + Send my profile | Same | Booker, email, phone |
| Nobody | "{venue} takes bookings through Gigin only, so there's no email or phone here. Apply to one of their gigs or send your profile." + Send my profile | Same | Same |
| Listed venue (not claimed) | Placeholder + the same carrot | Email from their website ("From {venue}'s website. The venue hasn't checked it.") | n/a |

- **Placeholders are static grey bars** (14px tall, #E5E7EB, fixed widths 58% / 76% / 44%, `aria-hidden`), with the labels Booker / Email / Phone. **Never blur or mask real data.** The server doesn't send the values to a viewer who isn't allowed them.
- Signed in = a Gigin account or a confirmed guest profile session. Invited = the artist arrived through a `gigInvites` link from that venue (store `invitedByVenueIds` on the guest session or profile). It unlocks **that venue only**.
- Finder card: a contact strip above the actions. Open: #F6F7F9 with `CONTACT`, the booker line and email · phone. Locked: a dashed #D9DCE1 strip with a lock, two grey bars (for the carrot or invited-only cases) and the message. The carrot strip is a button that opens profile creation. A **View venue** button opens the venue page.
- **Create your profile** goes to the Keep my profile flow when there's a guest application on this device, and otherwise to the existing artist sign-up (prefill email if known). Afterwards it returns to the same venue.

### Venue Settings › Finder listing (venue console, desktop)
- A new tab or page under Venue Settings. Sidebar unchanged.
- The cards, in order:
  - "Show {venue} in the venue finder" switch.
  - **What you have and want**: Has a PA (Yes/No), Capacity, Sound summary (pre-filled from `techRider`), Deal (Agreed per gig / Fixed fee / Bands keep the door / Door split / Room hire), How you book (Applications on Gigin / By email / Seasonal sessions / Through promoters), Takes originals (Yes/No), Website, Genres (chips).
  - **Contact details**: Booker name, Role, Email, Phone (optional).
  - **Who can see my contact details**: three radio cards.
    - **Artists with a Gigin profile**: "Default. Artists who aren't signed in see "Create your profile to see how to contact this venue"."
    - **Only artists I've invited**: "Artists you have offered a gig to see your details. Everyone else is asked to send their profile instead."
    - **Nobody**: "No email or phone is shown. Artists apply to your gigs or send their profile through Gigin."
- **Save changes** → "Saved. The finder shows your changes now."
- The right column is a sticky 340px panel, `WHAT ARTISTS SEE`, with a segmented control (Not signed in / Signed in / Invited by you) and the live contact block for the chosen setting, plus a note under it per setting.
- Data: `venues.finderListing = { listed, hasPA, soundSummary, capacity, dealModel, howTheyBook, takesOriginals, genres[], websiteUrl }`, `venues.finderContact = { bookerName, role, email, phone }` (private subdoc), `venues.contactVisibility: 'signed_in'|'invited'|'nobody'` (default `'signed_in'`).

## 11. Venue page as an artist sees it (`/venues/:slug`, flag `venueFinder`)
- The hero photo (200px mobile full-bleed / 300px desktop, radius 16). The badge **On Gigin** / **Listed by Gigin**. Then the name (32 / 40px) and "{street}, Cambridge · {distance}".
- **Send my profile** (dark, 52px). It opens the same sheet as the finder.
- `WHAT THEY HAVE AND WANT`: a 2-column grid (SOUND with ✓/✕, CAPACITY, DEAL, HOW THEY BOOK, ORIGINALS, GENRES) and the source line ("Details from the venue · updated {month year}" / "Listed by Gigin from public info · checked {month year}").
- Listed only: a #F6F7F9 box, "**Is this your venue?** Claim it to correct these details, choose who sees your contact details, and take applications through Gigin." and **Claim this venue**, which opens a sheet: Your name, Your role at the venue, Work email, **Send claim** → "Thanks. We'll check and get back to you within 2 working days. Until then the listing stays as it is." It's stored in `venueClaims` and checked by hand. Approving it creates the venue account and moves the listing data across.
- Footnote: "Venues decide who they book. Sending your profile doesn't book a gig."
- Aside: the `CONTACT` card (rows, placeholders or message + CTA, as in the table above), then a Website card with Open ↗.

## 12. Artist home (`/home`, flag `keepProfile`)
For every logged-in artist, including existing accounts from the old app (`artistProfiles` with a `userId`), and confirmed guest profiles. **Nothing else on the page.** No discovery, messages, finances or stats.
- "Hi {first name}", then the act name. Existing accounts from the old app see a one-off #F6F7F9 line: "**Welcome to the new Gigin.** Your profile, applications and gigs from the old app are all here." (dismiss after first view).
- `MY CONFIRMED GIGS`: cards with the mono date, the gig name, the venue and city, a green "Confirmed · {set}" pill and **Details**. Empty: "No confirmed gigs yet. When a venue confirms you, the gig shows here."
- `MY APPLICATIONS`: rows (64px) with the gig, venue and date, and a status pill: Sent · waiting (amber) / Not this time (grey) / Withdrawn (grey). They open the manage page.
- `MY PROFILE` (aside on desktop): the thumbnail, the act name and mono URL; **View** · **Edit** · **Copy**; and a Press kit row ("{n} of {m} files shared with venues who book you" / "Not set up yet", with **Manage** / **Set up**). Hide the press kit row when `pressKit` is off.
- Header right: "{name} · Sign out".

## Feature flags (add to `src/config/features.js`, default off)
```js
keepProfile: readFlag(import.meta.env.VITE_FEATURE_KEEP_PROFILE),
publicProfile: readFlag(import.meta.env.VITE_FEATURE_PUBLIC_PROFILE),
venueFinder: readFlag(import.meta.env.VITE_FEATURE_VENUE_FINDER),
pressKit: readFlag(import.meta.env.VITE_FEATURE_PRESS_KIT),
```
- `keepProfile` off → today's `GuestApplied` prompt stays as it is.
- `publicProfile` off → the profile is still saved and used for pre-fill. The live screen says "Your profile is saved" and hides the link, share and preview. The `/artist/:slug` guest-profile view and og tags are off.
- `venueFinder` off → hide the finder line in the offer card and the Next step card. `/find-venues` keeps today's `FEATURES.discovery` gate. With `venueFinder` on, allow it for signed-in or profile-session artists even when `discovery` is off.

- `venueFinder` also gates venue contact visibility (section 10), the venue page (11), Claim this venue and Venue Settings › Finder listing.
- `keepProfile` also gates the artist home (12).
- `pressKit` off → hide the Press kit screen, the editor and home rows, the Download press kit button and the gig-page block. Don't show a disabled button.
- **Not flagged:** the artist contact rules in section 9. They apply as soon as profiles can be viewed by venues.

## Files
- `keep-profile.html`: the clickable prototype (every screen and state, mobile + desktop, notes, the field table).
- `CURSOR_PROMPT.md`: the prompt to paste into Cursor.
