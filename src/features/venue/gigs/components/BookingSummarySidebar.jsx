import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { hasVenuePerm } from '@services/utils/permissions';
import { updateGigDocument } from '@services/api/gigs';
import { getArtistProfileById, getMusicianProfileByMusicianId } from '@services/client-side/artists';
import { EditIcon, InviteIconSolid } from '@features/shared/ui/extras/Icons';
import { gigSlotHasConfirmedArtist } from '../utils/multiSlotGigGroup';
import {
  buildArtistBookingMergedTimingDisplayRows,
  buildVenueHireGigDetailsTimingDisplayRows,
} from '../utils/venueHireGigDetailsTimings';

/** Labels when we don't use the venue-pays-artist summary line (see `resolveFeeModelDisplayLabel`). */
const PAYMENT_MODEL_LABEL = {
  artist_pays_venue: 'They pay to hire the space',
  no_fee: 'No fee',
};

/** Formatted hire/budget amount for Gig summary (hireFee / budget). */
function formatHireFeeAmountForSummary(rawGig) {
  const raw = String(rawGig?.hireFee ?? rawGig?.budget ?? '').trim();
  if (!raw || raw === '£' || raw.toLowerCase() === 'free') return '—';
  if (raw === '£0') return '£0';
  if (/^£/.test(raw)) return raw;
  const numeric = raw.replace(/[^0-9.]/g, '');
  if (numeric !== '' && parseFloat(numeric) >= 0) return `£${numeric}`;
  return raw || '—';
}

/** `venue_pays_artist` → "I'll pay the artist(s)" • [amount]; other keys use `PAYMENT_MODEL_LABEL`. */
function resolveFeeModelDisplayLabel(paymentModelKey, rawGig) {
  if (paymentModelKey === 'venue_pays_artist') {
    return `I'll pay the artist • ${formatHireFeeAmountForSummary(rawGig)}`;
  }
  return PAYMENT_MODEL_LABEL[paymentModelKey] ?? '—';
}

function inferVenueHirePaymentModelKey(rawGig) {
  const explicit = rawGig?.paymentModel;
  if (explicit === 'venue_pays_artist' || explicit === 'artist_pays_venue' || explicit === 'no_fee') {
    return explicit;
  }
  const feeRaw = rawGig?.hireFee ?? rawGig?.budget ?? '';
  const feeStr = String(feeRaw).trim();
  if (!feeStr || feeStr === '£' || feeStr.toLowerCase() === 'free') return 'no_fee';
  const digits = feeStr.replace(/[^\d.]/g, '');
  if (digits === '' || parseFloat(digits) === 0) return 'no_fee';
  return 'artist_pays_venue';
}

/**
 * Artist-booking payment model inference. Prefer explicit paymentModel; else
 * infer from kind (legacy Ticketed Gig / Open Mic) or fee amount. Never returns
 * artist_pays_venue (that's a venue-hire concept).
 */
function inferArtistBookingPaymentModelKey(rawGig) {
  const explicit = rawGig?.paymentModel;
  if (explicit === 'venue_pays_artist' || explicit === 'no_fee') return explicit;
  const kind = rawGig?.kind;
  if (kind === 'Ticketed Gig' || kind === 'Open Mic') return 'no_fee';
  const feeRaw = rawGig?.budget ?? rawGig?.hireFee ?? '';
  const feeStr = String(feeRaw).trim();
  if (!feeStr || feeStr === '£' || feeStr.toLowerCase() === 'free') return 'no_fee';
  const digits = feeStr.replace(/[^\d.]/g, '');
  if (digits === '' || parseFloat(digits) === 0) return 'no_fee';
  return 'venue_pays_artist';
}

function formatTicketingResponsibility(v, kind) {
  if (v === 'venue') return 'Venue handles ticketing';
  if (v === 'artist') return 'Artist handles ticketing';
  if (v === 'free_entry') return 'Not ticketed';
  if (kind === 'Ticketed Gig') return 'Artist handles ticketing';
  if (kind === 'Open Mic') return 'Not ticketed';
  return '';
}

function resolveTicketingLabel(rawGig) {
  const v = rawGig?.ticketingResponsibility ?? rawGig?.ticketingModel;
  const label = formatTicketingResponsibility(v, rawGig?.kind);
  return label || '—';
}

function formatPaymentAmountForSet(feeLabel) {
  if (feeLabel == null || String(feeLabel).trim() === '' || feeLabel === '£') return '—';
  if (feeLabel === 'No fee') return 'No fee';
  return String(feeLabel).trim();
}

const BOOKED_APPLICANT_STATUSES = ['confirmed', 'accepted', 'paid', 'payment processing'];

