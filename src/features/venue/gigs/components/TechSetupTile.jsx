import React, { useState, useMemo } from 'react';
import { getTechRiderForDisplay } from '@features/venue/builder/techRiderConfig';
import { getEquipmentIconForLabel } from '@features/venue/utils/techSetupIcons';

/**
 * Normalize hired-from-venue items to { label, feeDisplay } and optional numeric fee for total.
 * Input can be strings "Label — £50" or objects { label, fee } / { label, hireFee }.
 */
function normalizeHiredItems(hiringFromVenue) {
  if (!Array.isArray(hiringFromVenue) || hiringFromVenue.length === 0) return [];
  return hiringFromVenue.map((item) => {
    if (typeof item === 'string') {
      const sep = item.indexOf(' — ');
      if (sep >= 0) return { label: item.slice(0, sep).trim(), feeDisplay: item.slice(sep + 3).trim(), feeValue: parseFee(item.slice(sep + 3)) };
      return { label: item, feeDisplay: '', feeValue: 0 };
    }
    const label = item?.label ?? item?.name ?? '';
    const fee = item?.fee ?? item?.hireFee;
    const feeDisplay = fee != null && fee !== '' ? (typeof fee === 'number' ? `£${fee}` : String(fee)) : '';
    return { label, feeDisplay, feeValue: parseFee(feeDisplay) };
  });
}

