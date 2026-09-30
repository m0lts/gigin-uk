# Gigin Venue Map

*Built July 2026 from Steve Meeting 2 notes, Elvis/Geldart interview, Venue Readiness doc, and "What is incompatible, by venue." Purpose: understand what each venue actually wants, identify the common thread, rate closability, and derive the build priority.*

---

## Venue-by-Venue Picture

### The Geldart (Elvis) — Closability: 9/10 for calendar embed; 2/10 for booking workflow

**What he wants:**
- A public-facing gig calendar so audiences can discover what's on nearby — push notifications, visibility. This is his primary pain, not booking.
- A venue profile that communicates his model upfront (no PA, bands bring everything, own door, own promotion, keep ticket revenue) so unsuitable acts self-filter before emailing him.
- He said explicitly: "If people start using this tool, I will do my bit. I will upload all the gigs I've got." No threshold on how many venues or artists need to be on it first — just wants the public using it.

**His issues:**
- Almost no booking friction — bands come to him, he's reactive. 17 years in, he has more enquiries than slots. Booking admin is not his pain.
- His pain is **audience**, not admin: "My bigger pain point is not booking the bands, it's getting people to come watch them."
- Needs bands to handle their own tickets and promotion — his model is already well-functioning; Gigin needs to fit around it, not replace it.

**What "yes" looks like:** Elvis embeds a Gigin gig calendar on the Geldart website and adds his upcoming gig listings. The public can see and be notified. That's it — no booking workflow adoption required at first.

**Priority feature for this conversation:** Website gig calendar embed. Show him a working embed of his existing gigs. That's the only pitch needed.

---

### Hot Numbers (Steve + Kevin, Simon the owner) — Closability: 7/10

**What he wants (from Steve Meeting 2):**
- **Time-limited invites** — his most explicit ask. Artists go dark after being sent a date; a time-limited offer with auto-expiry fixes this.
- **Venue profile with specs upfront** — fees, capacity, no sound engineer clearly listed so artists self-filter before enquiring. "So we don't have to engage with people and then tell them all this and them go 'ah nah that won't work.'" (Like Airbnb listing a property.)
- **Shareable artist media package** — bio, clips, reviews all on the artist's Gigin profile; Steve's socials person (Ben) can log in and grab it without chasing the artist. Steve sees this as something Gigin should actively help younger musicians build.
- **Artist CRM** — add artists (on or off Gigin), keep notes, invite directly. A gig notes table recording how each gig went.
- **Multi-staff login** — Simon, Luisa, Barry, managers can see lineup, listen to acts, so staff can tell customers what to expect. "Gig handbook" view.
- **Shared booking with Kevin** — Kevin books jazz, Steve books the rest; they need a shared list and shared visibility without duplicating work.
- **Musician availability/touring windows** — "What if musicians had their availability as dates? If someone's in the SE of England Jan–March with open dates, venues filling their calendar can find them."
- **Discovery Sessions continuity** — happy to keep this going, especially with criteria on the listing (younger musicians).

**His issues:**
- "Old boys" friction — making accounts, learning new tools; Kevin in particular operates entirely on word of mouth and offline.
- Low gig volume — "not really a music venue, a venue that does music." Only 3 Discovery Sessions per year plus Kevin's jazz bookings. Low volume = low urgency to systematise.
- Artists needing to sign up to confirm gigs is friction — needs a lighter touch (accept without full account, prompted to set up profile afterward).

**What "yes" looks like:** Steve and Kevin both have their own logins. The next Discovery Sessions season is in the system without Toby acting as proxy. Kevin's jazz bookings are at least partially visible on the shared platform.

**Priority feature:** Time-limited invites + venue profile with specs. Show him these exist (or near-exist) and you'll unlock the strongest early adopter in the ecosystem.

---

### The Tram Depot — Closability: 4/10

**What they want:**
- Staff oversight: manager (Alec) and others seeing what's booked, gig details visible centrally without conversations being scattered.

**Issues:**
- Staff instability — Julia and Becky left (both were Tram people), Alec took over with no Gigin access. Adoption collapsed with turnover. Adoption is fragile when it lives in one person.
- Need to re-establish contact with Alec and rebuild from scratch.

**What "yes" looks like:** Alec has his own login and enters at least one upcoming gig series.

---

### JBar — Jesus College Bar (The Brewery Room) — Closability: 4/10

*Separate from The Tram Depot. JCMS, Ents, and Dani are all JBar/Brewery Room organisers, not Tram.*

**What they want:**
- Central coordination between multiple organisers (JCMS, Ents, Dani-organised gigs) with visibility/privacy controls — different parties booking into the same venue without stepping on each other or seeing each other's private arrangements.
- "Town hall" structure: venue as the root with different organiser types having scoped access.

**Issues:**
- Multi-organiser workflow not yet built — the workaround (adding promoters as staff) is not intuitive and doesn't give right privacy controls.
- College bars: gigs often don't involve payment, which is a mismatch with current Gigin payment-centric flow.

