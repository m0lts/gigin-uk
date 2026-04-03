# AddGigsModal.jsx — Structural audit

## 1. Opening line for `return (`

- **Line 1298:** `return (`

## 2. Top-level JSX children of the returned root

The root element is **`<Portal>`** (line 1299). It has a single child:

| # | Opening | Closing |
|---|---------|---------|
| 1 | `<div className="modal add-gigs-modal" ...>` (1300) | `</div>` (2347) |

Inside that modal div:

- **modal-content** (1301) → closes 2346
  - **modal-header** (1302) → closes 1309
  - **modal-body** (1310) → should close before footer
  - **footer** (2317) → closes 2344
  - then `</div>` (2345), `</div>` (2346), `</div>` (2347)

## 3. Children of modal-body (1310)

| # | Opening | Intended closing |
|---|---------|-------------------|
| 1 | `{ step === 'dates' && (` (1311) → `<>` (1312) | `</>` (1358) `)}` (1359) |
| 2 | `{ step === 'details' && (` (1361) → `<div className="add-gigs-details-step">` (1362) | `</div>` then `)}` |
| 3 | `<div ... add-gigs-actions--footer>` (2317) | `</div>` (2344) |

## 4. Step === 'details' block (1361–2315)

- **1361:** `{ step === 'details' && (`
- **1362:** `<div className="add-gigs-details-step">` (12 spaces)

Children of **add-gigs-details-step**:

1. **1363–1439:** `{!isEditManuallyConfirmed && ( <div sticky-date-bar> ... </div> )}` — closed at 1439.
2. **1441–????:** `{ activeTab && currentGig && ( <div className="add-gigs-panel"> ... )}` — must close with `</div>` for panel then `)}`.

**activeTab && currentGig** (1441) wraps:

- **1442:** `<div className="add-gigs-panel">` (16 spaces)

So we need:

1. `</div>` (16 spaces) to close **add-gigs-panel** (1442)
2. `)}` to close **activeTab && currentGig** (1441)
3. `</div>` (12 spaces) to close **add-gigs-details-step** (1362)
4. `)}` to close **step === 'details'** (1361)

## 5. Where the parser leaves JSX

- **2313:** `)}` (18 spaces) — closes `currentBookingMode && (` (1987). Parser is still inside **add-gigs-panel** (1442).
- **2314:** `</div>` (12 spaces) — matches indentation of **add-gigs-details-step** (1362), so this closes **add-gigs-details-step**, not the panel.
- **2315:** `)}` (10 spaces) — closes `step === 'details' && (` (1361).

So the **closing `</div>` for `add-gigs-panel` (1442) is missing**. The `</div>` at 2314 closes **add-gigs-details-step** (1362) while **add-gigs-panel** (1442) is still open. The `)}` at 2315 then closes the step block. So:

- The `)` at 2315 closes the `return (` (1298) in the parser’s view (or produces a broken stack), because the JSX tree was closed in the wrong order.
- The panel div is never closed; the next `</div>` (2345) is consumed as modal-body, so the rest of the layout is misaligned and the final `</div>` is parsed outside JSX → “Unterminated regular expression”.

## 6. First structurally invalid line

**Line 2314** is the first structurally invalid line:

- At 2313 we are inside **add-gigs-panel** (1442).
- The next closing tag must be `</div>` with **16 spaces** to close the panel.
- Instead, the next closing tag is **2314:** `</div>` with **12 spaces**, which closes **add-gigs-details-step** (1362) and leaves the panel unclosed.

**Smallest surrounding block that proves the mismatch:**

```2311:2316:src/features/venue/dashboard/AddGigsModal.jsx
                    </div>
                  )}
            </div>
          )}

          <div className={`add-gigs-actions add-gigs-actions--footer ...
```

- 2310 `</div>` — closes a child of more-details.
- 2311 `)}` — closes showMoreDetails (1999).
- 2312 `</div>` — closes add-gigs-extra-timings (2000).
- 2313 `)}` — closes currentBookingMode (1987). **We are inside add-gigs-panel (1442).**
- 2314 `</div>` — 12 spaces; closes add-gigs-details-step (1362). **add-gigs-panel (1442) was never closed.**
- 2315 `)}` — closes step === 'details' (1361).

## 7. Minimal fix

Insert one line before the current 2314: a closing `</div>` with **16 spaces** to close **add-gigs-panel** (1442). Required order of closing:

1. `)}` (2313) — closes currentBookingMode (1987)
2. `</div>` **16 spaces** — closes add-gigs-panel (1442) **[MISSING in file]**
3. `</div>` 12 spaces (2314) — closes add-gigs-details-step (1362)
4. `)}` (2315) — closes step === 'details' (1361)

No refactor, no wrappers, no speculative tags: one missing `</div>` for the panel opened at 1442.
