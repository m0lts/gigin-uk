import React, { useState, useCallback } from 'react';
import { updateGigDocument } from '@services/api/gigs';
import { updateVenueHireOpportunity } from '@services/client-side/venueHireOpportunities';
import { hasVenuePerm } from '@services/utils/permissions';
import { toast } from 'sonner';

/**
 * Sidebar: For venue hire (confirmed or unconfirmed), same right column: Financial status, Access & restrictions, Internal notes.
 * For other gig types: "Key details" summary.
 */
export function BookingSummarySidebar({
  normalisedGig,
  rawGig,
  setGigInfo,
  refreshGigs,
  venues,
}) {
  const [internalNotesSaving, setInternalNotesSaving] = useState(false);
  const [internalNotesLocal, setInternalNotesLocal] = useState(null); // null = use rawGig value
  const [paymentUpdating, setPaymentUpdating] = useState(false); // deposit or hire fee toggle in progress

  const isVenueHire = normalisedGig?.bookingMode === 'venue_hire';
  const hireId = rawGig?.id ?? rawGig?.gigId;

  const internalNotesValue = internalNotesLocal !== null ? internalNotesLocal : (rawGig?.internalNotes ?? rawGig?.notesInternal ?? '');
  const internalNotesLastEdited = rawGig?.internalNotesLastEdited;

  const canUpdate = rawGig?.venueId && hasVenuePerm(venues, rawGig.venueId, 'gigs.update');

  const saveInternalNotes = useCallback(async (value) => {
    if (!hireId && !rawGig?.gigId) return;
    if (!canUpdate) return;
    setInternalNotesSaving(true);
    try {
      const now = new Date().toISOString();
      if (isVenueHire) {
        await updateVenueHireOpportunity(hireId, { notesInternal: value || '', internalNotesLastEdited: now });
        setGigInfo?.((prev) => (prev ? { ...prev, notesInternal: value || '', internalNotes: value || null, internalNotesLastEdited: now } : null));
      } else {
        await updateGigDocument({
          gigId: rawGig.gigId,
          action: 'gigs.update',
          updates: { internalNotes: value || null, internalNotesLastEdited: now },
        });
        setGigInfo?.((prev) => (prev ? { ...prev, internalNotes: value || null, internalNotesLastEdited: now } : null));
      }
      refreshGigs?.();
      setInternalNotesLocal(null);
      toast.success('Notes saved.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save notes.');
    } finally {
      setInternalNotesSaving(false);
    }
  }, [hireId, rawGig?.gigId, rawGig?.venueId, canUpdate, isVenueHire, setGigInfo, refreshGigs]);

  const handleInternalNotesBlur = () => {
    const value = internalNotesLocal !== null ? internalNotesLocal : (rawGig?.internalNotes ?? rawGig?.notesInternal ?? '');
    const current = rawGig?.internalNotes ?? rawGig?.notesInternal ?? '';
    if (value.trim() !== (current || '').trim()) {
      saveInternalNotes(value.trim() || '');
    } else {
      setInternalNotesLocal(null);
    }
  };

  const markDepositPaid = useCallback(async (paid) => {
    if (!hireId && !rawGig?.gigId) return;
    if (!canUpdate) return;
    setPaymentUpdating(true);
    try {
      if (isVenueHire) {
        await updateVenueHireOpportunity(hireId, { depositPaid: paid });
        setGigInfo?.((prev) => (prev ? { ...prev, depositPaid: paid } : null));
      } else {
        await updateGigDocument({
          gigId: rawGig.gigId,
          action: 'gigs.update',
          updates: { depositPaid: paid },
        });
        setGigInfo?.((prev) => (prev ? { ...prev, depositPaid: paid } : null));
      }
      refreshGigs?.();
      toast.success(paid ? 'Deposit marked as paid.' : 'Deposit marked as unpaid.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update.');
    } finally {
      setPaymentUpdating(false);
    }
  }, [hireId, rawGig?.gigId, canUpdate, isVenueHire, setGigInfo, refreshGigs]);

  const markHireFeePaid = useCallback(async (paid) => {
    if (!hireId && !rawGig?.gigId) return;
    if (!canUpdate) return;
    setPaymentUpdating(true);
    try {
      if (isVenueHire) {
        await updateVenueHireOpportunity(hireId, { hireFeePaid: paid });
        setGigInfo?.((prev) => (prev ? { ...prev, hireFeePaid: paid } : null));
      } else {
        await updateGigDocument({
          gigId: rawGig.gigId,
          action: 'gigs.update',
          updates: { hireFeePaid: paid },
        });
        setGigInfo?.((prev) => (prev ? { ...prev, hireFeePaid: paid } : null));
      }
      refreshGigs?.();
      toast.success(paid ? 'Hire fee marked as paid.' : 'Hire fee marked as unpaid.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update.');
    } finally {
      setPaymentUpdating(false);
    }
  }, [hireId, rawGig?.gigId, canUpdate, isVenueHire, setGigInfo, refreshGigs]);

  if (!normalisedGig) return null;

  const {
    bookingMode,
    fee,
    depositAmount,
    depositStatus,
    capacity,
    accessFrom,
    curfew,
    bookedBy,
    performers,
  } = normalisedGig;

  const hasDeposit = depositAmount != null && depositAmount !== '' || depositStatus;
  const hasMoney = (fee != null && fee !== '') || hasDeposit;
  const hasAccessOrCurfew = accessFrom || curfew;

  // Venue hire (confirmed or unconfirmed): same right column – Financial status, Access & restrictions, Internal notes (no "Key details")
  if (isVenueHire) {
    const hasBooker = !!(rawGig?.renterName && String(rawGig.renterName).trim());
    const paIncluded = rawGig?.rentalPaIncluded ?? '';
    const soundEngineerIncluded = rawGig?.rentalSoundEngineerIncluded ?? '';
    const depositRequired = rawGig?.rentalDepositRequired === true;
    const depositPaid = rawGig?.depositPaid === true || (rawGig?.depositStatus === 'paid');
    const hireFeePaid = rawGig?.hireFeePaid === true;

    const formatYesNoForHire = (v) => {
      if (v === 'yes') return 'Yes';
      if (v === 'no') return 'No';
      if (v === 'for_hire') return 'For hire';
      return '—';
    };

    return (
      <aside className="venue-gig-page-sidebar" aria-label="Financial status and access">
        <div className="venue-gig-page-sidebar__card">
          <section className="venue-gig-page-sidebar__section">
            <h2 className="venue-gig-page-sidebar__section-title venue-gig-page-sidebar__section-title--primary">Financial status</h2>
            <dl className="venue-gig-page-sidebar__list">
              <div className="venue-gig-page-sidebar__row">
                <dt>Hire fee</dt>
                <dd className="venue-gig-page-sidebar__financial-row">
                  <span>{fee != null && fee !== '' ? fee : '—'}</span>
                  {hasBooker && (
                    <>
                      <span className={`venue-gig-page-sidebar__badge venue-gig-page-sidebar__badge--${hireFeePaid ? 'paid' : 'unpaid'}`}>
                        {hireFeePaid ? 'Paid' : 'Unpaid'}
                      </span>
                      {canUpdate && fee != null && fee !== '' && (
                        <button
                          type="button"
                          className="btn tertiary venue-gig-page-sidebar__mark-btn"
                          onClick={() => markHireFeePaid(!hireFeePaid)}
                          disabled={paymentUpdating}
                        >
                          Mark as {hireFeePaid ? 'unpaid' : 'paid'}
                        </button>
                      )}
                    </>
                  )}
                </dd>
              </div>
              {hasBooker && (
              <div className="venue-gig-page-sidebar__row">
                <dt>Deposit</dt>
                <dd className="venue-gig-page-sidebar__financial-row">
                  {!depositRequired ? (
                    <span>No deposit required</span>
                  ) : (
                    <>
                      <span>{depositAmount != null && depositAmount !== '' ? String(depositAmount) : '—'}</span>
                      <span className={`venue-gig-page-sidebar__badge venue-gig-page-sidebar__badge--${depositPaid ? 'paid' : 'unpaid'}`}>
                        {depositPaid ? 'Paid' : 'Unpaid'}
                      </span>
                      {canUpdate && (
                        <button
                          type="button"
                          className="btn tertiary venue-gig-page-sidebar__mark-btn"
                          onClick={() => markDepositPaid(!depositPaid)}
                          disabled={paymentUpdating}
                        >
                          Mark as {depositPaid ? 'unpaid' : 'paid'}
                        </button>
                      )}
                    </>
                  )}
                </dd>
              </div>
              )}
              {!hasBooker && depositRequired && (
              <div className="venue-gig-page-sidebar__row">
                <dt>Deposit</dt>
                <dd className="venue-gig-page-sidebar__financial-row">
                  <span>{depositAmount != null && depositAmount !== '' ? String(depositAmount) : '—'}</span>
                </dd>
              </div>
              )}
            </dl>
          </section>

          <section className="venue-gig-page-sidebar__section">
            <h2 className="venue-gig-page-sidebar__section-title venue-gig-page-sidebar__section-title--primary">Access & restrictions</h2>
            <dl className="venue-gig-page-sidebar__list">
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
              {capacity != null && capacity !== '' && (
                <div className="venue-gig-page-sidebar__row">
                  <dt>Capacity</dt>
                  <dd>{capacity}</dd>
                </div>
              )}
              <div className="venue-gig-page-sidebar__row">
                <dt>PA included</dt>
                <dd>{formatYesNoForHire(paIncluded)}</dd>
              </div>
              <div className="venue-gig-page-sidebar__row">
                <dt>Sound engineer included</dt>
                <dd>{formatYesNoForHire(soundEngineerIncluded)}</dd>
              </div>
            </dl>
          </section>

          <section className="venue-gig-page-sidebar__section venue-gig-page-sidebar__section--notes">
            <h3 className="venue-gig-page-sidebar__section-title venue-gig-page-sidebar__section-title--secondary">Internal notes</h3>
            {canUpdate ? (
              <>
                <textarea
                  className="venue-gig-page-sidebar__notes-input"
                  value={internalNotesValue}
                  onChange={(e) => setInternalNotesLocal(e.target.value)}
                  onBlur={handleInternalNotesBlur}
                  placeholder="Add notes for your team…"
                  rows={4}
                  disabled={internalNotesSaving}
                />
                {internalNotesLastEdited && (
                  <p className="venue-gig-page-sidebar__notes-edited">
                    Last edited {formatLastEdited(internalNotesLastEdited)}
                  </p>
                )}
              </>
            ) : (
              <p className="venue-gig-page-sidebar__notes-readonly">
                {internalNotesValue || '—'}
              </p>
            )}
          </section>
        </div>
      </aside>
    );
  }

  // Default: "Key details" (other gig types, e.g. artist booking)
  return (
    <aside className="venue-gig-page-sidebar" aria-label="Key details">
      <div className="venue-gig-page-sidebar__card">
        <h3 className="venue-gig-page-sidebar__title">Key details</h3>

        <dl className="venue-gig-page-sidebar__list">

          {capacity != null && capacity !== '' && (
            <div className="venue-gig-page-sidebar__row">
              <dt>Capacity</dt>
              <dd>{capacity}</dd>
            </div>
          )}

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

function formatLastEdited(value) {
  if (!value) return '';
  try {
    const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}
