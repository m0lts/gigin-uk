import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { useAuth } from '@hooks/useAuth';
import { hasVenuePerm } from '@services/utils/permissions';
import { updateGigDocument } from '@services/api/gigs';
import { updateVenueHireOpportunity } from '@services/client-side/venueHireOpportunities';
import { getConversationsByParticipantAndGigId } from '@services/client-side/conversations';
import { getArtistProfileById, getMusicianProfileByMusicianId } from '@services/client-side/artists';
import { AddressBookIcon, CoinsIcon, EditIcon, InviteIcon, InviteIconSolid, MicrophoneIcon, TickIcon, TicketIcon } from '@features/shared/ui/extras/Icons';
import { QrCodeIcon } from '../../home/icons';
import { useShareLink } from '../../home/shareLinkContext';
import { acceptingApplicationsPatch } from '../../home/nights';
import { getLocalGigDateTime } from '@services/utils/filtering';
import { gigSlotHasConfirmedArtist } from '../utils/multiSlotGigGroup';
import {
  buildVenueHireGigDetailsTimingDisplayRows,
  buildVenueHireGigSummaryProgrammeTimeLabel,
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
  if (v === 'artist') return 'They handle ticketing';
  if (v === 'free_entry') return 'Not ticketed';
  if (kind === 'Ticketed Gig') return 'They handle ticketing';
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
    return setCount > 1 ? 'We pay artists' : 'We pay artist';
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
  normalisedGig,
  accessFrom,
  curfew,
  feeModelLabel,
  capacityDisplay,
  ticketingTypeLabel,
  venueHireApplicationsCount = null,
  venueHireApplicationsLoading = false,
  refreshGigs,
  setGigInfo,
  canUpdate = false,
  onEditGig,
  onInviteArtist,
}) {
  const [busyGigId, setBusyGigId] = useState(null);
  const capacitySummary =
    capacityDisplay != null && String(capacityDisplay).trim() ? String(capacityDisplay).trim() : null;
  const ticketingSummary =
    ticketingTypeLabel && String(ticketingTypeLabel).trim() ? String(ticketingTypeLabel).trim() : null;
  const hireFee = formatHireFeeAmountForSummary(rawGig);
  const isConfirmedVenueHire =
    normalisedGig?.status === 'confirmed' ||
    rawGig?.status === 'confirmed' ||
    !!String(rawGig?.hirerName || rawGig?.renterName || '').trim();
  const showHireFeePaidActions = isConfirmedVenueHire && hireFee !== '—';
  const setVenueHireManualPaid = useCallback(
    async (gigId, paid) => {
      if (!canUpdate || !gigId) return;
      setBusyGigId(gigId);
      try {
        await updateVenueHireOpportunity(gigId, { venueMarkedArtistFeePaid: paid });
        setGigInfo?.((prev) => (prev ? { ...prev, venueMarkedArtistFeePaid: paid } : prev));
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
  const programmeTime = buildVenueHireGigSummaryProgrammeTimeLabel(
    rawGig,
    normalisedGig,
    accessFrom,
    curfew
  );

  return (
    <div
      className="venue-gig-page-sidebar__surface-tile venue-gig-page-sidebar__surface-tile--booking-summary venue-gig-page-sidebar__gig-summary-v2"
      aria-label="Gig summary"
    >
      <section className="venue-gig-page-sidebar__gig-summary-v2__section">
        <h3 className="fill-this-slot__title fill-this-slot__title--invite-promoter venue-gig-page-sidebar__booking-summary-heading">
          Gig Summary
        </h3>
      </section>

      <section className="venue-gig-page-sidebar__gig-summary-v2__section venue-gig-page-sidebar__gig-summary-v2__section--ruled">
        <p className="venue-gig-page-sidebar__gig-summary-v2__kicker"><MicrophoneIcon /> Programme</p>
        <div className="venue-gig-page-sidebar__gig-summary-v2__programme">
          {(() => {
            const hirerName =
              (rawGig?.hirerName && String(rawGig.hirerName).trim()) ||
              (rawGig?.renterName && String(rawGig.renterName).trim()) ||
              null;
            const isConfirmed =
              normalisedGig?.status === 'confirmed' ||
              rawGig?.status === 'confirmed' ||
              !!hirerName;
            return (
              <div className="venue-gig-page-sidebar__gig-summary-v2__programme-row venue-gig-page-sidebar__gig-summary-v2__programme-row--no-set">
                <span className="venue-gig-page-sidebar__gig-summary-v2__programme-time">{programmeTime}</span>
                <span
                  className={
                    isConfirmed
                      ? 'venue-gig-page-sidebar__gig-summary-v2__programme-artist'
                      : 'venue-gig-page-sidebar__gig-summary-v2__programme-open'
                  }
                >
                  {isConfirmed
                    ? (hirerName || '—')
                    : (venueHireApplicationsLoading || venueHireApplicationsCount === null
                        ? '…'
                        : formatApplicationCountLabel(venueHireApplicationsCount))}
                </span>
                <span className="venue-gig-page-sidebar__gig-summary-v2__programme-badge-cell">
                  {isConfirmed ? (
                    <span className="venue-gig-applications-set-tab__status-pill">Booked</span>
                  ) : (
                    <span className="venue-gig-page-sidebar__gig-summary-v2__pill venue-gig-page-sidebar__gig-summary-v2__pill--unbooked">
                      Unbooked
                    </span>
                  )}
                </span>
              </div>
            );
          })()}
        </div>
      </section>

      <section className="venue-gig-page-sidebar__gig-summary-v2__section venue-gig-page-sidebar__gig-summary-v2__section--ruled">
        <p className="venue-gig-page-sidebar__gig-summary-v2__kicker"><TicketIcon /> Ticketing</p>
        <div className="venue-gig-page-sidebar__gig-summary-v2__ticketing-rows">
          <div className="venue-gig-page-sidebar__gig-summary-v2__fin-row">
            <span className="venue-gig-page-sidebar__gig-summary-v2__fin-label">Capacity</span>
            <span className="venue-gig-page-sidebar__gig-summary-v2__fin-value">{capacitySummary ?? '—'}</span>
          </div>
          <div className="venue-gig-page-sidebar__gig-summary-v2__fin-row">
            <span className="venue-gig-page-sidebar__gig-summary-v2__fin-label">Handled by</span>
            <span className="venue-gig-page-sidebar__gig-summary-v2__fin-value">{ticketingSummary ?? '—'}</span>
          </div>
        </div>
      </section>

      <section className="venue-gig-page-sidebar__gig-summary-v2__section venue-gig-page-sidebar__gig-summary-v2__section--ruled">
        <p className="venue-gig-page-sidebar__gig-summary-v2__kicker"><CoinsIcon /> Financials</p>
        <div className="venue-gig-page-sidebar__gig-summary-v2__fin-row">
          <span className="venue-gig-page-sidebar__gig-summary-v2__fin-label">Fee model</span>
          <span className="venue-gig-page-sidebar__gig-summary-v2__fin-value">
            {feeModelLabel && String(feeModelLabel).trim() ? feeModelLabel : '—'}
          </span>
        </div>
        {hireFee !== '—' ? (
          <>
            <div className="venue-gig-page-sidebar__gig-summary-v2__fin-divider" />
            <div className="venue-gig-page-sidebar__gig-summary-v2__fin-row venue-gig-page-sidebar__gig-summary-v2__fin-row--set-fee">
              <span className="venue-gig-page-sidebar__gig-summary-v2__fin-label">Hire fee</span>
              <div className="venue-gig-page-sidebar__gig-summary-v2__fin-set-fee-right">
                <span className="venue-gig-page-sidebar__gig-summary-v2__fin-value venue-gig-page-sidebar__gig-summary-v2__fin-value--strong">
                  {hireFee}
                </span>
                {showHireFeePaidActions ? (
                  <MarkPaidForSetInline
                    gigId={rawGig?.id || rawGig?.gigId}
                    doc={rawGig}
                    feeLabel={hireFee}
                    canUpdate={canUpdate}
                    busyGigId={busyGigId}
                    setManualPaid={setVenueHireManualPaid}
                  />
                ) : null}
              </div>
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
  const capacitySummary =
    capacityDisplay != null && String(capacityDisplay).trim() ? String(capacityDisplay).trim() : null;
  const ticketingSummary =
    ticketingTypeLabel && String(ticketingTypeLabel).trim() ? String(ticketingTypeLabel).trim() : null;

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
          setLabel: '',
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
    const feeStr = doc.budget || doc.hireFee;
    const budgetN = parsePoundsAmount(feeStr);
    if (budgetN != null) totalBudgetNum += budgetN;
    const agreedStr = doc.agreedFee || feeStr;
    const committedN = booked ? parsePoundsAmount(agreedStr) : null;
    if (committedN != null) committedNum += committedN;
    // Single slot: no "Set 1" label; budget amount is always strong (black)
    let rightClass = 'venue-gig-page-sidebar__gig-summary-v2__fin-value venue-gig-page-sidebar__gig-summary-v2__fin-value--strong';
    let rightText;
    if (booked && committedN != null) {
      rightText = formatPoundsFromNumber(committedN);
    } else if (budgetN != null) {
      rightText = `${formatPoundsFromNumber(budgetN)} budgeted`;
    } else {
      rightText = formatHireFeeAmountForSummary(rawGig);
    }
    financialRows.push({
      key: 'fin-single',
      left: '',
      rightText,
      rightClass,
      gigId: doc?.gigId,
      doc,
      feeLabel: doc.budget || doc.hireFee,
    });
  }


  return (
    <div
      className="venue-gig-page-sidebar__surface-tile venue-gig-page-sidebar__surface-tile--booking-summary venue-gig-page-sidebar__gig-summary-v2"
      aria-label="Gig summary"
    >
      <section className="venue-gig-page-sidebar__gig-summary-v2__section">
        <h3 className="fill-this-slot__title fill-this-slot__title--invite-promoter venue-gig-page-sidebar__booking-summary-heading">
          Gig Summary
        </h3>
      </section>

      <section className="venue-gig-page-sidebar__gig-summary-v2__section venue-gig-page-sidebar__gig-summary-v2__section--ruled">
        <p className="venue-gig-page-sidebar__gig-summary-v2__kicker"><MicrophoneIcon /> Programme</p>
        <div className="venue-gig-page-sidebar__gig-summary-v2__programme">
          {programmeRows.map((row) => (
            <div
              key={row.key}
              className={
                row.setLabel
                  ? 'venue-gig-page-sidebar__gig-summary-v2__programme-row'
                  : 'venue-gig-page-sidebar__gig-summary-v2__programme-row venue-gig-page-sidebar__gig-summary-v2__programme-row--no-set'
              }
            >
              {row.setLabel ? (
                <span className="venue-gig-page-sidebar__gig-summary-v2__programme-set">{row.setLabel}</span>
              ) : null}
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
                {row.booked
                  ? (row.artistName?.trim() ? row.artistName.trim() : '—')
                  : formatApplicationCountLabel(row.appsCount)}
              </span>
              <span className="venue-gig-page-sidebar__gig-summary-v2__programme-badge-cell">
                {row.booked ? (
                  <span className="venue-gig-applications-set-tab__status-pill">Booked</span>
                ) : (
                  <span className="venue-gig-page-sidebar__gig-summary-v2__pill venue-gig-page-sidebar__gig-summary-v2__pill--unbooked">
                    Unbooked
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="venue-gig-page-sidebar__gig-summary-v2__section venue-gig-page-sidebar__gig-summary-v2__section--ruled">
        <p className="venue-gig-page-sidebar__gig-summary-v2__kicker"><TicketIcon /> Ticketing</p>
        <div className="venue-gig-page-sidebar__gig-summary-v2__ticketing-rows">
          <div className="venue-gig-page-sidebar__gig-summary-v2__fin-row">
            <span className="venue-gig-page-sidebar__gig-summary-v2__fin-label">Capacity</span>
            <span className="venue-gig-page-sidebar__gig-summary-v2__fin-value">{capacitySummary ?? '—'}</span>
          </div>
          <div className="venue-gig-page-sidebar__gig-summary-v2__fin-row">
            <span className="venue-gig-page-sidebar__gig-summary-v2__fin-label">Handled by</span>
            <span className="venue-gig-page-sidebar__gig-summary-v2__fin-value">{ticketingSummary ?? '—'}</span>
          </div>
        </div>
      </section>

      <section className="venue-gig-page-sidebar__gig-summary-v2__section venue-gig-page-sidebar__gig-summary-v2__section--ruled">
        <p className="venue-gig-page-sidebar__gig-summary-v2__kicker"><CoinsIcon /> Financials</p>
        <div className="venue-gig-page-sidebar__gig-summary-v2__fin-row">
          <span className="venue-gig-page-sidebar__gig-summary-v2__fin-label">Fee model</span>
          <span className="venue-gig-page-sidebar__gig-summary-v2__fin-value venue-gig-page-sidebar__gig-summary-v2__fin-value--strong">
            {feeHeading}
          </span>
        </div>

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
  venueHireApplicationsCount = null,
  venueHireApplicationsLoading = false,
}) {
  if (variant === 'artist_booking') {
    return (
      <ArtistBookingGigSummaryV2
        normalisedGig={normalisedGig}
        rawGig={rawGig}
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
    normalisedGig,
    accessFrom: normalisedGig != null ? normalisedGig.accessFrom : null,
    curfew: normalisedGig != null ? normalisedGig.curfew : null,
    feeModelLabel,
    capacityDisplay,
    ticketingTypeLabel,
    venueHireApplicationsCount,
    venueHireApplicationsLoading,
    refreshGigs,
    setGigInfo,
    canUpdate,
    onEditGig,
    onInviteArtist,
  });
}

function renderTimelineTile(
  timingDisplayRows,
  {
    canUpdate = false,
    editingTimingKey = null,
    editingTimingValue = '',
    timelineSaving = false,
    onStartAddTime = null,
    onChangeAddTime = null,
    onCancelAddTime = null,
    onSaveAddTime = null,
  } = {}
) {
  return (
    <div className="venue-gig-page-sidebar__surface-tile venue-gig-page-sidebar__surface-tile--timeline">
      <h3 className="fill-this-slot__title fill-this-slot__title--invite-promoter venue-gig-page-sidebar__timeline-tile-heading">Timeline</h3>
      <div className="venue-gig-page-sidebar__timeline-wrap">
        <ul className="venue-gig-page-sidebar__timeline-list">
          {timingDisplayRows.map(({ key, label, displayTime }, index) => {
            const isMissing = displayTime === '—' || displayTime === 'TBC';
            const displayTimeLabel = isMissing ? 'TBC' : displayTime;
            const isEditing = editingTimingKey === key;
            return (
            <li key={key} className="venue-gig-page-sidebar__timeline-item">
              <div className="venue-gig-page-sidebar__timeline-axis" aria-hidden>
                <span className="venue-gig-page-sidebar__timeline-dot" />
                {index < timingDisplayRows.length - 1 ? (
                  <span className="venue-gig-page-sidebar__timeline-connector" />
                ) : null}
              </div>
              <div className="venue-gig-page-sidebar__timeline-body">
                {isEditing ? (
                  <div className="venue-gig-page-sidebar__timeline-inline-editor">
                    <input
                      type="time"
                      className="venue-gig-page-sidebar__timeline-time-input"
                      value={editingTimingValue}
                      onChange={(e) => onChangeAddTime?.(e.target.value)}
                      disabled={timelineSaving}
                    />
                    <div className="venue-gig-page-sidebar__timeline-inline-actions">
                      <button
                        type="button"
                        className="btn tertiary venue-gig-page-sidebar__timeline-inline-btn"
                        onClick={() => onCancelAddTime?.()}
                        disabled={timelineSaving}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn tertiary venue-gig-page-sidebar__timeline-inline-btn"
                        onClick={() => onSaveAddTime?.(key)}
                        disabled={timelineSaving || !editingTimingValue}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="venue-gig-page-sidebar__timeline-time">
                    {displayTimeLabel}
                    {canUpdate && isMissing && typeof onStartAddTime === 'function' ? (
                      <button
                        type="button"
                        className="btn tertiary venue-gig-page-sidebar__timeline-add-time-btn"
                        onClick={() => onStartAddTime(key)}
                      >
                        Add time
                      </button>
                    ) : null}
                  </div>
                )}
                <div className="venue-gig-page-sidebar__timeline-label">{label}</div>
              </div>
            </li>
            );
          })}
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

function listingDocumentsForGig(rawGig) {
  if (Array.isArray(rawGig?.listingDocuments) && rawGig.listingDocuments.length > 0) {
    return rawGig.listingDocuments;
  }
  if (Array.isArray(rawGig?.documents) && rawGig.documents.length > 0) {
    return rawGig.documents.map((doc, index) => ({
      key: doc.url || `doc-${index}`,
      title: doc.name || 'Document',
      sourceUrl: doc.url,
      signed: doc.signed,
    }));
  }
  return [];
}

function slotCountsAsBooked(slot) {
  return (slot?.applicants || []).some((applicant) => applicant?.status === 'confirmed' || applicant?.status === 'paid');
}

function ArtistBookingConsoleRail({
  rawGig,
  slots,
  canUpdate,
  setGigInfo,
  refreshGigs,
  gigLinkUrl,
  onInviteFromContacts,
}) {
  const [linkCopied, setLinkCopied] = useState(false);
  const [notesEditing, setNotesEditing] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [toggleSaving, setToggleSaving] = useState(false);
  const { openShare } = useShareLink();
  const nightSlots = Array.isArray(slots) && slots.length ? slots : (rawGig ? [rawGig] : []);
  const bookedCount = nightSlots.filter(slotCountsAsBooked).length;
  const gigDate = rawGig ? getLocalGigDateTime(rawGig) : null;
  const isPast = Boolean(gigDate && gigDate < new Date());
  const isCancelled = rawGig?.status === 'cancelled';
  const fullyBooked = nightSlots.length > 0 && bookedCount === nightSlots.length;
  const showFill = !fullyBooked && !isPast && !isCancelled;
  const accepting = nightSlots.some((slot) => slot?.applicationsOpen !== false);
  const notes = String(rawGig?.internalNotes ?? rawGig?.notesInternal ?? rawGig?.notes ?? '');
  const documents = listingDocumentsForGig(rawGig);
  const daysUntil = gigDate ? Math.ceil((gigDate.getTime() - Date.now()) / 86400000) : null;
  const daysLabel = daysUntil == null
    ? ''
    : daysUntil > 1
      ? `${daysUntil} days to go`
      : daysUntil === 1
        ? '1 day to go'
        : daysUntil === 0
          ? 'Today'
          : 'Played';
  const unsignedDocs = documents.filter((doc) => doc.signed === false);
  const thingsLeft = unsignedDocs.length;
  const subline = [daysLabel, thingsLeft > 0 ? `${thingsLeft} thing${thingsLeft === 1 ? '' : 's'} left to do` : 'All done']
    .filter(Boolean)
    .join(' · ');

  const copyLink = async () => {
    const link = gigLinkUrl || (rawGig?.gigId ? `${window.location.origin}/gig/${rawGig.gigId}` : '');
    if (!link) return;
    const done = () => {
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1400);
    };
    try {
      await navigator.clipboard.writeText(link);
      done();
      return;
    } catch {
      const input = document.createElement('textarea');
      input.value = link;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      document.body.appendChild(input);
      input.select();
      const ok = document.execCommand('copy');
      input.remove();
      if (ok) done();
    }
  };

  const updateSlots = async (updates, successMessage, action = 'gigs.update') => {
    const ids = nightSlots.map((slot) => slot?.gigId).filter(Boolean);
    if (!ids.length) return;
    setToggleSaving(true);
    try {
      await Promise.all(ids.map((gigId) => updateGigDocument({
        gigId,
        action,
        updates,
      })));
      setGigInfo?.((prev) => (prev ? { ...prev, ...updates } : prev));
      refreshGigs?.();
      if (successMessage) toast.success(successMessage);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update.');
    } finally {
      setToggleSaving(false);
    }
  };

  const saveNotes = async () => {
    if (!canUpdate || !rawGig?.gigId) return;
    setNotesSaving(true);
    try {
      const value = notesDraft.trim();
      const now = new Date().toISOString();
      await updateGigDocument({
        gigId: rawGig.gigId,
        action: 'gigs.update',
        updates: { internalNotes: value || null, internalNotesLastEdited: now },
      });
      setGigInfo?.((prev) => (prev ? { ...prev, internalNotes: value || null, internalNotesLastEdited: now } : prev));
      refreshGigs?.();
      setNotesEditing(false);
      toast.success('Notes saved.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save notes.');
    } finally {
      setNotesSaving(false);
    }
  };

  return (
    <>
      {showFill ? (
        <section className="venue-gig-rail__card">
          <div className="venue-gig-rail__title-row">
            <h3 className="venue-gig-rail__title">Fill the night</h3>
            <span className="venue-gig-rail__count">{bookedCount} of {nightSlots.length} sets booked</span>
          </div>
          <div className="venue-gig-rail__bars" aria-hidden="true">
            {nightSlots.map((slot, index) => (
              <span
                key={slot?.gigId || index}
                className={`venue-gig-rail__bar${slotCountsAsBooked(slot) ? ' is-booked' : ''}`}
              />
            ))}
          </div>
          <div className="venue-gig-rail__share">
            <span className="venue-gig-rail__label-row">
              <span className="venue-gig-rail__label">Offer the gig to artist</span>
              {!accepting && (
                <span className="venue-gig-rail__closed">
                  <i />
                  Applications closed
                </span>
              )}
            </span>
            <div className="venue-gig-rail__link">
              <span className="venue-gig-rail__url">{gigLinkUrl || (rawGig?.gigId ? `${window.location.origin}/gig/${rawGig.gigId}` : '')}</span>
              <button type="button" className="venue-gig-rail__copy" onClick={copyLink}>
                {linkCopied ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                className="venue-gig-rail__share-btn"
                onClick={() => openShare({ slots: nightSlots, venueName: rawGig?.venueName || '' })}
              >
                <QrCodeIcon />
                Share
              </button>
            </div>
            {typeof onInviteFromContacts === 'function' ? (
              <button type="button" className="venue-gig-rail__primary" onClick={onInviteFromContacts}>
                <AddressBookIcon />
                Offer gig to a saved Contact
              </button>
            ) : null}
          </div>
          {canUpdate ? (
            <div className="venue-gig-rail__toggles">
              <button
                type="button"
                className="venue-gig-rail__toggle"
                disabled={toggleSaving}
                onClick={() => updateSlots(
                  { private: !rawGig?.private },
                  rawGig?.private ? 'Listing visible on your venue profile.' : 'Listing hidden from your venue profile.'
                )}
              >
                <span>
                  <span className="venue-gig-rail__toggle-label">Show on venue profile</span>
                  <span className="venue-gig-rail__toggle-sub">Anyone can find and apply</span>
                </span>
                <span className={`venue-gig-rail__switch${!rawGig?.private ? ' is-on' : ''}`} aria-hidden="true">
                  <span className="venue-gig-rail__knob" />
                </span>
              </button>
              <button
                type="button"
                className="venue-gig-rail__toggle"
                disabled={toggleSaving}
                onClick={() => updateSlots(
                  acceptingApplicationsPatch(accepting),
                  accepting ? 'Applications closed.' : 'Applications open.',
                  'gigs.applications.manage'
                )}
              >
                <span>
                  <span className="venue-gig-rail__toggle-label">Accepting applications</span>
                  <span className="venue-gig-rail__toggle-sub">Turn off to close the listing</span>
                </span>
                <span className={`venue-gig-rail__switch${accepting ? ' is-on' : ''}`} aria-hidden="true">
                  <span className="venue-gig-rail__knob" />
                </span>
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {fullyBooked ? (
        <section className="venue-gig-rail__card">
          <div className="venue-gig-rail__booked-head">
            <span className="venue-gig-rail__check" aria-hidden="true"><TickIcon /></span>
            <span>
              <span className="venue-gig-rail__title">Fully booked</span>
              <span className="venue-gig-rail__sub">{subline}</span>
            </span>
          </div>
          <ul className="venue-gig-rail__checks">
            <li>
              <span><span className="venue-gig-rail__mark is-ok">✓</span>Payments</span>
              <span className="venue-gig-rail__check-val">{bookedCount}/{nightSlots.length} paid</span>
            </li>
            {documents.some((doc) => doc.signed === true || doc.signed === false) ? (
              <li>
                <span>
                  <span className={`venue-gig-rail__mark${unsignedDocs.length ? ' is-wait' : ' is-ok'}`}>{unsignedDocs.length ? '!' : '✓'}</span>
                  Agreements
                </span>
                <span className="venue-gig-rail__check-val">
                  {documents.filter((doc) => doc.signed === true).length}/{documents.filter((doc) => doc.signed === true || doc.signed === false).length} signed
                </span>
              </li>
            ) : null}
          </ul>
          {!isPast && unsignedDocs[0]?.sourceUrl ? (
            <a className="venue-gig-rail__primary venue-gig-rail__primary-link" href={unsignedDocs[0].sourceUrl} target="_blank" rel="noopener noreferrer">
              Review unsigned agreement
            </a>
          ) : null}
        </section>
      ) : null}

      <section className="venue-gig-rail__card">
        <h3 className="venue-gig-rail__title">Documents</h3>
        {documents.length === 0 ? (
          <p className="venue-gig-rail__muted">No documents attached to this listing.</p>
        ) : (
          <ul className="venue-gig-rail__docs">
            {documents.map((doc, index) => {
              const row = (
                <>
                  <span className="venue-gig-rail__doc-title">{doc.title || 'Document'}</span>
                  {doc.signed === true ? <span className="venue-gig-rail__tag is-signed">Signed</span> : null}
                  {doc.signed === false ? <span className="venue-gig-rail__tag is-unsigned">Unsigned</span> : null}
                </>
              );
              return (
                <li key={doc.key || `doc-${index}`}>
                  {doc.sourceUrl ? (
                    <a className="venue-gig-rail__doc" href={doc.sourceUrl} target="_blank" rel="noopener noreferrer">{row}</a>
                  ) : (
                    <span className="venue-gig-rail__doc">{row}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="venue-gig-rail__card">
        <h3 className="venue-gig-rail__title">Additional notes</h3>
        {notesEditing ? (
          <textarea
            className="venue-gig-rail__notes-input"
            value={notesDraft}
            onChange={(event) => setNotesDraft(event.target.value)}
            onBlur={() => { if (!notesSaving) saveNotes(); }}
            rows={4}
            autoFocus
            disabled={notesSaving}
          />
        ) : (
          <button
            type="button"
            className="venue-gig-rail__notes"
            onClick={() => {
              if (!canUpdate) return;
              setNotesDraft(notes);
              setNotesEditing(true);
            }}
            disabled={!canUpdate}
          >
            {notes.trim() ? notes : 'Add a note'}
          </button>
        )}
      </section>
    </>
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
  gigLinkUrl = '',
  onInviteFromContacts = null,
}) {
  const { user } = useAuth();
  const hireIdForVenueHire = rawGig?.id ?? rawGig?.gigId;
  const [venueHireAppsCount, setVenueHireAppsCount] = useState(null);
  const [venueHireAppsLoading, setVenueHireAppsLoading] = useState(false);
  const [editingTimingKey, setEditingTimingKey] = useState(null);
  const [editingTimingValue, setEditingTimingValue] = useState('');
  const [timelineSaving, setTimelineSaving] = useState(false);

  useEffect(() => {
    if (normalisedGig?.bookingMode !== 'venue_hire' || !hireIdForVenueHire) {
      setVenueHireAppsCount(null);
      setVenueHireAppsLoading(false);
      return undefined;
    }
    if (!user?.uid) {
      setVenueHireAppsCount(0);
      setVenueHireAppsLoading(false);
      return undefined;
    }
    let cancelled = false;
    setVenueHireAppsLoading(true);
    getConversationsByParticipantAndGigId(hireIdForVenueHire, user.uid)
      .then((list) => {
        if (!cancelled) setVenueHireAppsCount((list || []).length);
      })
      .catch(() => {
        if (!cancelled) setVenueHireAppsCount(0);
      })
      .finally(() => {
        if (!cancelled) setVenueHireAppsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [normalisedGig?.bookingMode, hireIdForVenueHire, user?.uid, refreshGigs]);

  const isVenueHire = normalisedGig?.bookingMode === 'venue_hire';
  const isArtistBooking = normalisedGig?.bookingMode === 'artist_booking';

  const canUpdate = rawGig?.venueId && hasVenuePerm(venues, rawGig.venueId, 'gigs.update');

  const startAddTimelineTime = useCallback(
    (timingKey) => {
      if (!canUpdate || !timingKey) return;
      const existing = String(rawGig?.eventTimings?.[timingKey] || '').trim();
      setEditingTimingKey(timingKey);
      setEditingTimingValue(existing);
    },
    [canUpdate, rawGig?.eventTimings]
  );

  const cancelAddTimelineTime = useCallback(() => {
    setEditingTimingKey(null);
    setEditingTimingValue('');
  }, []);

  const saveAddTimelineTime = useCallback(
    async (timingKey) => {
      if (!canUpdate || !rawGig || !timingKey) return;
      const value = String(editingTimingValue || '').trim();
      if (!value) return;
      setTimelineSaving(true);
      try {
        const nextEventTimings = {
          ...(rawGig?.eventTimings || {}),
          [timingKey]: value,
        };
        const updates = { eventTimings: nextEventTimings };
        // Keep legacy/fallback top-level fields in sync so all surfaces update consistently.
        if (timingKey === 'accessFrom') {
          updates.accessFrom = value;
          updates.rentalAccessFrom = value;
        } else if (timingKey === 'musicStop') {
          updates.curfew = value;
          updates.rentalHardCurfew = value;
        }

        if (normalisedGig?.bookingMode === 'venue_hire') {
          await updateVenueHireOpportunity(rawGig.id || rawGig.gigId, updates);
        } else {
          await updateGigDocument({
            gigId: rawGig.gigId,
            action: 'gigs.update',
            updates,
          });
        }
        setGigInfo?.((prev) => (prev ? { ...prev, ...updates } : prev));
        refreshGigs?.();
        toast.success('Time added.');
        setEditingTimingKey(null);
        setEditingTimingValue('');
      } catch (e) {
        console.error(e);
        toast.error('Could not save time.');
      } finally {
        setTimelineSaving(false);
      }
    },
    [canUpdate, editingTimingValue, normalisedGig?.bookingMode, rawGig, refreshGigs, setGigInfo]
  );

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
          venueHireApplicationsCount: venueHireAppsCount,
          venueHireApplicationsLoading: venueHireAppsLoading,
          refreshGigs,
          setGigInfo,
          canUpdate,
          onEditGig: bookingSummaryOnEditGig,
        })}
        {renderTimelineTile(timingDisplayRows, {
          canUpdate,
          editingTimingKey,
          editingTimingValue,
          timelineSaving,
          onStartAddTime: startAddTimelineTime,
          onChangeAddTime: setEditingTimingValue,
          onCancelAddTime: cancelAddTimelineTime,
          onSaveAddTime: saveAddTimelineTime,
        })}

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

  if (isArtistBooking) {
    return (
      <aside className="venue-gig-page-sidebar venue-gig-rail" aria-label="Gig details">
        <ArtistBookingConsoleRail
          rawGig={rawGig}
          slots={Array.isArray(mergedTimelineSlots) && mergedTimelineSlots.length ? mergedTimelineSlots : [rawGig]}
          canUpdate={canUpdate}
          setGigInfo={setGigInfo}
          refreshGigs={refreshGigs}
          gigLinkUrl={gigLinkUrl}
          onInviteFromContacts={onInviteFromContacts}
        />
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
