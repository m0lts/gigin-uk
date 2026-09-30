# Gigin Strategy Roundup
*July 2026 — compiled from product-direction sessions*

---

## 1. What Gigin Is Becoming

Two-phase value prop:

**Phase A — Individual utility (no network required)**
Tools that are useful to a single booker or artist even if nobody else is on the platform.
- Booker CRM: track artists, notes, gig history, outstanding invites, availability
- Artist venue discovery: map/directory of venues with specs, capacity, fees, contact info — useful before they've ever booked through Gigin

**Phase B — Network effects (value grows with participation)**
- Public gig calendar + discovery (audiences find gigs)
- Communities (see §5)
- Artist availability matching (touring windows posted, venues find them)
- Peer-mediated trust signals (mutual connections, shared scenes)

The logic: Phase A gets individual venues and artists into the habit of using Gigin. Phase B is what makes it sticky and defensible. Current mistake is leading with Phase B before Phase A exists.

---

## 2. Venue Conversations

### Alex (CMP / Discovery Sessions)
Meeting happened. Alex doesn't want to take over curating but wants Discovery Sessions to continue. Fine — the booking side is already on Gigin (Toby runs the Hot Numbers account). No action needed beyond keeping Steve looped in. Alex is a warm contact for the broader Cambridge student music angle later.

### Conversations still to have
- **Elvis (Geldart)** — show calendar embed mockup; his only ask is public audience discovery
- **Simon (Hot Numbers owner)** — arm with Steve Meeting 2 notes; Steve has admin access already
- **La Raza** — have the first real conversation; likely 8/10 closability but no data yet
- **Alec (Tram Depot)** — re-establish contact; adoption collapsed after staff turnover

---

## 3. Build Priority

Derived from venue map (see `venue_map.md`):

1. **Public gig calendar + website embed** — unlocks Geldart immediately; iframe, copy-paste embed code, neutral styling; `/embed/venue/:venueId` route
2. **Venue profile builder with specs** — capacity, fees, tech setup, model; like Airbnb listing fields; self-filter mechanism for both Steve and Elvis
3. **Time-limited invites + lightweight artist acceptance** — accept via link without full account; prompted to build profile afterward; unlocks Hot Numbers / JazzSoc
4. **Artist media package** — external links (YouTube/SoundCloud/Spotify/Bandcamp), not direct uploads; Google Drive/Dropbox link field unlocks post-booking; no direct video hosting

**Still to spec (not yet written up):**
- Profile redesign: artist + venue; one profile for all (gig-goers + professionals); LinkedIn/Facebook/Instagram-familiar; context-sensitive CTAs; cover image, accent colour, pinned section
- Embeddable calendar detail spec (list vs calendar view, styling options, iframe security)
- Booker CRM spec (as individual-utility Phase A tool)
- Artist venue discovery map spec

---

## 4. AI-Assisted Gig Onboarding

The single biggest friction point for getting a venue to use Gigin is the blank-slate setup: they have 12 upcoming gigs already on their website and now they have to re-enter them all. This feature removes that.

**How it works:**

When a venue claims their page or logs in for the first time, they're offered an AI onboarding flow:

1. **Scrape their website.** Enter (or auto-detect from the claim flow) the venue's website URL. The scraper finds their events/gigs page, extracts structured data: artist/band name, date, time, ticket price/link, any description. Also checks for Eventbrite/Dice/Ticketmaster links embedded on their site — those have structured event data, which makes extraction cleaner.

2. **Draft gigs presented for review.** A list of scraped gigs is shown with auto-filled fields. Confidence is displayed per-field (high = cleanly extracted, low = inferred/guessed). The venue can confirm, edit, or delete each one.

3. **Conversational gap-filling.** An AI chat interface flags missing required fields before a gig can be published. It asks for what's missing in natural language rather than surfacing a validation error on a form. For example:
   - "I found a Jazz Night on August 3rd but couldn't find the artist name — do you know who's playing?"
   - "What's the door price for the Fri 15th show? I couldn't find it on the site."
   - "Is there a sound engineer provided, or do bands bring their own gear?"

4. **Artist linking.** Where a scraped artist name matches a Gigin profile, it auto-links. Where it doesn't, it creates a lightweight reference (unlinked artist name) and optionally sends a demand-driven notification to that artist if they're indexed in the discovery tool.

