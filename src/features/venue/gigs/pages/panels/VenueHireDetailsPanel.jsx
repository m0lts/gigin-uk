import React, { useState, useEffect, useCallback } from 'react';
import Portal from '@features/shared/components/Portal';
import { useAuth } from '@hooks/useAuth';
import { getArtistCRMEntries } from '@services/client-side/artistCRM';
import { updateGigDocument } from '@services/api/gigs';
import { updateVenueHireOpportunity } from '@services/client-side/venueHireOpportunities';
import { hasVenuePerm } from '@services/utils/permissions';
import { toast } from 'sonner';
import { CloseIcon } from '@features/shared/ui/extras/Icons';

/**
 * Shared venue hire full-page panel: Booked by + Performers cards.
 * Supports hireState: 'available' (no hirer), 'pending' (hirer set, not confirmed), 'confirmed'.
 * Performers: only show "On Gigin" when performer is actually linked to a Gigin profile.
 */
export function VenueHireDetailsPanel({
  normalisedGig,
  rawGig,
  setGigInfo,
  venues,
  refreshGigs,
  addPerformersTrigger,
  onAddPerformersOpened,
  onInviteHirer,
  onCopyBookingLink,
  applicationsInviteOnly,
  onApplicationsVisibilityChange,
}) {
  const { user } = useAuth();
  const [crmEntries, setCrmEntries] = useState([]);
  const [crmLoading, setCrmLoading] = useState(false);
  const [showEditBookerModal, setShowEditBookerModal] = useState(false);
  const [editBookerName, setEditBookerName] = useState('');
  const [savingBooker, setSavingBooker] = useState(false);
  const [showAddPerformersModal, setShowAddPerformersModal] = useState(false);
  const [addPerformerQuery, setAddPerformerQuery] = useState('');
  const [addPerformerShowCrmList, setAddPerformerShowCrmList] = useState(false);
  const [addPerformerSelectedIds, setAddPerformerSelectedIds] = useState([]);
  const [addPerformerSaving, setAddPerformerSaving] = useState(false);

  useEffect(() => {
    if (addPerformersTrigger) {
      setShowAddPerformersModal(true);
      onAddPerformersOpened?.();
    }
  }, [addPerformersTrigger, onAddPerformersOpened]);

  const canUpdate = rawGig?.venueId && hasVenuePerm(venues, rawGig.venueId, 'gigs.update');
  const bookedBy = normalisedGig?.bookedBy || {};
  const bookerName = bookedBy.name || (rawGig?.renterName && String(rawGig.renterName).trim()) || null;
  const isBookerGigin = bookedBy.type === 'gigin';
  const rentalStatus = rawGig?.rentalStatus;
  const isConfirmedRental = rentalStatus === 'confirmed_renter';

  /** 'available' = no hirer yet; 'pending' = hirer set but not confirmed; 'confirmed' = confirmed booking */
  const hireState = !bookerName ? 'available' : isConfirmedRental ? 'confirmed' : 'pending';

  const performerItems = normalisedGig?.performers?.items || [];
  const performerCount = performerItems.length;

  useEffect(() => {
    if (!user?.uid) return;
    setCrmLoading(true);
    getArtistCRMEntries(user.uid)
      .then((entries) => setCrmEntries(entries || []))
      .catch(() => setCrmEntries([]))
      .finally(() => setCrmLoading(false));
  }, [user?.uid]);

  const crmNamesById = React.useMemo(() => {
    const map = {};
    (crmEntries || []).forEach((e) => { if (e.id) map[e.id] = e.name || 'Unknown'; });
    return map;
  }, [crmEntries]);

  const performerContactIds = React.useMemo(
    () => new Set(performerItems.filter((p) => p.contactId).map((p) => p.contactId)),
    [performerItems]
  );
  const availableCrmEntries = (crmEntries || []).filter((e) => !e.id || !performerContactIds.has(e.id));
  const queryLower = (addPerformerQuery || '').trim().toLowerCase();
  const filteredCrmEntries = queryLower
    ? availableCrmEntries.filter((e) => (e.name || '').toLowerCase().includes(queryLower))
    : availableCrmEntries;

  const isVenueHire = rawGig?.itemType === 'venue_hire';
  const hireId = rawGig?.id ?? rawGig?.gigId;

  const handleSaveBooker = async () => {
    const name = (editBookerName || '').trim();
    if (!hireId && !rawGig?.gigId) return;
    if (!canUpdate) return;
    setSavingBooker(true);
    try {
      if (isVenueHire) {
        await updateVenueHireOpportunity(hireId, { hirerName: name || null });
        setGigInfo((prev) => (prev ? { ...prev, hirerName: name || null, renterName: name || null } : null));
      } else {
        await updateGigDocument({
          gigId: rawGig.gigId,
          action: 'gigs.update',
          updates: { renterName: name || null },
        });
        setGigInfo((prev) => (prev ? { ...prev, renterName: name || null } : null));
      }
      refreshGigs?.();
      toast.success(name ? 'Hirer updated.' : 'Hirer cleared.');
      setShowEditBookerModal(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update.');
    } finally {
      setSavingBooker(false);
    }
  };

  const getCurrentPerformersForSave = useCallback(() => {
    const list = rawGig?.performers && Array.isArray(rawGig.performers) ? rawGig.performers : null;
    if (list && list.length > 0) return list.map((p) => ({ ...p }));
    const ids = rawGig?.bookedPerformerIds || [];
    const names = rawGig?.bookedPerformerNames || [];
    const fromIds = ids.map((id) => ({ source: 'manual', displayName: crmNamesById[id] || '', contactId: id }));
    const fromNames = names.map((displayName) => ({ source: 'manual', displayName }));
    return [...fromIds, ...fromNames];
  }, [rawGig, crmNamesById]);

  const handleAddPerformerFromTextBox = async () => {
    const name = (addPerformerQuery || '').trim();
    if (!name || (!hireId && !rawGig?.gigId) || !canUpdate) return;
    const current = getCurrentPerformersForSave();
    if (current.some((p) => (p.displayName || '').trim() === name)) {
      toast.info('That performer is already on the gig.');
      return;
    }
    setAddPerformerSaving(true);
    try {
      const newPerformers = [...current, { source: 'manual', displayName: name }];
      const newNames = newPerformers.filter((p) => p.source === 'manual' && !p.contactId).map((p) => p.displayName);
      if (isVenueHire) {
        await updateVenueHireOpportunity(hireId, { performers: newPerformers });
        setGigInfo((prev) => (prev ? { ...prev, performers: newPerformers, bookedPerformerNames: newNames } : null));
      } else {
        await updateGigDocument({
          gigId: rawGig.gigId,
          action: 'gigs.update',
          updates: { performers: newPerformers, bookedPerformerNames: newNames },
        });
        setGigInfo((prev) => (prev ? { ...prev, performers: newPerformers, bookedPerformerNames: newNames } : null));
      }
      refreshGigs?.();
      toast.success(`Added ${name}.`);
      setAddPerformerQuery('');
      setShowAddPerformersModal(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to add performer.');
    } finally {
      setAddPerformerSaving(false);
    }
  };

  const handleAddSelectedFromCrmList = async () => {
    if (addPerformerSelectedIds.length === 0 || (!hireId && !rawGig?.gigId) || !canUpdate) return;
    const current = getCurrentPerformersForSave();
    const toAdd = addPerformerSelectedIds
      .map((id) => {
        const entry = crmEntries.find((e) => e.id === id);
        return entry ? { source: 'manual', displayName: entry.name || '', contactId: id } : null;
      })
      .filter(Boolean);
    const newPerformers = [...current];
    toAdd.forEach((p) => {
      if (!newPerformers.some((existing) => existing.contactId === p.contactId)) newPerformers.push(p);
    });
    const newIds = newPerformers.filter((p) => p.contactId).map((p) => p.contactId);
    setAddPerformerSaving(true);
    try {
      if (isVenueHire) {
        await updateVenueHireOpportunity(hireId, { performers: newPerformers });
        setGigInfo((prev) => (prev ? { ...prev, performers: newPerformers, bookedPerformerIds: newIds } : null));
      } else {
        await updateGigDocument({
          gigId: rawGig.gigId,
          action: 'gigs.update',
          updates: { performers: newPerformers, bookedPerformerIds: newIds },
        });
        setGigInfo((prev) => (prev ? { ...prev, performers: newPerformers, bookedPerformerIds: newIds } : null));
      }
      refreshGigs?.();
      toast.success(`Added ${toAdd.length} performer(s).`);
      setShowAddPerformersModal(false);
      setAddPerformerSelectedIds([]);
    } catch (err) {
      console.error(err);
      toast.error('Failed to add performers.');
    } finally {
      setAddPerformerSaving(false);
    }
  };

  const openEditBooker = () => {
    setEditBookerName(bookerName || '');
    setShowEditBookerModal(true);
  };

  return (
    <>
      <div className="venue-hire-confirmed-panel">
        <div className="venue-hire-confirmed-card">
          <h3 className="venue-hire-confirmed-card__title">Booked by</h3>
          {hireState === 'available' ? (
            <div className="venue-hire-confirmed-card__empty">
              {/* Group 1 — Status */}
              <div className="venue-hire-confirmed-card__group venue-hire-confirmed-card__group--status">
                <div className="venue-hire-confirmed-card__name-row">
                  <p className="venue-hire-confirmed-card__empty-text">No hirer yet</p>
                  <span className="venue-gig-page__status-pill venue-gig-page__status-pill--available">Available</span>
                </div>
              </div>

              {/* Group 2 — Distribution controls */}
              <div className="venue-hire-confirmed-card__group venue-hire-confirmed-card__group--distribution">
                <div className="venue-hire-confirmed-card__actions venue-hire-confirmed-card__actions--cta">
                  {onInviteHirer && (
                    <button type="button" className="btn primary" onClick={onInviteHirer}>
                      Invite hirer
                    </button>
                  )}
                  {onCopyBookingLink && (
                    <button type="button" className="btn secondary" onClick={onCopyBookingLink}>
                      Copy booking link
                    </button>
                  )}
                </div>
                {canUpdate && applicationsInviteOnly != null && onApplicationsVisibilityChange && (
                  <div className="venue-hire-confirmed-card__visibility">
                    <span className="venue-hire-confirmed-card__visibility-label">Open for applications</span>
                    <div className="venue-hire-confirmed-card__visibility-control">
                      <span className={`venue-hire-confirmed-card__visibility-option ${!applicationsInviteOnly ? 'venue-hire-confirmed-card__visibility-option--active' : ''}`}>
                        Yes
                      </span>
                      <div className="gigs-toggle-container venue-hire-confirmed-card__visibility-toggle">
                        <label className="gigs-toggle-switch">
                          <input
                            type="checkbox"
                            checked={!!applicationsInviteOnly}
                            onChange={(e) => onApplicationsVisibilityChange(e.target.checked)}
                          />
                          <span className="gigs-toggle-slider" />
                        </label>
                      </div>
                      <span className={`venue-hire-confirmed-card__visibility-option ${applicationsInviteOnly ? 'venue-hire-confirmed-card__visibility-option--active' : ''}`}>
                        Invite-only
                      </span>
                    </div>
                    {!applicationsInviteOnly && (
                      <p className="venue-hire-confirmed-card__visibility-helper">
                        When enabled, this date appears publicly on your venue profile.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Group 3 — Manual override */}
              <div className="venue-hire-confirmed-card__group venue-hire-confirmed-card__group--operational">
                <span className="venue-hire-confirmed-card__operational-or">Or</span>
                {canUpdate && (
                  <button type="button" className="btn tertiary venue-hire-confirmed-card__add-booker-manually" onClick={openEditBooker}>
                    Add booker manually
                  </button>
                )}
              </div>
            </div>
          ) : hireState === 'pending' ? (
            <>
              <div className="venue-hire-confirmed-card__name-row">
                <p className="venue-hire-confirmed-card__name">{bookerName}</p>
                <span className="venue-gig-page__status-pill venue-gig-page__status-pill--pending">Pending</span>
              </div>
              <p className="venue-hire-confirmed-card__meta">Manually entered</p>
              <div className="venue-hire-confirmed-card__actions">
                {canUpdate && (
                  <button type="button" className="btn secondary" onClick={openEditBooker}>
                    Edit
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="venue-hire-confirmed-card__name-row">
                <p className="venue-hire-confirmed-card__name">{bookerName}</p>
                <span className="venue-gig-page__status-pill venue-gig-page__status-pill--confirmed">Confirmed</span>
              </div>
              <p className="venue-hire-confirmed-card__meta">
                {isBookerGigin ? 'On Gigin' : 'Manually entered'}
              </p>
              <div className="venue-hire-confirmed-card__actions">
                {!isBookerGigin && canUpdate && (
                  <button type="button" className="btn secondary" onClick={openEditBooker}>
                    Edit
                  </button>
                )}
                {isBookerGigin && (
                  <>
                    <button type="button" className="btn secondary" onClick={() => toast.info('Message coming soon.')}>
                      Message
                    </button>
                    <button type="button" className="btn tertiary" onClick={() => toast.info('View profile coming soon.')}>
                      View profile
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {hireState !== 'available' && (
        <div className="venue-hire-confirmed-card">
          <h3 className="venue-hire-confirmed-card__title">Performers ({performerCount})</h3>
          {performerCount === 0 ? (
            <div className="venue-hire-confirmed-card__empty">
              <p className="venue-hire-confirmed-card__empty-text">No performers added</p>
              {canUpdate && (
                <button type="button" className="btn primary" onClick={() => setShowAddPerformersModal(true)}>
                  Add performers
                </button>
              )}
            </div>
          ) : (
            <>
              <ul className="venue-hire-confirmed-performers">
                {performerItems.map((performer, index) => {
                  const displayName = performer.displayName || (performer.contactId ? crmNamesById[performer.contactId] : '') || 'Unknown';
                  const isGigin = performer.source === 'gigin' && (performer.userId || performer.artistId);
                  const tagLabel = isGigin ? 'On Gigin' : performer.contactId ? 'CRM contact' : 'Manual';
                  const key = performer.userId || performer.artistId || performer.contactId || `manual-${index}`;
                  return (
                    <li key={key} className="venue-hire-confirmed-performers__row">
                      <span className="venue-hire-confirmed-performers__name">{displayName}</span>
                      <span className={`venue-hire-confirmed-performers__tag${!isGigin ? ' venue-hire-confirmed-performers__tag--manual' : ''}`}>
                        {tagLabel}
                      </span>
                      {isGigin ? (
                        <button type="button" className="btn tertiary" onClick={() => toast.info('Message coming soon.')}>Message</button>
                      ) : (
                        canUpdate && <button type="button" className="btn tertiary" onClick={() => toast.info('Edit coming soon.')}>Edit</button>
                      )}
                    </li>
                  );
                })}
              </ul>
              {canUpdate && (
                <div className="venue-hire-confirmed-card__actions" style={{ marginTop: 12 }}>
                  <button type="button" className="btn secondary" onClick={() => setShowAddPerformersModal(true)}>
                    Add performers
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        )}
      </div>

      {showEditBookerModal && (
        <Portal>
          <div className="modal" onClick={() => setShowEditBookerModal(false)} role="dialog" aria-modal="true">
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>Booker</h3>
                <button type="button" className="btn icon" onClick={() => setShowEditBookerModal(false)} aria-label="Close">
                  <CloseIcon />
                </button>
              </div>
              <label className="label" style={{ display: 'block', marginBottom: 8 }}>Name</label>
              <input
                type="text"
                className="input"
                value={editBookerName}
                onChange={(e) => setEditBookerName(e.target.value)}
                placeholder="Booker or hirer name"
                style={{ width: '100%', marginBottom: 16 }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn tertiary" onClick={() => setShowEditBookerModal(false)}>Cancel</button>
                <button type="button" className="btn primary" onClick={handleSaveBooker} disabled={savingBooker}>
                  {savingBooker ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {showAddPerformersModal && (
        <Portal>
          <div className="modal" onClick={() => { setShowAddPerformersModal(false); setAddPerformerSelectedIds([]); }} role="dialog" aria-modal="true">
            <div className="modal-content" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>Add performers</h3>
                <button type="button" className="btn icon" onClick={() => setShowAddPerformersModal(false)} aria-label="Close">
                  <CloseIcon />
                </button>
              </div>
              <input
                type="text"
                className="input"
                value={addPerformerQuery}
                onChange={(e) => setAddPerformerQuery(e.target.value)}
                placeholder="Type artist name"
                style={{ width: '100%', marginBottom: 12 }}
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {(addPerformerQuery || '').trim() && (
                  <button type="button" className="btn primary" onClick={handleAddPerformerFromTextBox} disabled={addPerformerSaving}>
                    Add to gig
                  </button>
                )}
                <button type="button" className="btn secondary" onClick={() => setAddPerformerShowCrmList((v) => !v)}>
                  {addPerformerShowCrmList ? 'Hide CRM list' : 'Add from CRM list'}
                </button>
              </div>
              {addPerformerShowCrmList && (
                <div style={{ marginBottom: 12, maxHeight: 220, overflowY: 'auto', border: '1px solid var(--gn-grey-300)', borderRadius: 8, padding: 8 }}>
                  {crmLoading ? (
                    <p style={{ margin: 0, fontSize: 14, color: '#666' }}>Loading…</p>
                  ) : filteredCrmEntries.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 14, color: '#666' }}>
                      {availableCrmEntries.length === 0 ? 'All CRM artists already added or no artists in CRM.' : 'No matching artists.'}
                    </p>
                  ) : (
                    <>
                      <p style={{ margin: '0 0 8px 0', fontSize: 13, color: '#666' }}>Select one or more, then click Add selected.</p>
                      {filteredCrmEntries.map((entry) => (
                        <label key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={addPerformerSelectedIds.includes(entry.id)}
                            onChange={() => {
                              setAddPerformerSelectedIds((prev) =>
                                prev.includes(entry.id) ? prev.filter((id) => id !== entry.id) : [...prev, entry.id]
                              );
                            }}
                          />
                          <span>{entry.name || 'Unknown'}</span>
                        </label>
                      ))}
                      {addPerformerSelectedIds.length > 0 && (
                        <button type="button" className="btn primary" style={{ marginTop: 8 }} onClick={handleAddSelectedFromCrmList} disabled={addPerformerSaving}>
                          Add selected ({addPerformerSelectedIds.length})
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
              <button type="button" className="btn tertiary" onClick={() => setShowAddPerformersModal(false)}>Close</button>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
