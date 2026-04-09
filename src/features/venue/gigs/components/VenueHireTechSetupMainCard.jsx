import React, { useCallback, useEffect, useState } from 'react';
import { getVenueProfileById } from '@services/client-side/venues';
import { getArtistProfileById } from '@services/client-side/artists';
import { hasVenuePerm } from '@services/utils/permissions';
import { computeCompatibility } from '@services/utils/techRiderCompatibility';
import { updateVenueHireOpportunity } from '@services/client-side/venueHireOpportunities';
import { toast } from 'sonner';
import { TechRiderIcon } from '@features/shared/ui/extras/Icons';
import { TechSetupTile } from './TechSetupTile';

/**
 * Venue hire tech setup tile for the main column (e.g. below Applications).
 * Uses the same data + updates as the former sidebar card.
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
      await updateVenueHireOpportunity(hireId, { soundManager: trimmed || null });
      setGigInfo?.((prev) => (prev ? { ...prev, soundManager: trimmed || null } : null));
      refreshGigs?.();
      toast.success('Saved.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save.');
    } finally {
      setInternalNotesSaving(false);
    }
  }, [hireId, rawGig?.soundManager, canUpdate, setGigInfo, refreshGigs]);

  const markHireFeePaid = useCallback(async (paid) => {
    if (!hireId || !canUpdate) return;
    try {
      await updateVenueHireOpportunity(hireId, { hireFeePaid: paid });
      setGigInfo?.((prev) => (prev ? { ...prev, hireFeePaid: paid } : null));
      refreshGigs?.();
      toast.success(paid ? 'Hire fee marked as paid.' : 'Hire fee marked as unpaid.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update.');
    }
  }, [hireId, canUpdate, setGigInfo, refreshGigs]);

  const markEquipmentHireFeesPaid = useCallback(async (paid) => {
    if (!hireId || !canUpdate) return;
    setEquipmentHireFeesUpdating(true);
    try {
      await updateVenueHireOpportunity(hireId, { equipmentHireFeesPaid: paid });
      setGigInfo?.((prev) => (prev ? { ...prev, equipmentHireFeesPaid: paid } : null));
      refreshGigs?.();
      toast.success(paid ? 'Equipment hire fees marked as paid.' : 'Equipment hire fees marked as unpaid.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update.');
    } finally {
      setEquipmentHireFeesUpdating(false);
    }
  }, [hireId, canUpdate, setGigInfo, refreshGigs]);

  const markMissingEquipmentSorted = useCallback(async (sorted) => {
    if (!hireId || !canUpdate) return;
    setMissingEquipmentSortedUpdating(true);
    try {
      await updateVenueHireOpportunity(hireId, { missingEquipmentSorted: sorted });
      setGigInfo?.((prev) => (prev ? { ...prev, missingEquipmentSorted: sorted } : null));
      refreshGigs?.();
      toast.success(sorted ? 'Marked as sorted.' : 'Marked as not sorted.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update.');
    } finally {
      setMissingEquipmentSortedUpdating(false);
    }
  }, [hireId, canUpdate, setGigInfo, refreshGigs]);

  if (!hireId || normalisedGig?.bookingMode !== 'venue_hire') return null;

  return (
    <div className="venue-gig-page-sidebar__card venue-hire-main-column__tech-setup">
      <div className="fill-this-slot__header fill-this-slot__header--invite-promoter">
        <TechRiderIcon />
        <h3 className="fill-this-slot__title fill-this-slot__title--invite-promoter">Tech Setup</h3>
      </div>
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
  );
}