5. **Gigs go live on the venue calendar.** Once confirmed, all gigs publish to the venue's Gigin page and appear in the public calendar — immediately giving the venue value (audience visibility) without manual re-entry.

**Data sources for scraping (in priority order):**
- Venue website events/gigs page
- Eventbrite/Dice/Ticketmaster embedded listings (structured event schema)
- Google Events (venues sometimes publish structured event markup)
- Facebook Events — ToS/API access is complex; potentially viable but de-prioritised

**This also solves the "first value moment" problem.** A venue goes from "nothing on my Gigin page" to "all my upcoming gigs live" in a single session, before they've done any manual data entry. That's the moment they see why it's worth continuing to use it.

---

## 5. Communities — What Are They For?

These need proper spec but the use cases are:

- **Artists posting upcoming gig opportunities** they want to share (support slots, co-bills)
- **Venues/bookers posting open slots** ("looking for a folk act for a Friday in October")
- **Artists posting availability windows** by date range and region
- **Genre/scene-based feeds** (Cambridge jazz, indie, folk etc.) — gig posts and opportunities routed by scene tag
- **Gig-goer following** — audiences who want to know what's on, not just book or play

The Facebook Group / community page mental model. Build one pilot community first, validate before generalising. Scene membership is visible on profiles as a lightweight trust/compatibility signal.

---

## 5. Content Strategy — Instagram

**Format:** Weekly carousel. Slide 1 = gig list for the week. Subsequent slides = one gig each (photo/still → video once available) with details overlaid.

**CTA:** Save this post ("save this for your week"). Saves are weighted more heavily than likes in the Instagram algorithm.

**Link in bio** → Gigin "this week" landing page → ticket links / venue pages.

### Hooks for the front slide

- "Haven't been out in a while?"
- "Gigs you don't want to miss in Cambridge this week."
- "Your Cambridge weekend sorted."
- "This week in Cambridge — save this."
- "Don't say you didn't know."
- "5 Cambridge gigs worth leaving the house for."
- "Staying in this week? Think again."
- "Too good to miss."

Mix these week to week. Test which generates most saves/reach.

### Engagement — comment strategy

End each post with a prompt: "Did you go to one of last week's gigs? Drop a comment with your thoughts." Or: "Want gig roundups in [another city]? Comment below." This surfaces demand for expansion before building it, and comment engagement boosts the post in the algorithm.

### Content sourcing

- Ask each venue when you ask to feature their gigs: "Can you also send clips or photos taken at the venue for the recap?"
- Venues have every incentive (free promotion), creates regular contact before any Gigin adoption ask
- Photographers/videographers at Cambridge gigs: offer free Gigin profiles + credit in exchange for content
- Find a tastemaker/scene figure to be the editorial voice — Toby is building the infrastructure, not the personality brand

### Automation pipeline (once enough venues listing gigs)

Firestore gig data → weekly Firebase Function → Bannerbear or Placid (image generation API) → Buffer or Instagram Graph API (scheduling). Aim for near-zero manual work per post once set up.

### Revenue from content

Not now. Once reach is meaningful: featured/sponsored placement for venues or promoters. Keep it free value first to build trust with venues.

---

## 6. Longer-Term Product (Not Build Yet)

- **Artist discovery search tool** (booker-facing): scrapes venue/promoter websites + Spotify/Bandcamp/SoundCloud APIs; unclaimed artist profiles; venue contacting unclaimed artist triggers demand-driven join notification
- **Flood Gigin with unclaimed venue profiles**: Google Places API + lightweight scraper for email/Instagram; unclaimed profile shows external contact links; "Claim this venue" CTA
- **"This week" landing page on Gigin**: public, clean, links from Instagram bio, shows gigs + ticket links
- **Musician touring/availability windows**: artists post open dates by region, venues find them

---

## 7. Key Decisions Still Open

1. Exact claim/verification mechanism for Pages (domain-matched email? invitation? manual review?)
2. Whether reviews/credibility follow the Account or stay with the Page
3. Promoter/Collective as a third Page type — and when
4. How map-based discovery coexists with community-based discovery long-term
5. Monetisation sequencing — deferred but needs a rough position so Phase 1–3 choices don't foreclose it
6. Communities full spec — what each one is for, who can post, how posts are surfaced

---

*References: `product_spec.md` (full spec), `venue_map.md` (per-venue breakdown), `gigin_implications.md` (dissertation product implications)*