function formatTimeRangeSpaced(timeRangeLabel) {
  if (!timeRangeLabel || typeof timeRangeLabel !== 'string') return '—';
  return timeRangeLabel.replace(/\s*[\u2013-]\s*/g, ' – ');
}

function resolveSlotDoc(mergedTimelineSlots, gigId) {
  if (!gigId || !Array.isArray(mergedTimelineSlots)) return null;
  return mergedTimelineSlots.find((s) => s.gigId === gigId) || null;
}

function getBookedApplicant(slotDoc) {
  if (!slotDoc?.applicants?.length) return null;
  return slotDoc.applicants.find((a) => BOOKED_APPLICANT_STATUSES.includes(a?.status)) || null;
}

function applicantHasDirectDisplayName(a) {
  if (!a) return false;
  return Boolean(
    String(a.name || a.artistName || a.accountName || a.displayName || a.musicianName || '').trim()
  );
}

function getBookedArtistDisplayName(slotDoc, profileNamesByApplicantId = {}) {
  const a = getBookedApplicant(slotDoc);
  if (!a) return '';
  const direct = String(
    a.name || a.artistName || a.accountName || a.displayName || a.musicianName || ''
  ).trim();
  if (direct) return direct;
  const id = a.id;
  if (id && profileNamesByApplicantId[id]) {
    return String(profileNamesByApplicantId[id]).trim();
  }
  return '';
}

async function fetchArtistDisplayNameForApplicantId(profileId) {
  if (!profileId || String(profileId).startsWith('manual-')) return '';
  try {
    let profile = await getArtistProfileById(profileId);
    if (!profile) profile = await getMusicianProfileByMusicianId(profileId);
    return profile?.name?.trim() || '';
  } catch {
    return '';
  }
}

function countReviewableApplications(slotDoc) {
  if (!slotDoc?.applicants?.length) return 0;
  return slotDoc.applicants.filter((a) => {
    const st = String(a?.status || '').toLowerCase();
    if (st === 'withdrawn' || st === 'declined') return false;
    if (BOOKED_APPLICANT_STATUSES.includes(a?.status)) return false;
    return true;
  }).length;
}

