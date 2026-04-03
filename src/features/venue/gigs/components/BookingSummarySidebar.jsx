import React, { useState, useCallback, useEffect } from 'react';
import { updateGigDocument } from '@services/api/gigs';
import { updateVenueHireOpportunity } from '@services/client-side/venueHireOpportunities';
import { getVenueProfileById } from '@services/client-side/venues';
import { getArtistProfileById } from '@services/client-side/artists';
import { hasVenuePerm } from '@services/utils/permissions';
import { computeCompatibility } from '@services/utils/techRiderCompatibility';
import { toast } from 'sonner';
import { MoreInformationIcon, EditIcon, TechRiderIcon } from '@features/shared/ui/extras/Icons';
import { TechSetupTile } from './TechSetupTile';

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
  onEdit,
}) {
  const [internalNotesSaving, setInternalNotesSaving] = useState(false);
  const [internalNotesLocal, setInternalNotesLocal] = useState(null); // null = use rawGig value
  const [soundManagerLocal, setSoundManagerLocal] = useState(null);
  const [notesLocal, setNotesLocal] = useState(null);
  const [hireFeeUpdating, setHireFeeUpdating] = useState(false);
  const [equipmentHireFeesUpdating, setEquipmentHireFeesUpdating] = useState(false);
  const [depositUpdating, setDepositUpdating] = useState(false);
  const [missingEquipmentSortedUpdating, setMissingEquipmentSortedUpdating] = useState(false);
  const [venueProfile, setVenueProfile] = useState(null);
  const [bookerVenueEquipmentInUse, setBookerVenueEquipmentInUse] = useState([]);

  useEffect(() => {
    const venueId = rawGig?.venueId;
    if (!venueId) {
      setVenueProfile(null);
      return;
    }
    let cancelled = false;
    getVenueProfileById(venueId)
      .then((profile) => { if (!cancelled) setVenueProfile(profile || null); })
      .catch(() => { if (!cancelled) setVenueProfile(null); });
    return () => { cancelled = true; };
  }, [rawGig?.venueId]);

  // For venue hire with a booker: only compute from current tech rider when gig has no saved tech setup (use snapshot from confirm time).
  useEffect(() => {
    const savedUsing = rawGig?.techSetup?.usingVenueEquipment;
    if (Array.isArray(savedUsing) && savedUsing.length > 0) {
      setBookerVenueEquipmentInUse([]);
      return;
    }
    const hirerUserId = rawGig?.hirerUserId;
    const venueTechRider = venueProfile?.techRider;
    if (!hirerUserId || !venueTechRider || normalisedGig?.bookingMode !== 'venue_hire') {
      setBookerVenueEquipmentInUse([]);
      return;
    }
    let cancelled = false;
    getArtistProfileById(hirerUserId)
      .then((profile) => {
        if (cancelled) return;
        if (profile?.techRider?.isComplete && profile?.techRider?.lineup?.length > 0) {
          const compat = computeCompatibility(profile.techRider, venueTechRider);
          const using = (compat.providedByVenue || []).map((i) => (i?.label ?? i)).filter(Boolean);
          setBookerVenueEquipmentInUse(using);
        } else {
          setBookerVenueEquipmentInUse([]);
        }
      })
      .catch(() => { if (!cancelled) setBookerVenueEquipmentInUse([]); });
    return () => { cancelled = true; };
  }, [rawGig?.hirerUserId, venueProfile?.techRider, normalisedGig?.bookingMode]);

  const isVenueHire = normalisedGig?.bookingMode === 'venue_hire';
  const isArtistBooking = normalisedGig?.bookingMode === 'artist_booking';
  const hireId = rawGig?.id ?? rawGig?.gigId;

  const internalNotesValue = internalNotesLocal !== null ? internalNotesLocal : (rawGig?.internalNotes ?? rawGig?.notesInternal ?? '');
  const internalNotesLastEdited = rawGig?.internalNotesLastEdited;
  const soundManagerValue = soundManagerLocal !== null ? soundManagerLocal : (rawGig?.soundManager ?? '');
  const notesValue = notesLocal !== null ? notesLocal : (rawGig?.notes ?? '');

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

  const saveGigField = useCallback(async (field, value) => {
    if (!rawGig?.gigId || !canUpdate) return;
    setInternalNotesSaving(true);
    try {
      await updateGigDocument({
        gigId: rawGig.gigId,
        action: 'gigs.update',
        updates: { [field]: value ?? null },
      });
      setGigInfo?.((prev) => (prev ? { ...prev, [field]: value ?? null } : null));
      refreshGigs?.();
      if (field === 'soundManager') setSoundManagerLocal(null);
      if (field === 'notes') setNotesLocal(null);
      toast.success('Saved.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save.');
    } finally {
      setInternalNotesSaving(false);
    }
  }, [rawGig?.gigId, canUpdate, setGigInfo, refreshGigs]);

  const saveSoundManager = useCallback(async (value) => {
    if (!canUpdate) return;
    const trimmed = value != null ? String(value).trim() : '';
    const current = rawGig?.soundManager ?? '';
    if (trimmed === (current || '').trim()) return;
    setInternalNotesSaving(true);
    try {
      if (isVenueHire) {
        await updateVenueHireOpportunity(hireId, { soundManager: trimmed || null });
        setGigInfo?.((prev) => (prev ? { ...prev, soundManager: trimmed || null } : null));
      } else {
        await updateGigDocument({
          gigId: rawGig.gigId,
          action: 'gigs.update',
          updates: { soundManager: trimmed || null },
        });
        setGigInfo?.((prev) => (prev ? { ...prev, soundManager: trimmed || null } : null));
        setSoundManagerLocal(null);
      }
      refreshGigs?.();
      toast.success('Saved.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save.');
    } finally {
      setInternalNotesSaving(false);
    }
  }, [hireId, rawGig?.gigId, rawGig?.soundManager, canUpdate, isVenueHire, setGigInfo, refreshGigs]);

  const markDepositPaid = useCallback(async (paid) => {
    if (!hireId && !rawGig?.gigId) return;
    if (!canUpdate) return;
    setDepositUpdating(true);
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
      setDepositUpdating(false);
    }
  }, [hireId, rawGig?.gigId, canUpdate, isVenueHire, setGigInfo, refreshGigs]);

  const markHireFeePaid = useCallback(async (paid) => {
    if (!hireId && !rawGig?.gigId) return;
    if (!canUpdate) return;
    setHireFeeUpdating(true);
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
      setHireFeeUpdating(false);
    }
  }, [hireId, rawGig?.gigId, canUpdate, isVenueHire, setGigInfo, refreshGigs]);

  const markEquipmentHireFeesPaid = useCallback(async (paid) => {
    if (!hireId && !rawGig?.gigId) return;
    if (!canUpdate) return;
    setEquipmentHireFeesUpdating(true);
    try {
      if (isVenueHire) {
        await updateVenueHireOpportunity(hireId, { equipmentHireFeesPaid: paid });
        setGigInfo?.((prev) => (prev ? { ...prev, equipmentHireFeesPaid: paid } : null));
      } else {
        await updateGigDocument({
          gigId: rawGig.gigId,
          action: 'gigs.update',
          updates: { equipmentHireFeesPaid: paid },
        });
        setGigInfo?.((prev) => (prev ? { ...prev, equipmentHireFeesPaid: paid } : null));
      }
      refreshGigs?.();
      toast.success(paid ? 'Equipment hire fees marked as paid.' : 'Equipment hire fees marked as unpaid.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update.');
    } finally {
      setEquipmentHireFeesUpdating(false);
    }
  }, [hireId, rawGig?.gigId, canUpdate, isVenueHire, setGigInfo, refreshGigs]);

  const markMissingEquipmentSorted = useCallback(async (sorted) => {
    if (!hireId && !rawGig?.gigId) return;
    if (!canUpdate) return;
    setMissingEquipmentSortedUpdating(true);
    try {
      if (isVenueHire) {
        await updateVenueHireOpportunity(hireId, { missingEquipmentSorted: sorted });
        setGigInfo?.((prev) => (prev ? { ...prev, missingEquipmentSorted: sorted } : null));
      } else {
        await updateGigDocument({
          gigId: rawGig.gigId,
          action: 'gigs.update',
          updates: { missingEquipmentSorted: sorted },
        });
        setGigInfo?.((prev) => (prev ? { ...prev, missingEquipmentSorted: sorted } : null));
      }
      refreshGigs?.();
      toast.success(sorted ? 'Marked as sorted.' : 'Marked as not sorted.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update.');
    } finally {
      setMissingEquipmentSortedUpdating(false);
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
    const depositRequired = rawGig?.rentalDepositRequired === true;
    const hasDepositConfigured = depositRequired || (depositAmount != null && depositAmount !== '');
    const depositPaid = rawGig?.depositPaid === true || (rawGig?.depositStatus === 'paid');
    const hireFeePaid = rawGig?.hireFeePaid === true;
    const feeText = fee == null ? '' : String(fee).trim().toLowerCase();
    const feeNumeric = Number((feeText || '').replace(/[^\d.]/g, ''));
    const hasPayableHireFee = !!feeText && feeText !== 'free' && (Number.isFinite(feeNumeric) ? feeNumeric > 0 : true);

    return (
      <aside className="venue-gig-page-sidebar" aria-label="Financial status and access">
        <div className="venue-gig-page-sidebar__cards">
          <div className="venue-gig-page-sidebar__card">
          {onEdit && canUpdate ? (
            <div className="venue-gig-page-sidebar__card-header venue-gig-page-sidebar__card-header--with-title">
              <h3 className="venue-gig-page-sidebar__title">
                <span className="venue-gig-page-sidebar__title-inner">
                  <MoreInformationIcon /> Gig details
                </span>
              </h3>
              <button type="button" className="btn tertiary venue-gig-page-sidebar__edit-btn" onClick={onEdit}>
                Edit
              </button>
            </div>
          ) : (
            <h3 className="venue-gig-page-sidebar__title">
              <span className="venue-gig-page-sidebar__title-inner">
                <MoreInformationIcon /> Gig details
              </span>
            </h3>
          )}
          <section className="venue-gig-page-sidebar__section">
            {(accessFrom || curfew) && (
              <div className="venue-gig-page-sidebar__time-tiles">
                <div className="venue-gig-page-sidebar__time-tile">
                  <span className="venue-gig-page-sidebar__time-tile-label">Access from</span>
                  <div className="venue-gig-page-sidebar__time-tile-value">{accessFrom || '—'}</div>
                </div>
                <div className="venue-gig-page-sidebar__time-tiles-connector" aria-hidden="true" />
                <div className="venue-gig-page-sidebar__time-tile">
                  <span className="venue-gig-page-sidebar__time-tile-label">Music stop by</span>
                  <div className="venue-gig-page-sidebar__time-tile-value">{curfew || '—'}</div>
                </div>
              </div>
            )}
          </section>

          <section className="venue-gig-page-sidebar__section">
            <dl className="venue-gig-page-sidebar__list">
              <div className="venue-gig-page-sidebar__row">
                <dt>Hire fee</dt>
                <dd className="venue-gig-page-sidebar__financial-row">
                  <span>{fee != null && fee !== '' ? fee : '—'}</span>
                  {hasBooker && (
                    <>
                      {hasPayableHireFee && (
                        <span className={`venue-gig-page-sidebar__badge venue-gig-page-sidebar__badge--${hireFeePaid ? 'paid' : 'unpaid'}`}>
                          {hireFeePaid ? 'Paid' : 'Unpaid'}
                        </span>
                      )}
                      {canUpdate && hasPayableHireFee && (
                        <button
                          type="button"
                          className="btn tertiary venue-gig-page-sidebar__mark-btn"
                          onClick={() => markHireFeePaid(!hireFeePaid)}
                          disabled={hireFeeUpdating}
                        >
                          Mark as {hireFeePaid ? 'unpaid' : 'paid'}
                        </button>
                      )}
                    </>
                  )}
                </dd>
              </div>
              {hasBooker && hasDepositConfigured && (
              <div className="venue-gig-page-sidebar__row">
                <dt>Deposit</dt>
                <dd className="venue-gig-page-sidebar__financial-row">
                  <span>{depositAmount != null && depositAmount !== '' ? String(depositAmount) : '—'}</span>
                  <span className={`venue-gig-page-sidebar__badge venue-gig-page-sidebar__badge--${depositPaid ? 'paid' : 'unpaid'}`}>
                    {depositPaid ? 'Paid' : 'Unpaid'}
                  </span>
                  {canUpdate && (
                    <button
                      type="button"
                      className="btn tertiary venue-gig-page-sidebar__mark-btn"
                      onClick={() => markDepositPaid(!depositPaid)}
                      disabled={depositUpdating}
                    >
                      Mark as {depositPaid ? 'unpaid' : 'paid'}
                    </button>
                  )}
                </dd>
              </div>
              )}
              {!hasBooker && hasDepositConfigured && (
              <div className="venue-gig-page-sidebar__row">
                <dt>Deposit</dt>
                <dd className="venue-gig-page-sidebar__financial-row">
                  <span>{depositAmount != null && depositAmount !== '' ? String(depositAmount) : '—'}</span>
                </dd>
              </div>
              )}
              <div className="venue-gig-page-sidebar__row">
                <dt>Capacity</dt>
                <dd>{capacity != null && capacity !== '' ? capacity : '—'}</dd>
              </div>
            </dl>
          </section>

          {Array.isArray(rawGig?.documents) && rawGig.documents.length > 0 && (
            <section className="venue-gig-page-sidebar__section">
              <h2 className="venue-gig-page-sidebar__section-title venue-gig-page-sidebar__section-title--primary">Documents</h2>
              <ul className="venue-gig-page-sidebar__documents-list">
                {rawGig.documents.map((doc, i) => (
                  <li key={i}>
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="venue-gig-page-sidebar__document-link">
                      {doc.name || (doc.url ? 'View document' : '')}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
          </div>

          <div className="venue-gig-page-sidebar__card">
            <h3 className="venue-gig-page-sidebar__title">
              <span className="venue-gig-page-sidebar__title-inner">
                <TechRiderIcon /> Tech Setup
              </span>
            </h3>
            <TechSetupTile
              rawGig={rawGig}
              normalisedGig={normalisedGig}
              venueProfile={venueProfile}
              canUpdate={canUpdate}
              onSaveSoundEngineer={saveSoundManager}
              soundEngineerSaving={internalNotesSaving}
              hireFeePaid={rawGig?.hireFeePaid}
              onMarkHireFeePaid={markHireFeePaid}
              equipmentHireFeesPaid={rawGig?.equipmentHireFeesPaid}
              onMarkEquipmentHireFeesPaid={markEquipmentHireFeesPaid}
              equipmentHireFeesUpdating={equipmentHireFeesUpdating}
              missingEquipmentSortedUpdating={missingEquipmentSortedUpdating}
              missingEquipmentSorted={rawGig?.missingEquipmentSorted}
              onMarkMissingEquipmentSorted={markMissingEquipmentSorted}
              bookerVenueEquipmentInUse={bookerVenueEquipmentInUse}
            />
          </div>

          <div className="venue-gig-page-sidebar__card">
            <h3 className="venue-gig-page-sidebar__title">
              <span className="venue-gig-page-sidebar__title-inner">
                <EditIcon /> Internal notes
              </span>
            </h3>
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
          </div>
        </div>
      </aside>
    );
  }

  // Artist booking: same layout as For Hire – Financial status, Access & restrictions, Internal notes (sound manager + notes)
  if (isArtistBooking) {
    return (
      <aside className="venue-gig-page-sidebar" aria-label="Financial status and access">
        <div className="venue-gig-page-sidebar__cards">
          <div className="venue-gig-page-sidebar__card">
          {onEdit && canUpdate ? (
            <div className="venue-gig-page-sidebar__card-header venue-gig-page-sidebar__card-header--with-title">
              <h3 className="venue-gig-page-sidebar__title">
                <span className="venue-gig-page-sidebar__title-inner">
                  <MoreInformationIcon /> Gig details
                </span>
              </h3>
              <button type="button" className="btn tertiary venue-gig-page-sidebar__edit-btn" onClick={onEdit}>
                Edit
              </button>
            </div>
          ) : (
            <h3 className="venue-gig-page-sidebar__title">
              <span className="venue-gig-page-sidebar__title-inner">
                <MoreInformationIcon /> Gig details
              </span>
            </h3>
          )}
          <section className="venue-gig-page-sidebar__section">
            {(accessFrom || curfew) && (
              <div className="venue-gig-page-sidebar__time-tiles">
                <div className="venue-gig-page-sidebar__time-tile">
                  <span className="venue-gig-page-sidebar__time-tile-label">Access from</span>
                  <div className="venue-gig-page-sidebar__time-tile-value">{accessFrom || '—'}</div>
                </div>
                <div className="venue-gig-page-sidebar__time-tiles-connector" aria-hidden="true" />
                <div className="venue-gig-page-sidebar__time-tile">
                  <span className="venue-gig-page-sidebar__time-tile-label">Music stop by</span>
                  <div className="venue-gig-page-sidebar__time-tile-value">{curfew || '—'}</div>
                </div>
              </div>
            )}
          </section>

          <section className="venue-gig-page-sidebar__section">
            <dl className="venue-gig-page-sidebar__list">
              {fee != null && fee !== '' && (
                <div className="venue-gig-page-sidebar__row">
                  <dt>Fee</dt>
                  <dd>{fee}</dd>
                </div>
              )}
              {hasDeposit && (
                <div className="venue-gig-page-sidebar__row">
                  <dt>Deposit</dt>
                  <dd>
                    {depositAmount != null && depositAmount !== '' ? String(depositAmount) : '—'}
                    {depositStatus ? ` · ${depositStatus}` : ''}
                  </dd>
                </div>
              )}
              {!hasMoney && (
                <div className="venue-gig-page-sidebar__row">
                  <dt>Fee</dt>
                  <dd>—</dd>
                </div>
              )}
              <div className="venue-gig-page-sidebar__row">
                <dt>Capacity</dt>
                <dd>{capacity != null && capacity !== '' ? capacity : '—'}</dd>
              </div>
            </dl>
          </section>

          {Array.isArray(rawGig?.documents) && rawGig.documents.length > 0 && (
            <section className="venue-gig-page-sidebar__section">
              <h2 className="venue-gig-page-sidebar__section-title venue-gig-page-sidebar__section-title--primary">Documents</h2>
              <ul className="venue-gig-page-sidebar__documents-list">
                {rawGig.documents.map((doc, i) => (
                  <li key={i}>
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="venue-gig-page-sidebar__document-link">
                      {doc.name || (doc.url ? 'View document' : '')}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
          </div>

          <div className="venue-gig-page-sidebar__card">
            <h3 className="venue-gig-page-sidebar__title">
              <span className="venue-gig-page-sidebar__title-inner">
                <TechRiderIcon /> Tech Setup
              </span>
            </h3>
            <TechSetupTile
              rawGig={rawGig}
              normalisedGig={normalisedGig}
              venueProfile={venueProfile}
              canUpdate={canUpdate}
              onSaveSoundEngineer={saveSoundManager}
              soundEngineerSaving={internalNotesSaving}
              hireFeePaid={rawGig?.hireFeePaid}
              onMarkHireFeePaid={markHireFeePaid}
              equipmentHireFeesPaid={rawGig?.equipmentHireFeesPaid}
              onMarkEquipmentHireFeesPaid={markEquipmentHireFeesPaid}
              equipmentHireFeesUpdating={equipmentHireFeesUpdating}
              missingEquipmentSortedUpdating={missingEquipmentSortedUpdating}
              missingEquipmentSorted={rawGig?.missingEquipmentSorted}
              onMarkMissingEquipmentSorted={markMissingEquipmentSorted}
              bookerVenueEquipmentInUse={bookerVenueEquipmentInUse}
            />
          </div>

          <div className="venue-gig-page-sidebar__card">
            <h3 className="venue-gig-page-sidebar__title">
              <span className="venue-gig-page-sidebar__title-inner">
                <EditIcon /> Internal notes
              </span>
            </h3>
            {canUpdate ? (
              <>
                <label className="venue-gig-page-sidebar__notes-label">Notes</label>
                <textarea
                  className="venue-gig-page-sidebar__notes-input"
                  value={notesValue}
                  onChange={(e) => setNotesLocal(e.target.value)}
                  onBlur={() => {
                    const v = notesLocal !== null ? notesLocal : (rawGig?.notes ?? '');
                    if (String(v).trim() !== String(rawGig?.notes ?? '').trim()) {
                      saveGigField('notes', v.trim() || null);
                    }
                    setNotesLocal(null);
                  }}
                  placeholder="Add notes for your team…"
                  rows={4}
                  disabled={internalNotesSaving}
                />
              </>
            ) : (
              <>
                <p className="venue-gig-page-sidebar__notes-readonly">{notesValue || '—'}</p>
              </>
            )}
          </div>
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
