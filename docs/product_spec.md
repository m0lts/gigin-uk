# Gigin Product Spec (v1 — Restart Direction)

*Drafted June 2026. Synthesises decisions from product-direction discussion, grounded in T221 dissertation findings (see `gigin_implications.md` in Major Project Files for full sourcing). Status: working spec — open questions are flagged explicitly, not decided by default.*

## 1. What Gigin Is

Gigin is a network for Cambridge's (and later other cities') live music ecosystem — venues, artists, bands, and promoters — built around identity and trust first, with booking and payment as a layer on top rather than the entry point.

The dissertation's core finding is that the binding constraint on adoption in this kind of ecosystem isn't product features, price, or usability. It's exposure (does platform information reach this actor at all) and trust (is the source credible enough to evaluate). A platform led with "browse and book" treats those as solved problems. They aren't. This spec treats them as the product.

This does **not** mean rebuilding what already exists. The current codebase already has gig posting, a calendar, Stripe Connect payments, a CRM, reviews, and invite flows. Those are largely retained. What changes is the identity and discovery layer underneath them.

## 2. Core Structural Decisions

Four decisions, each marked by how strongly the dissertation evidence supports it.

| Decision | Basis |
|---|---|
| Individual **Account** is the atomic identity, not role-specific (Musician/Booker) account types | **Data-backed.** Participants routinely span roles — musicians who book (Fabian, Dan), venue staff who play, promoters who programme. A rigid role split doesn't match the ecosystem. |
| Venues and Bands are **claimable Pages**, not free-text fields | **Data-backed.** Maps directly to the institutional/ethical trust register (Stage 1) and the curatorial-credibility finding (Eventbrite-as-archive). An impersonated or unverifiable venue identity is exactly the kind of thing that disqualifies a platform on sight. |
| Artist Profile is a **facet nested under Account**, not a separate top-level entity | **Data-backed**, same reasoning as decision 1 — it's a role someone holds, not a different kind of user. |
| LinkedIn-style profile/job visual patterns, Facebook-style community pages | **Design judgement, not dissertation evidence.** Familiar UI patterns plausibly lower the operational-compatibility bar (Stage 2), but this wasn't tested by the research. Flagging so it isn't over-cited later. |

## 3. Identity Model

