# Audit: Event Type / `kind` usage

**Goal:** Event Type should be metadata only (display + filtering), not behaviour.

---

## 1. Constants / enums

| Location | What | Classification |
|----------|------|----------------|
| `AddGigsModal.jsx` L30 | `GIG_KIND_OPTIONS = ['Live Music', 'Background Music', 'Wedding', 'Open Mic', 'House Party']` | **Data model** – options for event type selector; keep for display/filter. |
| `AddGigsModal.jsx` L871 | `kind: 'Venue Rental'` when adding rental slot | **Data model** – setting slot kind for new rental; keep. |
| `Privacy.jsx` L24 | `gigTypes` array (includes Open Mic, etc.) | **Display** – options for event type step. |
| `FilterPanel.jsx` L60–63 | `<option value="Ticketed Gig">`, `<option value="Open Mic">` | **Display** – filter dropdown options. |
| `VenueGigsList.jsx` L73–79 | `findGigIcon(kind)` switch on "Ticketed Gig", "Open Mic", "Venue Rental" | **Display** – icon per kind. |

---

## 2. Display-only (A) – safe; keep for labels/tags/UI

| File | Line(s) | What | Replaceable? |
|------|---------|------|--------------|
| `AddGigsModal.jsx` | 938, 959, 1736–1737 | `slotKind = gig.kind`, payload `kind`, and Event Type select value | No – this is the source of truth for the label. |
| `NextGig.jsx` | 207, 258, 260 | Subtitle "Open Mic" vs date; heading `nextGig.kind`; conditional "from X" (hide for OM/Ticketed) | No – display copy only. |
| `VenueGigsList.jsx` | 233–236 | Icon + title: Ticketed Gig / Open Mic / Venue Rental / else gig.kind | No – display. |
| `GigApplications.jsx` | 1291–1293, 1808 | Card title "Ticketed Gig" / "Open Mic" / `gigInfo.kind` | No – display. |
| `venue/dashboard/messages/GigInformation.jsx` | 44, 114–115 | `typeIcon(gigData.kind)`, `<p>{gigData.kind}</p>` | No – display. |
| `ListView.jsx` | 54, 59–60 | `<p>{gig.kind}</p>`; fee label shows kind when budget is £/No Fee | No – display (fee logic could use budget only). |
| `MapView.jsx` | 13–14, 41, 397–398 | Fee display helper; `kind: gig.kind` in payload; budget line shows kind | No – display. |
| `GigPage.jsx` | 1983–1986, 2443–2446 | Fee heading: show "Open Mic" / "Ticketed Gig" or "Hire Price" / "gig fee"; Ticketed subline | No – display (Hire Price vs fee could use `isVenueRental` only). |
| `artist/dashboard/Gigs.jsx` | 421 | `<td>{gig.kind}</td>` | No – display. |
| `venue/gig-post/Review.jsx` | 228, 234 | Review summary: kind or budget; "privacy + kind" | No – display. |
| `Privacy.jsx` | 76 | Card selected state `formData.kind === gt` | No – form state for event type step. |
| `landing-page/LandingPage.jsx` | 48–49, 73 | Fee label when no fee; `kind: gig.kind` in card | No – display. |
| `artist/artist-profile/messages-components/GigInformation.jsx` | 81, 136 | `typeIcon` for Ticketed Gig; `<p>{gigData.kind}</p>` | No – display. |
| `artist/artist-profile/gigs-components/ArtistProfileGigs.jsx` | 655 | "Ticketed" / "Open Mic" / else short label | No – display. |
| `GigHandbook.jsx` | 581, 583 | `<h3>{gigForHandbook.kind}</h3>`; show fee section when not OM/Ticketed | **Partially** – fee visibility could use **budget** only (see Behavioural). |

---

## 3. Filtering / search-only (B) – keep for queries/filters

| File | Line(s) | What | Replaceable? |
|------|---------|------|--------------|
| `src/services/client-side/gigs.js` | 123–124 | `if (filters.kind) q = query(q, where('kind', '==', filters.kind))` | No – Firestore filter; keep for discovery. |
| `FilterPanel.jsx` | 53–54, 94 (commented) | `pendingFilters.kind`, filter by kind; commented budget filter by kind | No – filter state and UI. |
| `GigFinder.jsx` | 26, 140 | `kind: searchParams.get('kind')`, `updatedParams.set('kind', …)` | No – URL/search filter. |

---

## 4. Behavioural logic (C) – should be replaced by structured fields

### 4.1 Acceptance / payment flow (use budget + financial model, not kind)