function parseFee(str) {
  if (str == null || str === '') return 0;
  const s = String(str).replace(/[^\d.]/g, '');
  const n = parseFloat(s, 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Compact tech summary for a single gig/slot.
 * STATE 1: Unbooked – venue-side only (sound engineer, venue equipment, placeholders).
 * STATE 2: Applicants, no act booked – same + compatibility hint.
 * STATE 3: Act booked – gig-specific setup (equipment in use from application, hired items, technical status).
 */
export function TechSetupTile({ rawGig, normalisedGig, venueProfile, canUpdate, onSaveSoundEngineer, soundEngineerSaving, hireFeePaid, onMarkHireFeePaid, equipmentHireFeesPaid, onMarkEquipmentHireFeesPaid, equipmentHireFeesUpdating, missingEquipmentSortedUpdating, missingEquipmentSorted, onMarkMissingEquipmentSorted, bookerVenueEquipmentInUse }) {
  const [soundEngineerLocal, setSoundEngineerLocal] = useState(null);
  const displaySoundEngineer = soundEngineerLocal !== null ? soundEngineerLocal : (rawGig?.soundManager ?? '');
  const isVenueHire = normalisedGig?.bookingMode === 'venue_hire';
  const isArtistBooking = normalisedGig?.bookingMode === 'artist_booking';

  const hasBooker = isVenueHire
    ? !!(rawGig?.renterName && String(rawGig.renterName).trim())
    : (normalisedGig?.performers?.count ?? 0) > 0;
  const hasApplicants = isArtistBooking && (rawGig?.applicants?.length ?? 0) > 0;

  const state =
    hasBooker ? 'booked'
    : hasApplicants ? 'applicants'
    : 'unbooked';

  const soundEngineerTrimmed = displaySoundEngineer != null && String(displaySoundEngineer).trim()
    ? String(displaySoundEngineer).trim()
    : null;

  const { equipmentForDisplay } = venueProfile?.techRider
    ? getTechRiderForDisplay(venueProfile.techRider)
    : { equipmentForDisplay: [] };
  const headlineEquipment = equipmentForDisplay
    .filter((item) => item.available)
    .map((item) => item.label)
    .slice(0, 10);

  const techSetup = rawGig?.techSetup || {};
  const technicalStatus = techSetup.technicalStatus != null && String(techSetup.technicalStatus).trim()
    ? String(techSetup.technicalStatus).trim()
    : null;

  const { usingVenueEquipment, hiredItems, hireFeeTotal, missingEquipmentList } = useMemo(() => {
    const isBookedArtist = hasBooker && isArtistBooking;
    const confirmedApplicant = isBookedArtist && Array.isArray(rawGig?.applicants)
      ? rawGig.applicants.find((a) => a?.status === 'confirmed' || a?.status === 'accepted' || a?.status === 'paid')
      : null;
    const appSetup = confirmedApplicant?.techSetup || confirmedApplicant;
    const hasApplicantTechSetup = appSetup && typeof appSetup === 'object';
    const gigLevelTechSetup = rawGig?.techSetup || {};
    const hasGigLevelUsing = Array.isArray(gigLevelTechSetup.usingVenueEquipment) && gigLevelTechSetup.usingVenueEquipment.length > 0;
    const hasGigLevelHired = Array.isArray(gigLevelTechSetup.hiringFromVenue) && gigLevelTechSetup.hiringFromVenue.length > 0;

    let using = [];
    let hired = [];
    let missing = [];
    if (hasApplicantTechSetup) {
      const usingArr = appSetup.usingVenueEquipment;
      const hiringArr = appSetup.hiringFromVenue;
      const missingArr = appSetup.needsDiscussion ?? appSetup.missingEquipment;
      if (Array.isArray(usingArr)) using = usingArr.map((i) => (typeof i === 'string' ? i : (i?.label ?? i?.name ?? String(i))).trim()).filter(Boolean);
      if (Array.isArray(hiringArr)) hired = normalizeHiredItems(hiringArr);
      if (Array.isArray(missingArr)) missing = missingArr.map((i) => (typeof i === 'string' ? i : (i?.label ?? i?.name ?? String(i))).trim()).filter(Boolean);
    }
    if (!hasApplicantTechSetup || (using.length === 0 && hired.length === 0 && (hasGigLevelUsing || hasGigLevelHired))) {
      if (hasGigLevelUsing || hasGigLevelHired) {
        if (Array.isArray(gigLevelTechSetup.usingVenueEquipment)) using = gigLevelTechSetup.usingVenueEquipment.map((i) => (typeof i === 'string' ? i : (i?.label ?? i?.name ?? String(i))).trim()).filter(Boolean);
        if (Array.isArray(gigLevelTechSetup.hiringFromVenue)) hired = normalizeHiredItems(gigLevelTechSetup.hiringFromVenue);
        if (Array.isArray(gigLevelTechSetup.needsDiscussion)) missing = gigLevelTechSetup.needsDiscussion.map((i) => (typeof i === 'string' ? i : (i?.label ?? i?.name ?? String(i))).trim()).filter(Boolean);
      }
      if (using.length === 0 && hired.length === 0) {
        const gigVenue = Array.isArray(techSetup.venueEquipmentSelected) ? techSetup.venueEquipmentSelected : [];
        const gigHired = Array.isArray(techSetup.hiredFromVenue) ? techSetup.hiredFromVenue : [];
        using = gigVenue.map((i) => (typeof i === 'string' ? i : (i?.label ?? '')).trim()).filter(Boolean);
        hired = normalizeHiredItems(gigHired);
      }
    } else if (hired.length === 0 && Array.isArray(techSetup.hiredFromVenue) && techSetup.hiredFromVenue.length > 0) {
      hired = normalizeHiredItems(techSetup.hiredFromVenue);
    }
    const total = hired.reduce((sum, i) => sum + (i.feeValue || 0), 0);
    return { usingVenueEquipment: using, hiredItems: hired, hireFeeTotal: total, missingEquipmentList: missing };
  }, [rawGig?.applicants, rawGig?.techSetup, hasBooker, isArtistBooking]);

  const equipmentHireFeesPaidProp = rawGig?.equipmentHireFeesPaid === true;
  const equipmentHireFeesPaidState = equipmentHireFeesPaid ?? equipmentHireFeesPaidProp;
  const hasHiredWithFees = hiredItems.length > 0 && hiredItems.some((i) => i.feeDisplay && i.feeValue > 0);

  return (
    <div className="venue-gig-page-sidebar__tech-setup-tile">
      {/* 1. Sound engineer – first in all states; editable text box when canUpdate */}
      <section className="venue-gig-page-sidebar__section venue-gig-page-sidebar__tech-setup-section">
        <h4 className="venue-gig-page-sidebar__section-title venue-gig-page-sidebar__section-title--primary">
          Sound engineer
        </h4>
        {canUpdate && onSaveSoundEngineer ? (
          <input
            type="text"
            className="venue-gig-page-sidebar__tech-setup-input"
            placeholder="Type name"
            value={displaySoundEngineer}
            onChange={(e) => setSoundEngineerLocal(e.target.value)}
            onBlur={() => {
              const value = soundEngineerLocal !== null ? soundEngineerLocal : (rawGig?.soundManager ?? '');
              const current = rawGig?.soundManager ?? '';
              if (String(value).trim() !== (current || '').trim()) {
                onSaveSoundEngineer(value);
              }
              setSoundEngineerLocal(null);
            }}
            disabled={soundEngineerSaving}
          />
        ) : (
          <p className={soundEngineerTrimmed ? 'venue-gig-page-sidebar__tech-setup-value' : 'venue-gig-page-sidebar__tech-setup-muted venue-gig-page-sidebar__tech-setup-unassigned'}>
            {soundEngineerTrimmed || 'Not assigned'}
          </p>
        )}
      </section>

      {state === 'unbooked' && (
        <>
          <section className="venue-gig-page-sidebar__section venue-gig-page-sidebar__tech-setup-section">
            <h4 className="venue-gig-page-sidebar__section-title venue-gig-page-sidebar__section-title--primary">
              Venue equipment available
            </h4>
            {headlineEquipment.length > 0 ? (
              <p className="venue-gig-page-sidebar__tech-setup-value">
                {headlineEquipment.join(', ')}
              </p>
            ) : (
              <p className="venue-gig-page-sidebar__tech-setup-muted">
                No venue tech setup added yet
              </p>
            )}
          </section>
        </>
      )}

      {state === 'applicants' && (
        <>
          <section className="venue-gig-page-sidebar__section venue-gig-page-sidebar__tech-setup-section">
            <h4 className="venue-gig-page-sidebar__section-title venue-gig-page-sidebar__section-title--primary">
              Venue equipment available
            </h4>
            {headlineEquipment.length > 0 ? (
              <p className="venue-gig-page-sidebar__tech-setup-value">
                {headlineEquipment.join(', ')}
              </p>
            ) : (
              <p className="venue-gig-page-sidebar__tech-setup-muted">
                No venue tech setup added yet
              </p>
            )}
          </section>
        </>
      )}

      {state === 'booked' && (
        <>
          <section className="venue-gig-page-sidebar__section venue-gig-page-sidebar__tech-setup-section">
            <h4 className="venue-gig-page-sidebar__section-title venue-gig-page-sidebar__section-title--primary">
              Venue equipment in use
            </h4>
            {(() => {
              // Prefer tech setup saved when gig was confirmed; only use live booker data when no saved snapshot.
              const venueEquipmentList = (isVenueHire && usingVenueEquipment.length === 0 && Array.isArray(bookerVenueEquipmentInUse) && bookerVenueEquipmentInUse.length > 0)
                ? bookerVenueEquipmentInUse
                : usingVenueEquipment;
              return venueEquipmentList.length > 0 ? (
              <div className="venue-gig-page-sidebar__tech-setup-equipment-tiles">
                {venueEquipmentList.map((label, i) => {
                  const Icon = getEquipmentIconForLabel(label);
                  return (
                    <span key={i} className="venue-gig-page-sidebar__tech-setup-equipment-tile">
                      {Icon && <Icon className="venue-gig-page-sidebar__tech-setup-equipment-tile-icon" aria-hidden />}
                      <span>{label}</span>
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="venue-gig-page-sidebar__tech-setup-muted">
                No venue equipment selected yet
              </p>
            );
          })()}
          </section>

          {hiredItems.length > 0 && (
            <section className="venue-gig-page-sidebar__section venue-gig-page-sidebar__tech-setup-section">
              <h4 className="venue-gig-page-sidebar__section-title venue-gig-page-sidebar__section-title--primary">
                Hired from venue
              </h4>
              <div className="venue-gig-page-sidebar__tech-setup-equipment-tiles">
                {hiredItems.map((item, i) => {
                  const Icon = getEquipmentIconForLabel(item.label);
                  return (
                    <span key={i} className="venue-gig-page-sidebar__tech-setup-equipment-tile">
                      {Icon && <Icon className="venue-gig-page-sidebar__tech-setup-equipment-tile-icon" aria-hidden />}
                      <span>{item.label}{item.feeDisplay ? ` — ${item.feeDisplay}` : ''}</span>
                    </span>
                  );
                })}
              </div>
              {hasHiredWithFees && (
                <div className="venue-gig-page-sidebar__tech-setup-hire-fees-actions">
                  {equipmentHireFeesPaidState ? (
                    <span className="venue-gig-page-sidebar__badge venue-gig-page-sidebar__badge--paid">Paid</span>
                  ) : (
                    <>
                      {canUpdate && onMarkEquipmentHireFeesPaid && (
                        <button
                          type="button"
                          className="btn tertiary venue-gig-page-sidebar__mark-btn"
                          onClick={() => onMarkEquipmentHireFeesPaid(true)}
                          disabled={equipmentHireFeesUpdating}
                        >
                          Mark as paid
                        </button>
                      )}
                    </>
                  )}
                  {equipmentHireFeesPaidState && canUpdate && onMarkEquipmentHireFeesPaid && (
                    <button
                      type="button"
                      className="btn tertiary venue-gig-page-sidebar__mark-btn"
                      onClick={() => onMarkEquipmentHireFeesPaid(false)}
                      disabled={equipmentHireFeesUpdating}
                    >
                      Mark as unpaid
                    </button>
                  )}
                </div>
              )}
            </section>
          )}

          {missingEquipmentList.length > 0 && (
            <section className="venue-gig-page-sidebar__section venue-gig-page-sidebar__tech-setup-section">
              <h4 className="venue-gig-page-sidebar__section-title venue-gig-page-sidebar__section-title--primary">
                Missing required equipment
              </h4>
              <div className="venue-gig-page-sidebar__tech-setup-equipment-tiles">
                {missingEquipmentList.map((label, i) => {
                  const Icon = getEquipmentIconForLabel(label);
                  return (
                    <span key={i} className="venue-gig-page-sidebar__tech-setup-equipment-tile venue-gig-page-sidebar__tech-setup-equipment-tile--missing">
                      {Icon && <Icon className="venue-gig-page-sidebar__tech-setup-equipment-tile-icon" aria-hidden />}
                      <span>{label}</span>
                    </span>
                  );
                })}
              </div>
              <div className="venue-gig-page-sidebar__tech-setup-hire-fees-actions">
                {missingEquipmentSorted ? (
                  <span className="venue-gig-page-sidebar__badge venue-gig-page-sidebar__badge--paid">Sorted</span>
                ) : null}
                {canUpdate && onMarkMissingEquipmentSorted && (
                  <button
                    type="button"
                    className="btn tertiary venue-gig-page-sidebar__mark-btn"
                    onClick={() => onMarkMissingEquipmentSorted(!missingEquipmentSorted)}
                    disabled={missingEquipmentSortedUpdating}
                  >
                    {missingEquipmentSorted ? 'Mark as not sorted' : 'Mark as sorted'}
                  </button>
                )}
              </div>
            </section>
          )}

          {technicalStatus && (
            <section className="venue-gig-page-sidebar__section venue-gig-page-sidebar__tech-setup-section">
              <h4 className="venue-gig-page-sidebar__section-title venue-gig-page-sidebar__section-title--primary">
                Technical status
              </h4>
              <p className="venue-gig-page-sidebar__tech-setup-value">
                {technicalStatus}
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