**Account** — one per person. Viewable, public-facing (this doesn't exist today; `Account.jsx` is currently a private settings page only). Shows: name, location, scenes they belong to, Pages they admin or are a member of, and — behind a button/tab — their Artist Profile if they have one. This is the LinkedIn-personal-profile equivalent.

**Artist Profile** — a facet of an Account, not a separate account type. Functions as an EPK: shareable profile with audio, bio, booking info. Exists today as `ArtistProfile.jsx` / `ArtistProfileViewer.jsx`; needs to move from being the primary public surface to being nested under the Account.

**Pages** — claimable entities: Venue, Band, and (later, not v1) Promoter/Collective. Facebook-Page-style: have one or more admins, can exist *unclaimed* (pre-populated from public data, e.g. a venue's name/address/contact pulled from public listings before anyone from that venue has joined), and become *claimed* once an admin verifies affiliation.

Bands share the claim/admin/member *structure* with Venues, no bespoke logic needed there. (Today: `BandCreator.jsx`, `JoinBand.jsx`, `BandMembersTab.jsx` already implement something close to this for Bands specifically; the work is generalising the pattern to Venues and making both first-class Pages.) But the *seeding* mechanism does not generalise — see §4.

## 4. Claiming & Verification

The problem this solves: if anyone can post "gig at SixSix," what stops someone posting *as* SixSix without authorisation?

The resolution is a distinction between two different actions:

- **Referencing a Page** — "I'm playing at SixSix on the 4th." Low risk, no permission needed, equivalent to tagging a location. Anyone can do this against any Page, claimed or not.
- **Acting as a Page** — posting an official gig opportunity as SixSix, responding to a booking request as SixSix, receiving payment as SixSix. High risk if the actor isn't actually affiliated. Requires the Page to be claimed, and the poster to be an admin of it.

This means most posting activity needs no verification at all — only the subset of actions where impersonation causes real harm is gated. Unclaimed Pages display a visible "unclaimed" status and a "claim this page" prompt to anyone viewing them.

**Flood Gigin with unclaimed venue profiles.** Scrape Cambridge (then other cities) venues from public data and pre-populate claimable profiles. The unclaimed profile shows: venue name, address, photo, Instagram link, email, website — whatever's publicly available. Instead of a "message on Gigin" button, it shows external contact links (email, Instagram) since the venue isn't on the platform yet. A prominent "Claim this venue" CTA sits at the top. This immediately makes Gigin feel populated with real places, gives artists/gig-goers somewhere to discover and reference venues, and creates inbound pressure on venues to claim their page when they see it exists. Data sources: Google Places API (structured — name, address, phone, website, category) + a lightweight scraper that visits each venue's website URL and extracts mailto: and instagram.com links. Claimed profiles replace external contact links with the full Gigin messaging/booking flow and unlock gig posting, CRM, invites etc.

**Pre-population only works for Venues.** Venues are public, structured, scrapeable entities — name, address, contact, social presence are all sourceable without the venue's involvement, which is what makes an unclaimed-then-claimed flow viable. Bands and individual Artist Profiles have no equivalent: there's no canonical public data source, and generating a bio/profile/music presence for someone without their input is a different (and worse) kind of problem than listing a venue's public business info. So Band Pages and Artist Profiles cannot be pre-populated — they only come into existence when a real person creates them. Practically: the venue side of the network can look populated from day one; the artist/musician side can only grow through actual sign-ups, which puts more weight on the musician-first broker-targeting outreach from the dissertation's Stage 0 findings (§ traceability appendix) rather than a cold-start data trick.

**Open question — exact claim mechanism not yet decided.** Candidates: domain-matched email verification, phone verification, invitation from an already-claimed/verified adjacent Page (e.g. an existing staff member invites a colleague), or manual admin review for early Pages. Needs a decision before build; likely some combination, with manual review as a fallback for ambiguous cases early on while volume is low.

## 5. Gig Posting Model

- Gigs reference **Page IDs**, not free-text addresses. A gig is tied to a specific Venue Page record.
- Posting is not restricted to Venue/Promoter Pages — individual Accounts (musicians) can post too: looking for support slots, advertising availability, finding co-bills. This responds directly to the finding that musicians are active booking agents, not passive performers, and partially restores the connective function that management-company centralisation of support slots removed.
- Posts can be routed through **scene communities** (see §6) by genre/location tag, so reach doesn't depend on the poster already knowing everyone relevant.
- **Artist discovery search tool (booker-facing).** Bookers can search for artists to book — not just Gigin users, but indexed from external public sources: venue/promoter websites (scrapeable public event listings), and API-based sources (Spotify, Bandcamp, SoundCloud for metadata like genre, follower count, top cities). Social media scraping (Instagram/Facebook) is out — ToS risk and technically fragile. Prestige/level matching uses proxy signals: what venues has an artist played, at what tier. Discovered artists appear as unclaimed profiles. A venue contacting an unclaimed artist triggers a notification to that artist ("a venue found you on Gigin — claim your profile to respond"), which inverts the cold-start problem: artists get a concrete, demand-driven reason to join rather than a speculative one. This also means venues get immediate value from the search tool regardless of how many artists have signed up to Gigin directly.
- **Payment terms default + per-gig override.** Venues set a default payment structure in their Page/profile setup (e.g. flat fee, % of ticket sales, door split, no pay) which pre-fills whenever they post a gig. They can override this per gig if the terms differ. This reduces repetitive form-filling for regular bookers while keeping flexibility for one-offs or unusual arrangements.

## 6. Scene Communities

The dissertation finding here: "the Cambridge scene" is too broad to be a meaningful unit — what exists is overlapping sub-scenes by genre, venue size, and geography.

- Facebook-Group-style communities, user-creatable and joinable, organised around scene (e.g. genre, venue tier, geography).
- Membership is visible on an Account or Page and functions as a lightweight compatibility/trust signal before any direct contact — "this person is in three scenes I recognise" is a faster trust check than a cold profile.
- Gig posts and opportunities route into relevant communities based on tags, which is also the mechanism for surfacing things to people who aren't already connected to the poster.

**v1 scope note:** build one pilot community structure, not a fully general system, to validate the mechanism before generalising.

## 7. Trust & Onboarding Mechanics

- **Trust-routed invites.** When an existing user invites a non-member (individual or Page), the invite is framed as coming from that user, not from Gigin as a company — keeps first contact warm rather than cold. (Partial groundwork exists: `InviteAndShareModal.jsx`, `InviteMethodsModal.jsx`.)
- **Contact sync on join.** New users can sync contacts; the platform surfaces which are already on Gigin (claimed or pre-populated) as suggested connections.
- **Mutual connections visible on profiles/Pages.** Digitises the "I'd call X to check on this" mechanism documented across the corpus.
- **Ecosystem-credible social proof in onboarding.** Surface named, locally-recognisable adopters during onboarding, not generic user counts — this maps directly to the compositional (not numerical) threshold finding from Stage 3.

## 8. Reviews & Credibility — open thread, not resolved

Reviews currently attach to a musician profile or venue profile (`getReviewsByMusicianId`, `getReviewsByVenueId`). Under the new model, does a person's credibility (e.g. as a promoter or reliable booker) follow their Account as they move between Bands and Pages, or stay attached to whichever Page/Profile earned it? Recommend it follows the Account as the default (consistent with treating Account as the durable identity) but this needs a decision before build, particularly around what happens to a Page's review history if it changes admins/ownership.

## 9. What Changes vs. What's Retained

**Retained largely as-is:** gig posting/calendar mechanics, Stripe Connect payments and payouts, the venue CRM, the review system's underlying data model (pending §8), map-based discovery as a secondary browse surface.

**New build:** public Account profile (doesn't currently exist), Page entity for Venues with claim/unclaimed states (Bands already close), claim verification flow, scene communities, trust-routed invite framing, contact sync, mutual-connections surfacing, EPK repositioning of Artist Profile as an Account facet.

**Changes to existing flows:** gig posting moves from free-text venue address to Page-ID reference; Artist Profile becomes reachable from Account rather than being the top-level artist surface.

## 10. Phased Build (MVP framing)

The booking/payment layer is already built and isn't what the research says is the bottleneck — exposure and trust are. So the MVP is the identity/trust layer, not a smaller version of the whole product.

- **Phase 1 — Identity foundation.** Unified Account model, public Account profile page, Venue Pages with claimed/unclaimed states and a basic claim flow, Artist Profile nested under Account, Bands generalised into the same admin/member Page structure (creation stays member-initiated — no scrape path, unlike Venues).
- **Phase 2 — Trust-routed growth.** Invite framing, contact sync, mutual connections surfaced on profiles/Pages, pre-population of unclaimed Venue Pages from public data (venue-only — Bands and individual Accounts grow only through real invites/sign-ups, not pre-population).
- **Phase 3 — Scene layer.** One pilot scene community, tagged gig posting through it, ecosystem-credible social proof in onboarding.
- **Deferred / not v1:** Promoter/Collective Page type, business-model features (boosted posts beyond the existing Promote modal, discovery-feed monetisation, website embeds), full generalisation of scene communities beyond the pilot.

## 11. Open Questions Requiring a Decision

1. Exact claim/verification mechanism for Pages (§4).
2. Whether reviews/credibility follow the Account or stay with the Page/Profile (§8).
3. Whether Promoter/Collective becomes a third Page type, and when.
4. How map-based discovery (existing `GigFinder`/`VenueFinder`) coexists with scene-community-based discovery — both, or does one become primary over time?
5. Monetisation sequencing (commission, pro tier, boosted posts, discovery promotion) — deferred past v1 but needs a rough position so Phase 1–3 build choices don't foreclose it.

## Appendix: Traceability to Dissertation Findings

| Spec decision | Dissertation source |
|---|---|
| Unified Account, no role-locked types | Context notes on dual/multi-role participants (Fabian, Dan, Simon) |
| Claimable Pages, claim/unclaimed distinction | Stage 1 institutional/ethical trust register; Eventbrite curatorial-credibility finding (6.5, implications doc Tier A/B) |
| Open posting via individuals and communities | Support-slot fragmentation finding (5.6); musicians as active booking agents (implications doc Tier B #9) |
| Scene communities | Overlapping sub-scenes finding (implications doc Tier B #6) |
| Trust-routed invites, contact sync, mutual connections | Stage 1 relational trust; implications doc Tier B #2, #7, #8 |
| Social proof in onboarding, not user counts | Stage 3 compositional (not numerical) threshold finding (5.5) |
| MVP prioritising identity/trust over booking rebuild | 6.3 Practical Implications — cold outreach and exposure failure, not product attributes, as the binding constraint |