| File | Line(s) | What | Replace with |
|------|---------|------|--------------|
| `artist/.../MessageThread.jsx` | 186, 260 | `nonPayableGig = kind === 'Open Mic' \|\| kind === 'Ticketed Gig' \|\| budget === '£' \|\| '£0'` | **Budget only:** `nonPayableGig = budget === '£' \|\| budget === '£0'` (or explicit `paymentModel: 'door_split' \| 'guarantee' \| …`). |
| `artist/.../MessageThread.jsx` | 194, 241 | Accept flow: if Open Mic → `acceptGigOfferOM`; else → `acceptGigOffer`; if Ticketed → `notifyOtherApplicantsGigConfirmed` | **Financial model / booking type:** e.g. `acceptGigOfferOM` when slot/gig has a flag like `multiApplicantSlot` or payment type is door/ticketed; notify-others when applicable to that model. |
| `GigPage.jsx` | 737–740, 1040–1046 | `nonPayableGig` for apply/accept: Open Mic \|\| Ticketed \|\| Venue Rental \|\| budget £/£0; then `if (currentSlot.kind === 'Open Mic')` → `acceptGigOfferOM` else `acceptGigOffer` | Same as above: derive from **budget** (+ Venue Rental from **booking mode** or slot type), and use a **slot/gig financial model** to choose OM vs standard accept. |
| `GigHandbook.jsx` | 243, 282–286 | Cancel: if not Ticketed/Open Mic → `cancelGigAndRefund`; message text differs by kind (refund vs no refund) | **Refund:** use presence of payment/refund (e.g. `paymentIntentId` / paid flag) and **booking status**; message copy from that, not kind. |

### 4.2 Show/hide UI and actions (use budget / permissions / status)

| File | Line(s) | What | Replace with |
|------|---------|------|--------------|
| `artist/.../MessageThread.jsx` | 570, 629, 745 | Show counter-offer only when `kind !== 'Ticketed Gig' && kind !== 'Open Mic'` | **Budget:** show counter-offer when `budget !== '£' && budget !== '£0'` (or when payment model allows negotiation). |
| `artist/.../MessageThread.jsx` | 809, 832 | Announcement/confirmed message: different copy for Open Mic/Ticketed vs paid; "gig confirmed with fee" vs no fee | **Budget / agreedFee:** use `budget === '£' \|\| budget === '£0'` or `!agreedFee` for "no fee" copy. |
| `artist/.../GigInformation.jsx` | 118 | Show budget section only when `kind !== 'Ticketed Gig' && kind !== 'Open Mic'` | **Budget:** show when `budget && budget !== '£' && budget !== '£0'` (align with venue GigInformation). |
| `GigApplications.jsx` | 1913 | Show Accept/Decline for pending, non-invited, **when `slotGig.kind === 'Open Mic'`** and gig already confirmed (artist can still accept slot) | **Behavioural flag or slot type:** e.g. "multiple musicians can be accepted" / `multiAcceptSlot` derived from slot config, not kind. |
| `artist/.../MusicianProfile.jsx` | 252 | Invite message: if Ticketed/Open Mic omit fee; else include `gigData.budget` | **Budget:** include fee in text when `budget !== '£' && budget !== '£0'`. |
| `artist/.../ArtistProfile.jsx` | 668 | Same invite message branch (with vs without fee) | Same as above – **budget**. |

### 4.3 Gig post flow – wizard steps and validation (D overlaps C)

