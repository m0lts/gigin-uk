import { useCallback, useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWaveformLines } from '@fortawesome/pro-regular-svg-icons';
import { DownChevronIcon, RightChevronIcon } from '@features/shared/ui/extras/Icons';
import { getVenueProfileById } from '@services/client-side/venues';
import { getArtistProfileById } from '@services/client-side/artists';
import { hasVenuePerm } from '@services/utils/permissions';
import { computeCompatibility } from '@services/utils/techRiderCompatibility';
import { updateVenueHireOpportunity } from '@services/client-side/venueHireOpportunities';
import { updateGigDocument } from '@services/api/gigs';
import { toast } from 'sonner';
import { TechSetupTile } from './TechSetupTile';

/**
 * Gig tech setup tile for the main column (e.g. below Applications).
 * Renders for both venue-hire and artist-booking gigs; writes through to the
 * correct API based on `normalisedGig.bookingMode`.
 */
export function VenueHireTechSetupMainCard({
  rawGig,
  normalisedGig,
  setGigInfo,
  refreshGigs,
  venues,
}) {
  const hireId = rawGig?.id ?? rawGig?.gigId;
  const canUpdate = rawGig?.venueId && hasVenuePerm(venues, rawGig.venueId, 'gigs.update');
  const isVenueHire = normalisedGig?.bookingMode === 'venue_hire';

  const [techSetupExpanded, setTechSetupExpanded] = useState(false);

  const persistGigFields = useCallback(
    async (updates) => {
      if (!hireId) return;
      if (isVenueHire) {
        await updateVenueHireOpportunity(hireId, updates);
      } else {
        await updateGigDocument({ gigId: hireId, action: 'gigs.update', updates });
      }
    },
    [hireId, isVenueHire]
  );

  const [internalNotesSaving, setInternalNotesSaving] = useState(false);
  const [equipmentHireFeesUpdating, setEquipmentHireFeesUpdating] = useState(false);
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

  const saveSoundManager = useCallback(async (value) => {
    if (!canUpdate || !hireId) return;
    const trimmed = value != null ? String(value).trim() : '';
    const current = rawGig?.soundManager ?? '';
    if (trimmed === (current || '').trim()) return;
    setInternalNotesSaving(true);
    try {
      await persistGigFields({ soundManager: trimmed || null });
      setGigInfo?.((prev) => (prev ? { ...prev, soundManager: trimmed || null } : null));
      refreshGigs?.();
      toast.success('Saved.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save.');
    } finally {
      setInternalNotesSaving(false);
    }
  }, [hireId, rawGig?.soundManager, canUpdate, setGigInfo, refreshGigs, persistGigFields]);

  const markEquipmentHireFeesPaid = useCallback(async (paid) => {
    if (!hireId || !canUpdate) return;
    setEquipmentHireFeesUpdating(true);
    try {
      await persistGigFields({ equipmentHireFeesPaid: paid });
      setGigInfo?.((prev) => (prev ? { ...prev, equipmentHireFeesPaid: paid } : null));
      refreshGigs?.();
      toast.success(paid ? 'Equipment hire fees marked as paid.' : 'Equipment hire fees marked as unpaid.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update.');
    } finally {
      setEquipmentHireFeesUpdating(false);
    }
  }, [hireId, canUpdate, setGigInfo, refreshGigs, persistGigFields]);

  const markMissingEquipmentSorted = useCallback(async (sorted) => {
    if (!hireId || !canUpdate) return;
    setMissingEquipmentSortedUpdating(true);
    try {
      await persistGigFields({ missingEquipmentSorted: sorted });
      setGigInfo?.((prev) => (prev ? { ...prev, missingEquipmentSorted: sorted } : null));
      refreshGigs?.();
      toast.success(sorted ? 'Marked as sorted.' : 'Marked as not sorted.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update.');
    } finally {
      setMissingEquipmentSortedUpdating(false);
    }
  }, [hireId, canUpdate, setGigInfo, refreshGigs, persistGigFields]);

  if (!hireId) return null;

  return (
    <div
      className={`venue-gig-page-sidebar__card venue-hire-main-column__tech-setup${techSetupExpanded ? '' : ' venue-hire-main-column__tech-setup--collapsed'}`}
    >
      <button
        type="button"
        className="venue-hire-main-column__tech-setup-expand-trigger fill-this-slot__header fill-this-slot__header--invite-promoter"
        onClick={() => setTechSetupExpanded((o) => !o)}
        aria-expanded={techSetupExpanded}
        aria-controls="venue-hire-tech-setup-panel"
        id="venue-hire-tech-setup-expand-label"
      >
        <span className="venue-hire-main-column__tech-setup-expand-title-row fill-this-slot__header fill-this-slot__header--invite-promoter">
          <FontAwesomeIcon
            icon={faWaveformLines}
            className="icon venue-hire-main-column__tech-setup-title-icon"
            aria-hidden
          />
          <h3 className="fill-this-slot__title fill-this-slot__title--invite-promoter">Tech Setup</h3>
        </span>
        <span className="venue-hire-main-column__tech-setup-expand-chevron" aria-hidden>
          {techSetupExpanded ? <DownChevronIcon /> : <RightChevronIcon />}
        </span>
      </button>
      {techSetupExpanded ? (
        <div id="venue-hire-tech-setup-panel" role="region" aria-labelledby="venue-hire-tech-setup-expand-label">
          <TechSetupTile
            rawGig={rawGig}
            normalisedGig={normalisedGig}
            venueTechRider={venueProfile?.techRider}
            canUpdate={canUpdate}
            onSaveSoundEngineer={saveSoundManager}
            soundEngineerSaving={internalNotesSaving}
            equipmentHireFeesPaid={rawGig?.equipmentHireFeesPaid}
            onMarkEquipmentHireFeesPaid={markEquipmentHireFeesPaid}
            equipmentHireFeesUpdating={equipmentHireFeesUpdating}
            missingEquipmentSortedUpdating={missingEquipmentSortedUpdating}
            missingEquipmentSorted={rawGig?.missingEquipmentSorted}
            onMarkMissingEquipmentSorted={markMissingEquipmentSorted}
            bookerVenueEquipmentInUse={bookerVenueEquipmentInUse}
          />
        </div>
      ) : null}
    </div>
  );
}