function parsePoundsAmount(str) {
  if (str == null || str === '') return null;
  const s = String(str).trim();
  if (!s || s === '£' || s.toLowerCase() === 'free' || s === 'No fee') return null;
  const n = parseFloat(s.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function formatPoundsFromNumber(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n === 0) return '£0';
  const rounded = Math.round(n) === n ? String(Math.round(n)) : String(n);
  return `£${rounded}`;
}

function resolveArtistBookingFinancialsFeeHeading(paymentModelKey, setCount) {
  if (paymentModelKey === 'venue_pays_artist') {
    return setCount > 1 ? 'Venue pays artists' : 'Venue pays artist';
  }
  if (paymentModelKey === 'no_fee') return 'No fee';
  return '—';
}

function formatApplicationCountLabel(count) {
  const n = Number(count);
  const c = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  if (c === 1) return '1 application';
  return `${c} applications`;
}

function MarkPaidForSetInline({ gigId, doc, feeLabel, canUpdate, busyGigId, setManualPaid }) {
  const stripePaid = doc?.paid === true;
  const manualPaid = doc?.venueMarkedArtistFeePaid === true;
  const paidLabel = stripePaid || manualPaid;
  const feeText = formatPaymentAmountForSet(feeLabel);
  const feeOk = feeText !== '—' && feeText !== 'No fee';
  const busy = busyGigId === gigId;
  if (!gigId || !feeOk) return null;

  return (
    <div className="venue-gig-page-sidebar__gig-summary-v2__fin-paid-actions">
      {stripePaid ? (
        <span className="venue-gig-page-sidebar__badge venue-gig-page-sidebar__badge--paid">Paid</span>
      ) : paidLabel ? (
        <>
          <span className="venue-gig-page-sidebar__badge venue-gig-page-sidebar__badge--paid">Paid</span>
          {canUpdate ? (
            <button
              type="button"
              className="btn tertiary venue-gig-page-sidebar__mark-btn"
              onClick={() => setManualPaid(gigId, false)}
              disabled={busy}
            >
              Mark as unpaid
            </button>
          ) : null}
        </>
      ) : canUpdate ? (
        <button
          type="button"
          className="btn tertiary venue-gig-page-sidebar__mark-btn"
          onClick={() => setManualPaid(gigId, true)}
          disabled={busy}
        >
          Mark as paid
        </button>
      ) : null}
    </div>
  );
}

function GigSummaryEditFooter({ onEditGig, onInviteArtist }) {
  const showFooter = typeof onEditGig === 'function' || typeof onInviteArtist === 'function';
  if (!showFooter) return null;
  return (
    <div className="venue-gig-page-sidebar__gig-summary-v2__footer">
      {typeof onInviteArtist === 'function' ? (
        <button
          type="button"
          className="btn artist-profile venue-gig-page-sidebar__gig-summary-v2__footer-btn"
          onClick={onInviteArtist}
          title="Invite an artist or promoter with a shareable link"
        >
          <InviteIconSolid /> Invite artist or promoter
        </button>
      ) : null}
      {typeof onEditGig === 'function' ? (
        <button
          type="button"
          className="btn tertiary venue-gig-page-sidebar__gig-summary-v2__edit-gig"
          onClick={onEditGig}
        >
          <EditIcon /> Edit gig
        </button>
      ) : null}
    </div>
  );
}

function renderVenueHireGigSummaryV2({
  rawGig,
  feeModelLabel,
  capacityDisplay,
  ticketingTypeLabel,
  onEditGig,
  onInviteArtist,
}) {
  const capTicketing = [
    capacityDisplay != null && String(capacityDisplay).trim()
      ? `Capacity ${capacityDisplay}`
      : null,
    ticketingTypeLabel && String(ticketingTypeLabel).trim() ? ticketingTypeLabel : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const hireFee = formatHireFeeAmountForSummary(rawGig);

  return (
    <div
      className="venue-gig-page-sidebar__surface-tile venue-gig-page-sidebar__surface-tile--booking-summary venue-gig-page-sidebar__gig-summary-v2"
      aria-label="Gig summary"
    >
      <section className="venue-gig-page-sidebar__gig-summary-v2__section">
        <h3 className="fill-this-slot__title fill-this-slot__title--invite-promoter venue-gig-page-sidebar__booking-summary-heading">
          Gig Summary
        </h3>
        {capTicketing ? (
          <p className="venue-gig-page-sidebar__gig-summary-v2__meta">{capTicketing}</p>
        ) : null}
      </section>

      <section className="venue-gig-page-sidebar__gig-summary-v2__section venue-gig-page-sidebar__gig-summary-v2__section--ruled">
        <p className="venue-gig-page-sidebar__gig-summary-v2__kicker">Financials</p>
        <div className="venue-gig-page-sidebar__gig-summary-v2__fin-row">
          <span className="venue-gig-page-sidebar__gig-summary-v2__fin-label">Fee model</span>
          <span className="venue-gig-page-sidebar__gig-summary-v2__fin-value">
            {feeModelLabel && String(feeModelLabel).trim() ? feeModelLabel : '—'}
          </span>
        </div>
        {hireFee !== '—' ? (
          <>
            <div className="venue-gig-page-sidebar__gig-summary-v2__fin-divider" />
            <div className="venue-gig-page-sidebar__gig-summary-v2__fin-row">
              <span className="venue-gig-page-sidebar__gig-summary-v2__fin-label">Hire fee</span>
              <span className="venue-gig-page-sidebar__gig-summary-v2__fin-value venue-gig-page-sidebar__gig-summary-v2__fin-value--strong">
                {hireFee}
              </span>
            </div>
          </>
        ) : null}
      </section>

      <GigSummaryEditFooter onEditGig={onEditGig} onInviteArtist={onInviteArtist} />
    </div>
  );
}

function ArtistBookingGigSummaryV2({
  normalisedGig,
  rawGig,
  feeModelLabel,
  capacityDisplay,
  ticketingTypeLabel,
  paymentModelKey,
  slotSummaries,
  showPerSetPayments,
  perSetArtistFeePaidInteractive,
  mergedTimelineSlots,
  refreshGigs,
  setGigInfo,
  canUpdate,
  onEditGig,
  onInviteArtist,
}) {
  const [busyGigId, setBusyGigId] = useState(null);
  const [bookedArtistNamesById, setBookedArtistNamesById] = useState({});

  const hasMulti = Array.isArray(slotSummaries) && slotSummaries.length > 1;

  useEffect(() => {
    const slots =
      hasMulti && Array.isArray(mergedTimelineSlots) && mergedTimelineSlots.length > 0
        ? mergedTimelineSlots
        : rawGig
          ? [rawGig]
          : [];
    const need = new Set();
    for (const slot of slots) {
      const a = getBookedApplicant(slot);
      if (!a?.id || applicantHasDirectDisplayName(a)) continue;
      if (String(a.id).startsWith('manual-')) continue;
      need.add(a.id);
    }
    if (need.size === 0) {
      setBookedArtistNamesById({});
      return;
    }
    let cancelled = false;
    (async () => {
      const pairs = await Promise.all(
        [...need].map(async (id) => {
          const name = await fetchArtistDisplayNameForApplicantId(id);
          return [id, name];
        })
      );
      if (cancelled) return;
      const next = {};
      for (const [id, name] of pairs) {
        if (name) next[id] = name;
      }
      setBookedArtistNamesById(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [hasMulti, mergedTimelineSlots, rawGig]);

  const setManualPaid = useCallback(
    async (gigId, paid) => {
      if (!canUpdate || !gigId) return;
      setBusyGigId(gigId);
      try {
        await updateGigDocument({
          gigId,
          action: 'gigs.update',
          updates: { venueMarkedArtistFeePaid: paid },
        });
        setGigInfo?.((prev) => {
          if (!prev) return prev;
          if (prev.gigId === gigId) return { ...prev, venueMarkedArtistFeePaid: paid };
          return prev;
        });
        refreshGigs?.();
        toast.success(paid ? 'Marked as paid.' : 'Marked as unpaid.');
      } catch (e) {
        console.error(e);
        toast.error('Could not update payment status.');
      } finally {
        setBusyGigId(null);
      }
    },
    [canUpdate, refreshGigs, setGigInfo]
  );
  const setCount = hasMulti ? slotSummaries.length : 1;
  const capTicketing = [
    capacityDisplay != null && String(capacityDisplay).trim()
      ? `Capacity ${capacityDisplay}`
      : null,
    ticketingTypeLabel && String(ticketingTypeLabel).trim() ? ticketingTypeLabel : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const programmeRows = hasMulti
    ? slotSummaries.map((s) => {
        const doc = resolveSlotDoc(mergedTimelineSlots, s.gigId) || {};
        const booked = gigSlotHasConfirmedArtist(doc);
        const name = booked ? getBookedArtistDisplayName(doc, bookedArtistNamesById) : '';
        const appsCount = booked ? null : countReviewableApplications(doc);
        return {
          key: s.gigId || `set-${s.slotIndex}`,
          setLabel: `Set ${s.slotIndex}`,
          timeRange: formatTimeRangeSpaced(s.timeRangeLabel),
          artistName: name,
          booked,
          appsCount,
        };
      })
    : [
        {
          key: rawGig?.gigId || 'single',
          setLabel: 'Set 1',
          timeRange: formatTimeRangeSpaced(normalisedGig?.timeRangeLabel || ''),
          artistName: getBookedArtistDisplayName(rawGig, bookedArtistNamesById),
          booked: gigSlotHasConfirmedArtist(rawGig),
          appsCount: gigSlotHasConfirmedArtist(rawGig) ? null : countReviewableApplications(rawGig),
        },
      ];

  const feeHeading = resolveArtistBookingFinancialsFeeHeading(paymentModelKey, setCount);

  let totalBudgetNum = 0;
  let committedNum = 0;
  const financialRows = [];

  if (showPerSetPayments && hasMulti) {
    slotSummaries.forEach((s) => {
      const doc = resolveSlotDoc(mergedTimelineSlots, s.gigId) || {};
      const booked = gigSlotHasConfirmedArtist(doc);
      const artist = getBookedArtistDisplayName(doc, bookedArtistNamesById);
      const budgetN = parsePoundsAmount(s.feeLabel);
      if (budgetN != null) totalBudgetNum += budgetN;
      const agreedStr = doc.agreedFee || s.feeLabel;
      const committedN = booked ? parsePoundsAmount(agreedStr) : null;
      if (committedN != null) committedNum += committedN;

      const left = booked && artist ? `Set ${s.slotIndex} · ${artist}` : `Set ${s.slotIndex}`;
      let rightClass = 'venue-gig-page-sidebar__gig-summary-v2__fin-value';
      let rightText;
      if (booked && committedN != null) {
        rightText = formatPoundsFromNumber(committedN);
        rightClass += ' venue-gig-page-sidebar__gig-summary-v2__fin-value--strong';
      } else if (budgetN != null) {
        rightText = `${formatPoundsFromNumber(budgetN)} budgeted`;
        rightClass += ' venue-gig-page-sidebar__gig-summary-v2__fin-value--muted';
      } else {
        rightText = formatPaymentAmountForSet(s.feeLabel);
      }
      financialRows.push({
        key: s.gigId || `fin-${s.slotIndex}`,
        left,
        rightText,
        rightClass,
        gigId: s.gigId,
        doc,
        feeLabel: s.feeLabel,
      });
    });
  } else if (showPerSetPayments && !hasMulti) {
    const doc = rawGig;
    const booked = gigSlotHasConfirmedArtist(doc);
    const artist = getBookedArtistDisplayName(doc, bookedArtistNamesById);
    const feeStr = doc.budget || doc.hireFee;
    const budgetN = parsePoundsAmount(feeStr);
    if (budgetN != null) totalBudgetNum += budgetN;
    const agreedStr = doc.agreedFee || feeStr;
    const committedN = booked ? parsePoundsAmount(agreedStr) : null;
    if (committedN != null) committedNum += committedN;
    const left = booked && artist ? `Set 1 · ${artist}` : 'Set 1';
    let rightClass = 'venue-gig-page-sidebar__gig-summary-v2__fin-value';
    let rightText;
    if (booked && committedN != null) {
      rightText = formatPoundsFromNumber(committedN);
      rightClass += ' venue-gig-page-sidebar__gig-summary-v2__fin-value--strong';
    } else if (budgetN != null) {
      rightText = `${formatPoundsFromNumber(budgetN)} budgeted`;
      rightClass += ' venue-gig-page-sidebar__gig-summary-v2__fin-value--muted';
    } else {
      rightText = formatHireFeeAmountForSummary(rawGig);
    }
    financialRows.push({
      key: 'fin-single',
      left,
      rightText,
      rightClass,
      gigId: doc?.gigId,
      doc,
      feeLabel: doc.budget || doc.hireFee,
    });
  }

  const showTotalRow =
    showPerSetPayments && financialRows.length > 0 && totalBudgetNum > 0 && paymentModelKey === 'venue_pays_artist';

  return (
    <div
      className="venue-gig-page-sidebar__surface-tile venue-gig-page-sidebar__surface-tile--booking-summary venue-gig-page-sidebar__gig-summary-v2"
      aria-label="Gig summary"
    >
      <section className="venue-gig-page-sidebar__gig-summary-v2__section">
        <h3 className="fill-this-slot__title fill-this-slot__title--invite-promoter venue-gig-page-sidebar__booking-summary-heading">
          Gig Summary
        </h3>
        {capTicketing ? <p className="venue-gig-page-sidebar__gig-summary-v2__meta">{capTicketing}</p> : null}
      </section>

      <section className="venue-gig-page-sidebar__gig-summary-v2__section venue-gig-page-sidebar__gig-summary-v2__section--ruled">
        <p className="venue-gig-page-sidebar__gig-summary-v2__kicker">Programme</p>
        <div className="venue-gig-page-sidebar__gig-summary-v2__programme">
          {programmeRows.map((row) => (
            <div key={row.key} className="venue-gig-page-sidebar__gig-summary-v2__programme-row">
              <span className="venue-gig-page-sidebar__gig-summary-v2__programme-set">{row.setLabel}</span>
              <span className="venue-gig-page-sidebar__gig-summary-v2__programme-time">{row.timeRange}</span>
              <span
                className={
                  row.booked
                    ? 'venue-gig-page-sidebar__gig-summary-v2__programme-artist'
                    : 'venue-gig-page-sidebar__gig-summary-v2__programme-open'
                }
                title={
                  row.booked && row.artistName?.trim()
                    ? row.artistName.trim()
                    : undefined
                }
              >
                {row.booked ? (row.artistName?.trim() ? row.artistName.trim() : '—') : 'Open'}
              </span>
              <span className="venue-gig-page-sidebar__gig-summary-v2__programme-badge-cell">
                {row.booked ? (
                  <span className="venue-gig-applications-set-tab__status-pill">Booked</span>
                ) : (
                  <span className="venue-gig-page-sidebar__gig-summary-v2__pill venue-gig-page-sidebar__gig-summary-v2__pill--apps">
                    {formatApplicationCountLabel(row.appsCount)}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="venue-gig-page-sidebar__gig-summary-v2__section venue-gig-page-sidebar__gig-summary-v2__section--ruled">
        <p className="venue-gig-page-sidebar__gig-summary-v2__kicker">Financials</p>
        <div className="venue-gig-page-sidebar__gig-summary-v2__fin-row">
          <span className="venue-gig-page-sidebar__gig-summary-v2__fin-label">Fee model</span>
          <span className="venue-gig-page-sidebar__gig-summary-v2__fin-value venue-gig-page-sidebar__gig-summary-v2__fin-value--strong">
            {feeHeading}
          </span>
        </div>
        {feeModelLabel &&
        paymentModelKey === 'venue_pays_artist' &&
        String(feeModelLabel).includes('•') ? (
          <p className="venue-gig-page-sidebar__gig-summary-v2__fin-note">{feeModelLabel}</p>
        ) : null}

        {financialRows.length > 0 ? (
          <>
            <div className="venue-gig-page-sidebar__gig-summary-v2__fin-divider" />
            {financialRows.map((fr) => (
              <div key={fr.key} className="venue-gig-page-sidebar__gig-summary-v2__fin-set-block">
                <div className="venue-gig-page-sidebar__gig-summary-v2__fin-row venue-gig-page-sidebar__gig-summary-v2__fin-row--set-fee">
                  <span className="venue-gig-page-sidebar__gig-summary-v2__fin-label">{fr.left}</span>
                  <div className="venue-gig-page-sidebar__gig-summary-v2__fin-set-fee-right">
                    <span className={fr.rightClass}>{fr.rightText}</span>
                    {perSetArtistFeePaidInteractive ? (
                      <MarkPaidForSetInline
                        gigId={fr.gigId}
                        doc={fr.doc}
                        feeLabel={fr.feeLabel}
                        canUpdate={canUpdate}
                        busyGigId={busyGigId}
                        setManualPaid={setManualPaid}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : null}

        {showTotalRow ? (
          <>
            <div className="venue-gig-page-sidebar__gig-summary-v2__fin-divider" />
            <div className="venue-gig-page-sidebar__gig-summary-v2__fin-row venue-gig-page-sidebar__gig-summary-v2__fin-row--total">
              <span className="venue-gig-page-sidebar__gig-summary-v2__fin-label">Total committed</span>
              <span className="venue-gig-page-sidebar__gig-summary-v2__fin-value venue-gig-page-sidebar__gig-summary-v2__fin-value--strong">
                {`${formatPoundsFromNumber(committedNum)} of ${formatPoundsFromNumber(totalBudgetNum)}`}
              </span>
            </div>
          </>
        ) : null}
      </section>

      <GigSummaryEditFooter onEditGig={onEditGig} onInviteArtist={onInviteArtist} />
    </div>
  );
}

function renderBookingSummaryTile({
  variant = 'venue_hire',
  normalisedGig = null,
  rawGig = null,
  feeModelLabel,
  capacityDisplay,
  ticketingTypeLabel,
  onEditGig,
  onInviteArtist,
  slotSummaries = null,
  showPerSetPayments = false,
  perSetArtistFeePaidInteractive = false,
  mergedTimelineSlots = null,
  refreshGigs = null,
  setGigInfo = null,
  canUpdate = false,
  paymentModelKey = 'no_fee',
}) {
  if (variant === 'artist_booking') {
    return (
      <ArtistBookingGigSummaryV2
        normalisedGig={normalisedGig}
        rawGig={rawGig}
        feeModelLabel={feeModelLabel}
        capacityDisplay={capacityDisplay}
        ticketingTypeLabel={ticketingTypeLabel}
        paymentModelKey={paymentModelKey}
        slotSummaries={slotSummaries}
        showPerSetPayments={showPerSetPayments}
        perSetArtistFeePaidInteractive={perSetArtistFeePaidInteractive}
        mergedTimelineSlots={mergedTimelineSlots}
        refreshGigs={refreshGigs}
        setGigInfo={setGigInfo}
        canUpdate={canUpdate}
        onEditGig={onEditGig}
        onInviteArtist={onInviteArtist}
      />
    );
  }

  return renderVenueHireGigSummaryV2({
    rawGig,
    feeModelLabel,
    capacityDisplay,
    ticketingTypeLabel,
    onEditGig,
    onInviteArtist,
  });
}

function renderTimelineTile(timingDisplayRows) {
  return (
    <div className="venue-gig-page-sidebar__surface-tile venue-gig-page-sidebar__surface-tile--timeline">
      <h3 className="fill-this-slot__title fill-this-slot__title--invite-promoter venue-gig-page-sidebar__timeline-tile-heading">Timeline</h3>
      <div className="venue-gig-page-sidebar__timeline-wrap">
        <ul className="venue-gig-page-sidebar__timeline-list">
          {timingDisplayRows.map(({ key, label, displayTime }, index) => (
            <li key={key} className="venue-gig-page-sidebar__timeline-item">
              <div className="venue-gig-page-sidebar__timeline-axis" aria-hidden>
                <span className="venue-gig-page-sidebar__timeline-dot" />
                {index < timingDisplayRows.length - 1 ? (
                  <span className="venue-gig-page-sidebar__timeline-connector" />
                ) : null}
              </div>
              <div className="venue-gig-page-sidebar__timeline-body">
                <div className="venue-gig-page-sidebar__timeline-time">{displayTime}</div>
                <div className="venue-gig-page-sidebar__timeline-label">{label}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function renderTargetSalesPreviewMarkup(capacity) {
  const cap = capacity != null && capacity !== '' ? Number(String(capacity).replace(/[^\d.]/g, '')) : NaN;
  const capText = Number.isFinite(cap) && cap > 0 ? String(cap) : '—';
  return (
    <div className="venue-gig-page-sidebar__surface-tile venue-gig-page-sidebar__surface-tile--target-sales">
      <div className="venue-gig-page-sidebar__target-sales-heading">
        <h3 className="venue-gig-page-sidebar__surface-tile-title">Ticket sales</h3>
        <span className="venue-gig-page-sidebar__coming-soon-pill">Coming soon</span>
      </div>
      <p className="venue-gig-page-sidebar__target-sales-copy">
        Preview how progress toward ticket sales will look once this is live.
      </p>
      <div className="venue-gig-page-sidebar__target-sales-stats">
        <span>0 / {capText}</span>
        <span>0%</span>
      </div>
      <div className="venue-gig-page-sidebar__target-sales-bar" aria-hidden>
        <div className="venue-gig-page-sidebar__target-sales-bar-fill" style={{ width: '0%' }} />
      </div>
    </div>
  );
}

/**
 * Sidebar: For venue hire / artist booking, booking summary, timeline, ticket sales preview.
 * For other gig types: "Key details" summary.
 */
export function BookingSummarySidebar({
  normalisedGig,
  rawGig,
  venues,
  onEdit,
  /** Venue hire: Applications ↔ Gig details column swap (gig page layout). */
  venueHireSwapApplicationsAndGigDetails = false,
  onVenueHireApplicationsPortalMount,
  venueHireGigDetailsPortalContainer,
  /** Same visibility as header Edit gig; rendered under booking summary rows. */
  bookingSummaryOnEditGig,
  /** All slot docs (primary + related), sorted by start — merged timeline for multi-set artist bookings. */
  mergedTimelineSlots = null,
  setGigInfo = null,
  refreshGigs = null,
}) {
  const isVenueHire = normalisedGig?.bookingMode === 'venue_hire';
  const isArtistBooking = normalisedGig?.bookingMode === 'artist_booking';

  const canUpdate = rawGig?.venueId && hasVenuePerm(venues, rawGig.venueId, 'gigs.update');

  if (!normalisedGig) return null;

  const {
    fee,
    depositAmount,
    depositStatus,
    capacity,
    accessFrom,
    curfew,
  } = normalisedGig;

  const hasDeposit = depositAmount != null && depositAmount !== '' || depositStatus;
  const hasMoney = (fee != null && fee !== '') || hasDeposit;
  const hasAccessOrCurfew = accessFrom || curfew;

  // Venue hire (confirmed or unconfirmed): same right column – booking summary, timeline, ticket sales.
  if (isVenueHire) {
    const paymentModelKey = inferVenueHirePaymentModelKey(rawGig);
    const paymentModelLabel = resolveFeeModelDisplayLabel(paymentModelKey, rawGig);
    const ticketingLabel = resolveTicketingLabel(rawGig);
    const timingDisplayRows = buildVenueHireGigDetailsTimingDisplayRows(rawGig, accessFrom, curfew);

    const capacitySummary =
      capacity != null && capacity !== '' ? String(capacity) : '—';

    const showTicketSalesTile = ticketingLabel !== 'Not ticketed';

    const venueHireSidebarTiles = (
      <>
        {renderBookingSummaryTile({
          variant: 'venue_hire',
          normalisedGig,
          rawGig,
          feeModelLabel: paymentModelLabel,
          capacityDisplay: capacitySummary,
          ticketingTypeLabel: ticketingLabel,
          onEditGig: bookingSummaryOnEditGig,
        })}
        {renderTimelineTile(timingDisplayRows)}

        {showTicketSalesTile ? renderTargetSalesPreviewMarkup(capacity) : null}
      </>
    );

    return (
      <aside className="venue-gig-page-sidebar" aria-label="Gig summary">
        <div className="venue-gig-page-sidebar__cards">
          {venueHireSwapApplicationsAndGigDetails ? (
            <div
              ref={(el) => onVenueHireApplicationsPortalMount?.(el)}
              className="venue-hire-applications-portal-mount"
            />
          ) : null}
          {(!venueHireSwapApplicationsAndGigDetails || !venueHireGigDetailsPortalContainer) ? venueHireSidebarTiles : null}
          {venueHireSwapApplicationsAndGigDetails && venueHireGigDetailsPortalContainer
            ? createPortal(venueHireSidebarTiles, venueHireGigDetailsPortalContainer)
            : null}
        </div>
      </aside>
    );
  }

  // Artist booking: booking summary, timeline, ticket sales. Tech setup lives in the main panel.
  if (isArtistBooking) {
    const paymentModelKey = inferArtistBookingPaymentModelKey(rawGig);
    const slotSummaries = normalisedGig?.perSlotSummaries;
    const hasMultiSlot = Array.isArray(slotSummaries) && slotSummaries.length > 1;
    const paymentModelLabel =
      hasMultiSlot && paymentModelKey === 'venue_pays_artist'
        ? "I'll pay the artists"
        : resolveFeeModelDisplayLabel(paymentModelKey, rawGig);
    const ticketingLabel = resolveTicketingLabel(rawGig);
    const slotsForTimeline =
      Array.isArray(mergedTimelineSlots) && mergedTimelineSlots.length > 1
        ? mergedTimelineSlots
        : null;
    const timingDisplayRows =
      slotsForTimeline && slotsForTimeline.length > 1
        ? buildArtistBookingMergedTimingDisplayRows(rawGig, slotsForTimeline, accessFrom, curfew)
        : buildVenueHireGigDetailsTimingDisplayRows(rawGig, accessFrom, curfew);
    const capacitySummary =
      capacity != null && capacity !== '' ? String(capacity) : '—';

    const showTicketSalesTile = ticketingLabel !== 'Not ticketed';
    const showPerSetPayments = paymentModelKey === 'venue_pays_artist';

    return (
      <aside className="venue-gig-page-sidebar" aria-label="Gig summary">
        <div className="venue-gig-page-sidebar__cards">
          {renderBookingSummaryTile({
            variant: 'artist_booking',
            normalisedGig,
            rawGig,
            paymentModelKey,
            feeModelLabel: paymentModelLabel,
            capacityDisplay: capacitySummary,
            ticketingTypeLabel: ticketingLabel,
            onEditGig: bookingSummaryOnEditGig,
            slotSummaries: hasMultiSlot ? slotSummaries : null,
            showPerSetPayments,
            perSetArtistFeePaidInteractive:
              showPerSetPayments && normalisedGig?.status === 'confirmed' && canUpdate,
            mergedTimelineSlots,
            refreshGigs,
            setGigInfo,
            canUpdate,
          })}
          {renderTimelineTile(timingDisplayRows)}

          {showTicketSalesTile ? renderTargetSalesPreviewMarkup(capacity) : null}
        </div>
      </aside>
    );
  }

  // Default: "Key details" (other gig types)
  return (
    <aside className="venue-gig-page-sidebar" aria-label="Key details">
      <div className="venue-gig-page-sidebar__card">
        {(onEdit && canUpdate) ? (
          <div className="venue-gig-page-sidebar__card-header venue-gig-page-sidebar__card-header--with-title">
            <h3 className="venue-gig-page-sidebar__title">Key details</h3>
            <button type="button" className="btn tertiary venue-gig-page-sidebar__edit-btn" onClick={onEdit}>
              Edit
            </button>
          </div>
        ) : (
          <h3 className="venue-gig-page-sidebar__title">Key details</h3>
        )}

        <dl className="venue-gig-page-sidebar__list">

          {hasMoney && (
            <>
              {fee != null && fee !== '' && (
                <div className="venue-gig-page-sidebar__row">
                  <dt>Hire fee</dt>
                  <dd>{fee}</dd>
                </div>
              )}
              {hasDeposit && (
                <div className="venue-gig-page-sidebar__row">
                  <dt>Deposit</dt>
                  <dd>
                    {depositAmount != null && depositAmount !== '' ? String(depositAmount) : ''}
                    {depositStatus ? (depositAmount ? ` · ${depositStatus}` : depositStatus) : ''}
                  </dd>
                </div>
              )}
            </>
          )}

          <div className="venue-gig-page-sidebar__row">
            <dt>Capacity</dt>
            <dd>{capacity != null && capacity !== '' ? capacity : '—'}</dd>
          </div>

          {hasAccessOrCurfew && (
            <>
              {accessFrom && (
                <div className="venue-gig-page-sidebar__row">
                  <dt>Access from</dt>
                  <dd>{accessFrom}</dd>
                </div>
              )}
              {curfew && (
                <div className="venue-gig-page-sidebar__row">
                  <dt>Curfew</dt>
                  <dd>{curfew}</dd>
                </div>
              )}
            </>
          )}
        </dl>

        <div className="venue-gig-page-sidebar__actions" />
      </div>
    </aside>
  );
}