| File | Line(s) | What | Replace with |
|------|---------|------|--------------|
| `GigPostModal.jsx` | 292 | `formData.kind === ''` → error "Please select an event type" | **D** – keep: event type is required metadata. |
| `GigPostModal.jsx` | 326, 336 | Stage 7: if Open Mic → validate openMicApplications; if Ticketed → validate ticketedGigUnderstood; else budget validation | **C** – branch on **explicit flags:** e.g. `formData.openMicApplications !== null` when "Open Mic" selected; `formData.ticketedGigUnderstood` when "Ticketed" selected. Kind can stay as the trigger for which step is shown; logic can be "if Open Mic type chosen, require openMicApplications" (still kind-driven today). To make kind metadata-only, you’d need a separate "application style" or "financial model" field that drives these steps. |
| `GigPostModal.jsx` | 474 | Stage 7 component: if Open Mic → `<OpenMicGig />`, else `<GigBudget />` | Same – **wizard step routing** could be driven by a "flow type" or keep kind as the selector that implies flow (minimal change: keep; full cleanup: separate field). |
| `GigPostModal.jsx` | 528, 534 | Progress %: both branches same; dead code | Remove or simplify; no replacement needed. |
| `GigPostModal.jsx` | 718 | On submit: if not Ticketed/Open Mic, require slot budgets; else skip budget validation | **Budget / financial model:** require per-slot budget when payment model is "guarantee" (or when kind is not Ticketed/Open Mic if you keep kind for now). Prefer a field like "payment model" or "fee type". |
| `GigPostModal.jsx` | 952–961 | Invite message: if not Ticketed/Open Mic include "for {budget}"; else no fee in text | **Budget:** include fee in message when `firstGigDoc.budget !== '£' && firstGigDoc.budget !== '£0'`. |
| `Timings.jsx` | 120, 179 | Open Mic: "When does the Open Mic start?"; hide "Add Gig Slot" for Ticketed/Open Mic | **Display** (copy) + **flow:** "Add Gig Slot" could be hidden by a "single-slot event" or "multi-slot allowed" flag; today kind is the proxy. |
| `Date.jsx` | 222 | Hide "Add Gig Slot" when Ticketed/Open Mic | Same – **multi-slot allowed** flag. |
| `Budget.jsx` | 7–9, 42, 69–70, 144 | Initial state and "Ticketed Gig" / "Flat Fee" local kind; show second stage by kind | **D** – form state for budget step; could be driven by a "payment model" choice instead of kind. |

### 4.4 Venue rental (display + one behavioural use)

| File | Line(s) | What | Replace with |
|------|---------|------|--------------|
| `GigPage.jsx` | 1722 | `isVenueRental = kind === 'Venue Rental'` – used for "Hire Price", timeline vs access times, docs | **Booking mode / slot type:** store `bookingMode: 'rental'` or slot type "venue_rental" and derive from that instead of kind. |
| `GigPage.jsx` | 738–740, 1041–1043 | `nonPayableGig` includes `currentSlot.kind === 'Venue Rental'` | **Booking mode:** include when slot/gig is venue rental (from explicit field), not kind string. |

---

## 5. Data model / validation (D)

| File | Line(s) | What | Note |
|------|---------|------|------|
| `AddGigsModal.jsx` | 72, 871, 938, 959, 1736–1737 | Default `kind: 'Live Music'`; rental `kind: 'Venue Rental'`; slot payload `kind`; select updates `kind` | **Data model** – kind is stored and sent; keep for display/filter. No behaviour change needed here. |
| `GigPostModal.jsx` | 67, 111 | Initial `kind: ''` | Required field for post flow; keep. |
| `Privacy.jsx` | 15 | `handleKindSelect` sets `kind: e` | Form state; keep. |
| `FilterPanel.jsx` | 6, 54 | `kind` in filter state | Filter; keep. |
| `MapView.jsx` / `LandingPage.jsx` | 41, 73 | Pass `kind` in card/link payload | Display/filter; keep. |
| `GigPostModal.jsx` | 292, 304 | Validation: "Please select an event type" | Keep as validation of required metadata. |

---

## 6. Summary table

| Classification | Count (approx) | Action |
|----------------|----------------|--------|
| **A) Display-only** | ~20+ refs | Keep; no change. |
| **B) Filtering/search** | 3 locations | Keep for Firestore and filter UI. |
| **C) Behavioural** | ~15+ refs | Replace with: **budget**, **booking status**, **financial model** (or **slot type**), **permissions**, and **Venue Rental** from booking mode/slot type. |
| **D) Data model / validation** | ~10 refs | Keep `kind` as required metadata; optionally add **payment model** / **slot type** for wizard and backend logic. |

---

## 7. Recommended structured fields (to replace kind in behaviour)

- **budget / fee amount** – already exists; use for nonPayableGig, counter-offer visibility, invite copy, budget section visibility.
- **booking status** – e.g. looking vs confirmed; can drive "re-posted" copy and some buttons.
- **ticketing responsibility** – already on rental; use for display only if needed.
- **financial model** – e.g. `flat_fee` | `door_split` | `ticketed` | `no_fee` to choose accept path (OM vs standard), refund flow, and wizard steps.
- **permissions / role** – already used; keep for Accept/Decline visibility.
- **Venue Rental** – from `bookingMode === 'rental'` or slot/gig type, not from `kind === 'Venue Rental'`.
- **Boolean flags** – e.g. `multiAcceptSlot` or "single-slot only" for Open Mic–style slots (to show Accept/Decline when another musician already confirmed).

Once behaviour is driven by these, **event type (`kind`)** can remain as **metadata only** (display + filtering).