**What "yes" looks like:** One organiser (JCMS or Dani) runs a single gig series through Gigin with a second organiser able to view but not edit it.

---

### Blue Moon (Sophie) — Closability: 5/10 once contracts exist

**Issues flagged:** Needs a formal booking contract before she'll engage — no contract/agreement workflow in Gigin currently. Once that's built, Sophie is a warm contact (Elvis knows her, same neighbourhood).

**What "yes" looks like:** First booking with a signed contract through Gigin.

---

### Portland Arms — Closability: 3/10

**Issues:** Room hire model — promoters hire the room, which is a different structure than direct venue booking. Needs promoter workflow built before this is viable.

---

### Hidden Rooms (Marcus) — Closability: 2/10

**Issues:** Fundamental model incompatibility — artists pay the venue (room hire). Gigin's current model assumes venues pay artists. Not a product gap — a model mismatch.

---

### La Raza — Closability: ~8/10

Already identified as compatible. Prioritise alongside Geldart. Need to document what they actually want in a direct conversation — less data here than other venues.

---

### JazzSoc — Closability: 5/10

**Issues:** Getting artists to sign up to confirm gigs is the blocker. If artists can accept a gig invitation without creating a full account first (prompted to build profile afterward), this becomes viable. A student society — motivated, tech-comfortable, low bureaucracy.

---

### College Bars / Six Six / Arts Club — Closability: 2/10

Low compatibility — either gigs don't involve payment (college bars), model is too different, or insufficient data to engage meaningfully yet.

---

## Common Threads

Three features appear across the two highest-closability venues (Geldart, Hot Numbers) and almost every other conversation:

**1. Venue profile as upfront self-filter**
Both Steve (fees, capacity, no sound engineer) and Elvis (no PA, own door, own promotion) need their venue specs visible so unsuitable acts don't waste their time. One venue profile builder solves both.

**2. Public gig calendar / listings visibility**
Elvis's primary pain. Also the "free visibility" hook to get any venue to list gigs — once listed, their gigs are promoted publicly with no extra effort. This is the entry-point feature that creates value before any booking workflow is adopted.

**3. Post-sourcing booking formalisation**
"DM is sourcing, Gigin is booking." The mess that lives after the Instagram handshake — fees forgotten, tech riders lost, confirmations unanswered. Time-limited invites, confirmations, media package, multi-staff visibility. Steve's core pain. Retention feature once venues are in.

Supporting threads: artist media package, CRM/artist book, musician availability calendar.

---

## Closability Ranking

| Venue | Rating | Bottleneck |
|---|---|---|
| Geldart (Elvis) | 9/10 | Build the calendar embed |
| La Raza | ~8/10 | Have the conversation |
| Hot Numbers (Simon/Steve) | 7/10 | Time-limited invites + venue profile |
| JazzSoc | 5/10 | Artist onboarding friction |
| Blue Moon | 5/10 | Contract/invoice workflow |
| Tram Depot | 4/10 | Staff stability + multi-organiser workflow |
| Portland Arms | 3/10 | Promoter workflow |
| Hidden Rooms | 2/10 | Model mismatch |

---

## Build Priority (derived from closability)

**Build 1 — Public gig calendar + website embed** *(unlocks Geldart immediately)*
Venue enters their upcoming gigs. A public-facing listings page + embeddable widget goes on their website. No booking workflow required. Audiences can discover and get notified. This is the no-friction entry point for the whole ecosystem.

**Build 2 — Venue profile builder with specs upfront** *(unlocks Hot Numbers, helps every venue)*
Guided setup: capacity, fees, tech setup, model (flat fee / ticket split / no pay default). Shown on venue page so bands self-filter. Like Airbnb's property setup — bio + structured fields. Serves Steve and Elvis equally.

**Build 3 — Time-limited invites + lightweight artist acceptance** *(unlocks Hot Numbers / JazzSoc)*
Venue sends a gig invite with an expiry date. Artist accepts via link without necessarily having a full account yet — prompted to build profile afterward. Removes the biggest friction in the booking confirmation flow.

**Build 4 — Artist media package** *(unlocks retention for Steve, broader ecosystem value)*
Artists upload/link bio, clips, reviews. Venue (and their staff/socials person) can access it once a gig is booked, without chasing. Shareable link. Steve explicitly asked for this.

---

## "What is a yes?" — by venue

Defining success as a **behaviour**, not an attitude:

- **Geldart**: Elvis adds next month's gig listings to Gigin and embeds the calendar widget on the Geldart website.
- **Hot Numbers**: Steve or Kevin create their own login and post one gig without Toby doing it for them.
- **La Raza**: Run one full booking through Gigin — create gig, invite artist, confirm.
- **JazzSoc**: One gig confirmed through Gigin with artist accepting via link (even without full account).
- **Blue Moon**: One booking with a signed contract through Gigin.

---

*Next step: Show mockups of Build 1 (calendar embed) to Elvis. If he embeds it — validate, build out Build 2 and 3, then approach Hot Numbers and La Raza.*
