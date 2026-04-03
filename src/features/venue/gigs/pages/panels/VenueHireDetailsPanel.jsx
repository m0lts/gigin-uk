import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Portal from '@features/shared/components/Portal';
import { useAuth } from '@hooks/useAuth';
import { createArtistCRMEntry, getArtistCRMEntries } from '@services/client-side/artistCRM';
import { getArtistProfileById } from '@services/client-side/artists';
import { updateGigDocument } from '@services/api/gigs';
import { updateVenueHireOpportunity } from '@services/client-side/venueHireOpportunities';
import { getOrCreateConversation } from '@services/api/conversations';
import { getConversationsByParticipantAndGigId } from '@services/client-side/conversations';
import { getMostRecentMessage, sendGigInvitationMessage } from '@services/client-side/messages';
import { sendGigDeclinedEmail, sendGigInviteEmail } from '@services/client-side/emails';
import { updateDeclinedApplicationMessage } from '@services/api/messages';
import { hasVenuePerm } from '@services/utils/permissions';
import { formatDate } from '@services/utils/dates';
import { openInNewTab } from '@services/utils/misc';
import { toast } from 'sonner';
import { LoadingSpinner } from '@features/shared/ui/loading/Loading';
import { AddPerformersButton, AddPerformersModal } from '@features/venue/components/AddPerformersButtonAndModal';
import { AddToContactsModal } from '@features/venue/components/AddToContactsModal';
import { ContactDetailsModal } from '@features/venue/components/ContactDetailsModal';
import { ApplicantTechSetupModal } from '@features/venue/components/ApplicantTechSetupModal';
import { computeCompatibility } from '@services/utils/techRiderCompatibility';
import { AddressBookIcon, CloseIcon, CopyIcon, DownChevronIcon, EditIcon, InviteIcon, LinkIcon, MessageIcon, MicrophoneIcon, NewTabIcon, ShareIcon, TechRiderIcon, TickIcon, UpChevronIcon } from '@features/shared/ui/extras/Icons';
import '@styles/host/invite-and-share-modal.styles.css';

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
  venueProfile,
  refreshGigs,
  addPerformersTrigger,
  onAddPerformersOpened,
  onInviteHirer,
  onCopyBookingLink,
  bookingLinkUrl,
  applicationsInviteOnly,
  onApplicationsVisibilityChange,
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [linkCopied, setLinkCopied] = useState(false);
  const [crmEntries, setCrmEntries] = useState([]);
  const [crmLoading, setCrmLoading] = useState(false);
  const [hireApplications, setHireApplications] = useState([]);
  const [hireApplicationsLoading, setHireApplicationsLoading] = useState(false);
  const [showEditBookerModal, setShowEditBookerModal] = useState(false);
  const [editBookerName, setEditBookerName] = useState('');
  const [savingBooker, setSavingBooker] = useState(false);
  const [showAddPerformersModal, setShowAddPerformersModal] = useState(false);
  const [addPerformerQuery, setAddPerformerQuery] = useState('');
  const [addPerformerShowCrmList, setAddPerformerShowCrmList] = useState(false);
  const [addPerformerSelectedIds, setAddPerformerSelectedIds] = useState([]);
  const [addPerformerSaving, setAddPerformerSaving] = useState(false);
  /** When set, Add Performers modal is in edit mode for this performer index. */
  const [editingPerformerIndex, setEditingPerformerIndex] = useState(null);
  const [showAddToContactsModal, setShowAddToContactsModal] = useState(false);
  /** Index in performerItems for the performer we're adding to contacts (to link contactId after save). */
  const [addToContactsPerformerIndex, setAddToContactsPerformerIndex] = useState(null);
  const [addToContactsSaving, setAddToContactsSaving] = useState(false);
  /** CRM entry id for the Contact details modal (performers who are in contacts). */
  const [contactModalEntryId, setContactModalEntryId] = useState(null);
  /** For confirmed venue hires: whether the booker applications tile is expanded. */
  const [showApplicationsTile, setShowApplicationsTile] = useState(false);
  /** For unbooked venue hires: active tab in "Fill this slot" (shareable_link | invite_contacts | invite_email). */
  const [fillThisSlotTab, setFillThisSlotTab] = useState('shareable_link');
  /** Invite from Contacts: which contact we're currently inviting; and which we've already invited. */
  const [invitingContactId, setInvitingContactId] = useState(null);
  const [invitedContactIds, setInvitedContactIds] = useState(new Set());
  /** Invite by Email: input value and sending state. */
  const [emailInviteInput, setEmailInviteInput] = useState('');
  const [emailInviteSending, setEmailInviteSending] = useState(false);
  const [emailInviteError, setEmailInviteError] = useState('');
  /** Applications: tech rider modal (artist profile for selected applicant). */
  const [applicationsTechRiderProfile, setApplicationsTechRiderProfile] = useState(null);
  const [applicationsTechRiderLoading, setApplicationsTechRiderLoading] = useState(false);
  /** Applications: which conversation we're accepting (to show loading). */
  const [acceptingApplicationConvId, setAcceptingApplicationConvId] = useState(null);
  /** Applications: which conversation we're declining (to show loading). */
  const [decliningApplicationConvId, setDecliningApplicationConvId] = useState(null);
  /** Applications: conversation ids we've declined this session (show "Declined" instead of Accept/Decline). */
  const [declinedApplicationConvIds, setDeclinedApplicationConvIds] = useState(() => new Set());
  /** Applications: artist profile (name, picture) per conversation id, from getArtistProfileById. */
  const [applicationProfiles, setApplicationProfiles] = useState({});

  useEffect(() => {
    if (addPerformersTrigger) {
      setShowAddPerformersModal(true);
      onAddPerformersOpened?.();
    }
  }, [addPerformersTrigger, onAddPerformersOpened]);

  const canUpdate = rawGig?.venueId && hasVenuePerm(venues, rawGig.venueId, 'gigs.update');
  const bookedBy = normalisedGig?.bookedBy || {};
  const bookerName = bookedBy.name || (rawGig?.renterName && String(rawGig.renterName).trim()) || (rawGig?.hirerName && String(rawGig.hirerName).trim()) || null;
  const isBookerGigin = bookedBy.type === 'gigin';
  const rentalStatus = rawGig?.rentalStatus;
  const hireStatus = rawGig?.status;
  const isConfirmedRental = rentalStatus === 'confirmed_renter' || hireStatus === 'confirmed';

  /** 'available' = no hirer yet; 'confirmed' = has booker (manual or confirmed rental). Manually entered bookers always show as Confirmed. */
  const hireState = !bookerName ? 'available' : (isConfirmedRental || !isBookerGigin) ? 'confirmed' : 'pending';

  /** For confirmed Gigin booker: the conversation with them (for Message button). */
  const bookerConversation = React.useMemo(() => {
    if (!isBookerGigin || !rawGig?.hirerUserId || !Array.isArray(hireApplications) || hireApplications.length === 0) return null;
    return hireApplications.find((conv) => {
      const applicant = conv?.accountNames?.find((a) => a?.role === 'band') || conv?.accountNames?.find((a) => a?.role === 'musician');
      return applicant?.participantId === rawGig.hirerUserId;
    }) || null;
  }, [isBookerGigin, rawGig?.hirerUserId, hireApplications]);

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
  const venueForHire = venues?.find((v) => v.venueId === rawGig?.venueId);
  const venueDisplayName = venueForHire?.accountName || venueForHire?.name || rawGig?.venue?.venueName || 'this venue';

  const inviteContactToHire = useCallback(
    async (entry) => {
      if (!bookingLinkUrl || !entry?.id) return;
      setInvitingContactId(entry.id);
      try {
        const hireDate = normalisedGig?.dateLabel || (rawGig?.date && formatDate(rawGig.date, 'short')) || '';

        if (entry.artistId) {
          const artistProfile = await getArtistProfileById(entry.artistId);
          if (!artistProfile) {
            toast.error('Artist profile not found.');
            return;
          }
          const musicianProfile = {
            musicianId: artistProfile.id,
            id: artistProfile.id,
            name: artistProfile.name,
            genres: artistProfile.genres || [],
            musicianType: 'Musician/Band',
            musicType: artistProfile.genres || [],
            bandProfile: false,
            userId: artistProfile.userId,
          };
          const gigDataForConv = { ...rawGig, gigId: hireId, itemType: 'venue_hire' };
          const { conversationId } = await getOrCreateConversation({
            musicianProfile,
            gigData: gigDataForConv,
            venueProfile: venueForHire,
            type: 'invitation',
          });
          const messageText = `${venueDisplayName} invited you to apply to their venue hire on ${hireDate} at ${venueDisplayName}.`;
          await sendGigInvitationMessage(conversationId, { senderId: user.uid, text: messageText });
          setInvitedContactIds((prev) => new Set(prev).add(entry.id));
          toast.success(`Gigin invite sent to ${artistProfile.name}`);
          refreshGigs?.();
          return;
        }

        const email = (entry.email || '').trim();
        if (!email) {
          toast.error('This contact has no email. Add one in My Artists.');
          return;
        }
        await sendGigInviteEmail({
          to: email,
          userName: user?.name || venueForHire?.accountName || 'The venue',
          venueName: venueDisplayName,
          date: hireDate,
          gigLink: bookingLinkUrl,
          expiresAt: null,
        });
        setInvitedContactIds((prev) => new Set(prev).add(entry.id));
        toast.success(`Invitation sent to ${entry.name || email}`);
        refreshGigs?.();
      } catch (err) {
        console.error(err);
        toast.error('Failed to send invitation.');
      } finally {
        setInvitingContactId(null);
      }
    },
    [bookingLinkUrl, hireId, rawGig, normalisedGig?.dateLabel, user?.uid, venueForHire, venueDisplayName, refreshGigs]
  );

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const sendInviteByEmail = useCallback(async () => {
    const email = (emailInviteInput || '').trim().toLowerCase();
    if (!email) {
      setEmailInviteError('Enter an email address.');
      return;
    }
    if (!emailRegex.test(email)) {
      setEmailInviteError('Enter a valid email address.');
      return;
    }
    if (!bookingLinkUrl) return;
    setEmailInviteError('');
    setEmailInviteSending(true);
    try {
      const hireDate = normalisedGig?.dateLabel || (rawGig?.date && formatDate(rawGig.date, 'short')) || '';
      await sendGigInviteEmail({
        to: email,
        userName: user?.name || venueForHire?.accountName || 'The venue',
        venueName: venueDisplayName,
        date: hireDate,
        gigLink: bookingLinkUrl,
        expiresAt: null,
      });
      toast.success(`Invitation sent to ${email}`);
      setEmailInviteInput('');
      refreshGigs?.();
    } catch (err) {
      console.error(err);
      toast.error('Failed to send invitation.');
    } finally {
      setEmailInviteSending(false);
    }
  }, [emailInviteInput, bookingLinkUrl, normalisedGig?.dateLabel, rawGig?.date, user?.name, venueForHire?.accountName, venueDisplayName, refreshGigs]);

  useEffect(() => {
    if (!isVenueHire || !hireId || !user?.uid) {
      setHireApplications([]);
      return;
    }
    setHireApplicationsLoading(true);
    getConversationsByParticipantAndGigId(hireId, user.uid)
      .then((conversations) => {
        const list = conversations || [];
        setHireApplications(list);
        try {
          localStorage.setItem(`gigin-hire-seen-${hireId}`, String(list.length));
        } catch (_) {}
      })
      .catch(() => setHireApplications([]))
      .finally(() => setHireApplicationsLoading(false));
  }, [isVenueHire, hireId, user?.uid]);

  useEffect(() => {
    if (fillThisSlotTab === 'add_booker_manually') {
      setEditBookerName(bookerName || '');
    }
  }, [fillThisSlotTab, bookerName]);

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

  const handleSaveEditPerformer = async (newName) => {
    if (editingPerformerIndex == null || !newName || (!hireId && !rawGig?.gigId) || !canUpdate) return;
    const current = getCurrentPerformersForSave();
    if (editingPerformerIndex < 0 || editingPerformerIndex >= current.length) return;
    const updated = current.map((p, i) =>
      i === editingPerformerIndex ? { ...p, displayName: newName } : p
    );
    setAddPerformerSaving(true);
    try {
      if (isVenueHire) {
        await updateVenueHireOpportunity(hireId, { performers: updated });
        setGigInfo((prev) => (prev ? { ...prev, performers: updated } : null));
      } else {
        await updateGigDocument({
          gigId: rawGig.gigId,
          action: 'gigs.update',
          updates: { performers: updated },
        });
        setGigInfo((prev) => (prev ? { ...prev, performers: updated } : null));
      }
      refreshGigs?.();
      toast.success('Performer updated.');
      setShowAddPerformersModal(false);
      setAddPerformerQuery('');
      setEditingPerformerIndex(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update performer.');
    } finally {
      setAddPerformerSaving(false);
    }
  };

  const handleRemovePerformer = async () => {
    if (editingPerformerIndex == null || (!hireId && !rawGig?.gigId) || !canUpdate) return;
    const current = getCurrentPerformersForSave();
    if (editingPerformerIndex < 0 || editingPerformerIndex >= current.length) return;
    const updated = current.filter((_, i) => i !== editingPerformerIndex);
    setAddPerformerSaving(true);
    try {
      if (isVenueHire) {
        await updateVenueHireOpportunity(hireId, { performers: updated });
        setGigInfo((prev) => (prev ? { ...prev, performers: updated } : null));
      } else {
        await updateGigDocument({
          gigId: rawGig.gigId,
          action: 'gigs.update',
          updates: { performers: updated },
        });
        setGigInfo((prev) => (prev ? { ...prev, performers: updated } : null));
      }
      refreshGigs?.();
      toast.success('Performer removed.');
      setShowAddPerformersModal(false);
      setAddPerformerQuery('');
      setEditingPerformerIndex(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to remove performer.');
    } finally {
      setAddPerformerSaving(false);
    }
  };

  const handleAddToContactsSave = async (data) => {
    if (!user?.uid || !data.name?.trim()) return;
    setAddToContactsSaving(true);
    try {
      const entryId = await createArtistCRMEntry(user.uid, {
        name: data.name.trim(),
        email: data.email || null,
        phone: data.phone || null,
        instagram: data.instagram || null,
        facebook: data.facebook || null,
        other: data.other || null,
      });
      toast.success('Added to contacts.');
      setShowAddToContactsModal(false);
      const performerIndex = addToContactsPerformerIndex;
      setAddToContactsPerformerIndex(null);
      if (performerIndex != null && performerIndex >= 0 && (hireId || rawGig?.gigId) && canUpdate) {
        const current = getCurrentPerformersForSave();
        if (performerIndex < current.length) {
          const updated = current.map((p, i) =>
            i === performerIndex ? { ...p, contactId: entryId, displayName: data.name.trim() } : p
          );
          if (isVenueHire) {
            await updateVenueHireOpportunity(hireId, { performers: updated });
            setGigInfo((prev) => (prev ? { ...prev, performers: updated } : null));
          } else {
            await updateGigDocument({
              gigId: rawGig.gigId,
              action: 'gigs.update',
              updates: { performers: updated },
            });
            setGigInfo((prev) => (prev ? { ...prev, performers: updated } : null));
          }
          refreshGigs?.();
        }
      }
      const entries = await getArtistCRMEntries(user.uid);
      setCrmEntries(entries);
    } catch (err) {
      console.error(err);
      toast.error('Failed to add to contacts.');
    } finally {
      setAddToContactsSaving(false);
    }
  };

  const copyBookingLink = async () => {
    if (!bookingLinkUrl) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(bookingLinkUrl);
      } else {
        const el = document.createElement('textarea');
        el.value = bookingLinkUrl;
        el.style.position = 'fixed';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
      toast.success('Link copied to clipboard');
    } catch (err) {
      console.error(err);
      toast.error("Couldn't copy link");
    }
  };

  /** Get the applicant (band/musician) account from a venue-hire conversation. */
  const getApplicantFromConversation = useCallback((conv) => {
    if (!conv?.accountNames) return null;
    return (
      conv.accountNames.find((a) => a?.role === 'band') ||
      conv.accountNames.find((a) => a?.role === 'musician') ||
      null
    );
  }, []);

  /** Fetch artist profiles for all applications so we display canonical name and photo. */
  useEffect(() => {
    if (!hireApplications?.length) {
      setApplicationProfiles({});
      return;
    }
    let cancelled = false;
    const byConvId = {};
    Promise.all(
      hireApplications.map(async (conv) => {
        const applicant = conv.accountNames?.find((a) => a?.role === 'band') || conv.accountNames?.find((a) => a?.role === 'musician');
        const participantId = applicant?.participantId;
        if (!participantId) return { convId: conv.id, profile: null };
        try {
          const profile = await getArtistProfileById(participantId);
          return { convId: conv.id, profile };
        } catch {
          return { convId: conv.id, profile: null };
        }
      })
    ).then((results) => {
      if (cancelled) return;
      results.forEach(({ convId, profile }) => {
        if (profile) {
          const picture = profile.picture || profile.heroMedia?.url || null;
          byConvId[convId] = { name: profile.name, picture };
        }
      });
      setApplicationProfiles(byConvId);
    });
    return () => { cancelled = true; };
  }, [hireApplications]);

  const handleAcceptApplication = useCallback(
    async (conv) => {
      if (!hireId || !canUpdate) return;
      const applicant = getApplicantFromConversation(conv);
      const profileData = applicationProfiles[conv.id];
      const name = (profileData?.name || applicant?.accountName || conv?.artistName || '').trim() || null;
      const participantId = applicant?.participantId || null;
      setAcceptingApplicationConvId(conv.id);
      try {
        const updates = {
          hirerName: name,
          hirerUserId: participantId || undefined,
          hirerType: participantId ? 'gigin_user' : 'manual',
          status: 'confirmed',
        };
        if (participantId && venueProfile?.techRider) {
          try {
            const artistProfile = await getArtistProfileById(participantId);
            if (artistProfile?.techRider?.isComplete && artistProfile?.techRider?.lineup?.length > 0) {
              const compat = computeCompatibility(artistProfile.techRider, venueProfile.techRider);
              const usingVenueEquipment = (compat.providedByVenue || []).map((i) => i?.label ?? i).filter(Boolean);
              const hiringFromVenue = (compat.hireableEquipment || []).map((i) =>
                typeof i === 'string' ? { label: i } : { label: i?.label || i, ...(i?.hireFee != null ? { hireFee: i.hireFee } : {}) }
              );
              const needsDiscussion = (compat.needsDiscussion || []).map((i) => {
                const label = i?.label ?? i ?? '';
                const note = i?.note && String(i.note).trim() ? ` — ${i.note}` : '';
                return typeof label === 'string' ? `${label}${note}` : String(label);
              }).filter(Boolean);
              updates.techSetup = {
                usingVenueEquipment,
                hiringFromVenue,
                needsDiscussion,
                compatibilityStatus: needsDiscussion.length > 0 ? 'missing_required' : (hiringFromVenue.length > 0 ? 'compatible_with_hired' : 'fully_compatible'),
              };
            }
          } catch (_) {
            // Non-fatal: accept without tech setup
          }
        }
        await updateVenueHireOpportunity(hireId, updates);
        setGigInfo((prev) =>
          prev ? { ...prev, hirerName: name, renterName: name, rentalStatus: 'confirmed_renter', ...(updates.techSetup ? { techSetup: updates.techSetup } : {}) } : null
        );

        // Auto-decline all other applicants (slot booked with another booker)
        const acceptedParticipantId = participantId;
        const otherConvs = hireApplications.filter((c) => {
          const app = getApplicantFromConversation(c);
          return app?.participantId !== acceptedParticipantId;
        });
        const declinedIds = [];
        for (const otherConv of otherConvs) {
          try {
            const appMessage = await getMostRecentMessage(otherConv.id, 'application');
            if (appMessage?.id) {
              await updateDeclinedApplicationMessage({
                conversationId: otherConv.id,
                originalMessageId: appMessage.id,
                senderId: user.uid,
                userRole: 'venue',
              });
            }
            const otherApplicant = getApplicantFromConversation(otherConv);
            const otherParticipantId = otherApplicant?.participantId || null;
            const otherProfileData = applicationProfiles[otherConv.id] || (otherParticipantId ? await getArtistProfileById(otherParticipantId).catch(() => null) : null);
            const otherMusicianProfileData = otherProfileData
              ? { id: otherProfileData.id, name: otherProfileData.name, email: otherProfileData.email || null, bandProfile: false }
              : { id: otherParticipantId, name: otherApplicant?.accountName || otherConv?.artistName || 'Artist', email: null, bandProfile: false };
            const gigDataForEmail = {
              venue: { venueName: venueDisplayName },
              startDateTime: rawGig?.startDateTime ?? rawGig?.date ?? normalisedGig?.startDateTime,
            };
            await sendGigDeclinedEmail({
              userRole: 'venue',
              venueProfile: venueForHire || null,
              musicianProfile: otherMusicianProfileData,
              gigData: gigDataForEmail,
              declineType: 'application',
              profileType: otherMusicianProfileData?.bandProfile ? 'band' : 'artist',
            });
            declinedIds.push(otherConv.id);
          } catch (e) {
            console.error('Failed to auto-decline application', otherConv.id, e);
          }
        }
        if (declinedIds.length > 0) {
          setDeclinedApplicationConvIds((prev) => new Set([...prev, ...declinedIds]));
        }

        refreshGigs?.();
        toast.success('Application accepted. This slot is now booked.');
      } catch (err) {
        console.error(err);
        toast.error('Failed to accept application.');
      } finally {
        setAcceptingApplicationConvId(null);
      }
    },
    [hireId, canUpdate, getApplicantFromConversation, applicationProfiles, venueProfile, setGigInfo, refreshGigs, hireApplications, user?.uid, venueForHire, venueDisplayName, rawGig, normalisedGig]
  );

  const handleDeclineApplication = useCallback(
    async (conv) => {
      if (!hireId || !canUpdate) return;
      const applicant = getApplicantFromConversation(conv);
      const participantId = applicant?.participantId || null;
      setDecliningApplicationConvId(conv.id);
      try {
        const applicationMessage = await getMostRecentMessage(conv.id, 'application');
        if (applicationMessage?.id) {
          await updateDeclinedApplicationMessage({
            conversationId: conv.id,
            originalMessageId: applicationMessage.id,
            senderId: user.uid,
            userRole: 'venue',
          });
        }
        const profileData = applicationProfiles[conv.id] || (participantId ? await getArtistProfileById(participantId).catch(() => null) : null);
        const musicianProfileData = profileData
          ? { id: profileData.id, name: profileData.name, email: profileData.email || null, bandProfile: false }
          : { id: participantId, name: applicant?.accountName || conv?.artistName || 'Artist', email: null, bandProfile: false };
        const gigDataForEmail = {
          venue: { venueName: venueDisplayName },
          startDateTime: rawGig?.startDateTime ?? rawGig?.date ?? normalisedGig?.startDateTime,
        };
        await sendGigDeclinedEmail({
          userRole: 'venue',
          venueProfile: venueForHire || null,
          musicianProfile: musicianProfileData,
          gigData: gigDataForEmail,
          declineType: 'application',
          profileType: musicianProfileData?.bandProfile ? 'band' : 'artist',
        });
        setDeclinedApplicationConvIds((prev) => new Set(prev).add(conv.id));
        refreshGigs?.();
        toast.success('Application declined.');
      } catch (err) {
        console.error(err);
        toast.error('Failed to decline application.');
      } finally {
        setDecliningApplicationConvId(null);
      }
    },
    [hireId, canUpdate, getApplicantFromConversation, applicationProfiles, user?.uid, venueForHire, venueDisplayName, rawGig, normalisedGig, refreshGigs]
  );

  const openTechRiderForApplication = useCallback(async (participantId) => {
    if (!participantId) return;
    setApplicationsTechRiderLoading(true);
    try {
      const profile = await getArtistProfileById(participantId);
      if (profile?.techRider?.isComplete && profile?.techRider?.lineup?.length > 0) {
        setApplicationsTechRiderProfile(profile);
      } else {
        toast.info('No tech spec available.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not load tech spec.');
    } finally {
      setApplicationsTechRiderLoading(false);
    }
  }, []);

  return (
    <>
      <div className="venue-hire-confirmed-panel">
        <div className="venue-hire-confirmed-card venue-hire-confirmed-panel__booked-by">
          {hireState === 'available' ? (
            <div className="fill-this-slot">
              <div className="fill-this-slot__header">
                <ShareIcon />
                <h3 className="fill-this-slot__title">Fill this slot</h3>
              </div>
              <div className="fill-this-slot__tabs">
                <button
                  type="button"
                  className={`fill-this-slot__tab ${fillThisSlotTab === 'shareable_link' ? 'fill-this-slot__tab--active' : ''}`}
                  onClick={() => setFillThisSlotTab('shareable_link')}
                >
                  <LinkIcon /> Shareable Link
                </button>
                <button
                  type="button"
                  className={`fill-this-slot__tab ${fillThisSlotTab === 'invite_contacts' ? 'fill-this-slot__tab--active' : ''}`}
                  onClick={() => setFillThisSlotTab('invite_contacts')}
                >
                  <AddressBookIcon /> Invite from Contacts
                </button>
                <button
                  type="button"
                  className={`fill-this-slot__tab ${fillThisSlotTab === 'invite_email' ? 'fill-this-slot__tab--active' : ''}`}
                  onClick={() => setFillThisSlotTab('invite_email')}
                >
                  <InviteIcon /> Invite by Email
                </button>
                {canUpdate && (
                  <button
                    type="button"
                    className={`fill-this-slot__tab ${fillThisSlotTab === 'add_booker_manually' ? 'fill-this-slot__tab--active' : ''}`}
                    onClick={() => setFillThisSlotTab('add_booker_manually')}
                  >
                    <EditIcon /> Add booker manually
                  </button>
                )}
              </div>

              {fillThisSlotTab === 'shareable_link' && (
                <div className="fill-this-slot__content">
                  <p className="fill-this-slot__helper fill-this-slot__helper--above-input">
                    Send this link to someone who would be interested in hiring this slot
                  </p>
                  <div className="fill-this-slot__share-row">
                    <input
                      type="text"
                      className="input fill-this-slot__input"
                      value={bookingLinkUrl || ''}
                      readOnly
                      onFocus={(e) => e.target.select()}
                      aria-label="Booking link"
                    />
                    <button
                      type="button"
                      className="btn secondary fill-this-slot__copy-btn"
                      onClick={copyBookingLink}
                    >
                      {linkCopied ? <TickIcon /> : <CopyIcon />} {linkCopied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}
              {fillThisSlotTab === 'invite_contacts' && (
                <div className="fill-this-slot__content">
                  <div className="invite-and-share-modal__list fill-this-slot__contacts-list">
                    {crmLoading ? (
                      <LoadingSpinner />
                    ) : !crmEntries?.length ? (
                      <p className="invite-and-share-modal__empty">No contacts yet. Add artists in My Artists.</p>
                    ) : (
                      crmEntries.map((entry) => {
                        const invited = invitedContactIds.has(entry.id);
                        const inviting = invitingContactId === entry.id;
                        return (
                          <div key={entry.id} className="invite-and-share-modal__row">
                            <div className="invite-and-share-modal__row-info">
                              <span className="invite-and-share-modal__row-name">{entry.name || 'Unknown'}</span>
                              <span className="invite-and-share-modal__row-sub">
                                {entry.artistId ? 'On Gigin' : entry.email || 'No email'}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="btn tertiary invite-and-share-modal__row-btn"
                              onClick={() => inviteContactToHire(entry)}
                              disabled={invited || inviting}
                            >
                              {invited ? <><TickIcon /> Invited</> : inviting ? 'Inviting…' : 'Invite'}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
              {fillThisSlotTab === 'invite_email' && (
                <div className="fill-this-slot__content">
                  <div className="fill-this-slot__share-row">
                    <input
                      type="email"
                      className="input fill-this-slot__input"
                      placeholder="Email address"
                      value={emailInviteInput}
                      onChange={(e) => { setEmailInviteInput(e.target.value); setEmailInviteError(''); }}
                      onKeyDown={(e) => e.key === 'Enter' && sendInviteByEmail()}
                      aria-label="Email address"
                      aria-invalid={!!emailInviteError}
                    />
                    <button
                      type="button"
                      className="btn secondary fill-this-slot__copy-btn"
                      onClick={sendInviteByEmail}
                      disabled={emailInviteSending}
                    >
                      {emailInviteSending ? 'Sending…' : <><InviteIcon /> Invite</>}
                    </button>
                  </div>
                  {emailInviteError && (
                    <p className="fill-this-slot__helper fill-this-slot__helper--above-input" style={{ color: 'var(--gn-red-800)', marginTop: 6 }}>
                      {emailInviteError}
                    </p>
                  )}
                </div>
              )}
              {fillThisSlotTab === 'add_booker_manually' && (
                <div className="fill-this-slot__content">
                  <div className="fill-this-slot__share-row">
                    <input
                      type="text"
                      className="input fill-this-slot__input"
                      placeholder="Booker or hirer name"
                      value={editBookerName}
                      onChange={(e) => setEditBookerName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveBooker()}
                      aria-label="Booker name"
                    />
                    <button
                      type="button"
                      className="btn secondary fill-this-slot__copy-btn"
                      onClick={handleSaveBooker}
                      disabled={savingBooker}
                    >
                      {savingBooker ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : hireState === 'pending' ? (
            <>
              <h3 className="venue-hire-confirmed-card__title venue-hire-confirmed-panel__booked-by-title">
                <span className="venue-hire-confirmed-card__title-inner">Booked by</span>
              </h3>
              <div className="venue-hire-confirmed-card__name-row">
                <p className="venue-hire-confirmed-card__name">{bookerName}</p>
                <span className="venue-gig-page__status-pill venue-gig-page__status-pill--pending">Pending</span>
              </div>
              <div className="venue-hire-confirmed-card__meta-row">
                <span className="venue-hire-confirmed-card__meta">{isBookerGigin ? 'On Gigin' : 'Manually entered'}</span>
                {!isBookerGigin && canUpdate && (
                  <button type="button" className="venue-hire-confirmed-card__edit-link" onClick={openEditBooker}>
                    Edit
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <h3 className="venue-hire-confirmed-card__title venue-hire-confirmed-panel__booked-by-title">
                <span className="venue-hire-confirmed-card__title-inner">Booked by</span>
              </h3>
              <div className="venue-hire-confirmed-card__name-row">
                <p className="venue-hire-confirmed-card__name">{bookerName}</p>
              </div>
              <div className="venue-hire-confirmed-card__meta-row">
                <span className="venue-hire-confirmed-card__meta">
                  {isBookerGigin ? 'On Gigin' : 'Manually entered'}
                </span>
                {!isBookerGigin && canUpdate && (
                  <button type="button" className="venue-hire-confirmed-card__edit-link" onClick={openEditBooker}>
                    Edit
                  </button>
                )}
              </div>
              {isBookerGigin && (
                <div className="venue-hire-confirmed-card__actions">
                  {bookerConversation ? (
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => navigate(`/venues/dashboard/messages?conversationId=${bookerConversation.id}`)}
                    >
                      Message
                    </button>
                  ) : null}
                  {rawGig?.hirerUserId && (
                    <button
                      type="button"
                      className="btn tertiary"
                      onClick={(e) => openInNewTab(`/artist/${rawGig.hirerUserId}`, e)}
                    >
                      <NewTabIcon /> View profile
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Performers first for confirmed/pending venue hires */}
        {hireState !== 'available' && (
        <div className="venue-hire-performers">
          <div className="venue-hire-confirmed-card venue-hire-performers__card">
            <h3 className="venue-hire-confirmed-card__title">
              <span className="venue-hire-confirmed-card__title-inner">Performers ({performerCount})</span>
            </h3>
          {performerCount === 0 ? (
            <div className="venue-hire-performers__empty">
              <div className="venue-hire-confirmed-card__empty">
                {canUpdate && (
                  <AddPerformersButton
                    onClick={() => {
                      setAddPerformerQuery('');
                      setAddPerformerShowCrmList(false);
                      setAddPerformerSelectedIds([]);
                      setShowAddPerformersModal(true);
                    }}
                  />
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="venue-hire-performer-tiles">
                {performerItems.map((performer, index) => {
                  const displayName = performer.displayName || (performer.contactId ? crmNamesById[performer.contactId] : '') || 'Unknown';
                  const isGigin = performer.source === 'gigin' && (performer.userId || performer.artistId);
                  const secondaryText = isGigin ? 'On Gigin' : (performer.contactId ? 'CRM contact' : 'Manually entered');
                  const key = performer.userId || performer.artistId || performer.contactId || `manual-${index}`;
                  const isInContacts = !!performer.contactId;
                  return (
                    <div key={key} className="venue-hire-performer-tile">
                      <div className="venue-hire-performer-tile__left">
                        <span className="venue-hire-performer-tile__name">{displayName}</span>
                        <div className="venue-hire-performer-tile__meta-row">
                          <span className="venue-hire-performer-tile__meta">{secondaryText}</span>
                          {!isInContacts && canUpdate && (
                            <button
                              type="button"
                              className="venue-hire-performer-tile__edit-link"
                              onClick={() => {
                                setEditingPerformerIndex(index);
                                setAddPerformerQuery(displayName);
                                setAddPerformerShowCrmList(false);
                                setAddPerformerSelectedIds([]);
                                setShowAddPerformersModal(true);
                              }}
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="venue-hire-performer-tile__actions">
                        {isInContacts ? (
                          <button
                            type="button"
                            className="btn tertiary venue-hire-performer-tile__btn"
                            onClick={() => setContactModalEntryId(performer.contactId)}
                          >
                            Contact
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn tertiary venue-hire-performer-tile__btn"
                            onClick={() => {
                              setAddToContactsPerformerIndex(index);
                              setShowAddToContactsModal(true);
                            }}
                          >
                            Add to contacts
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {canUpdate && (
                <div className="venue-hire-performers__add-wrap">
                  <AddPerformersButton
                    onClick={() => {
                      setAddPerformerQuery('');
                      setAddPerformerShowCrmList(false);
                      setAddPerformerSelectedIds([]);
                      setShowAddPerformersModal(true);
                    }}
                  />
                </div>
              )}
            </>
          )}
          </div>
        </div>
        )}

        {/* Applications: for confirmed hires, one card with title + toggle; content expands below */}
        {isVenueHire && hireId && hireState === 'confirmed' && (
          <div className="venue-hire-confirmed-card venue-hire-confirmed-panel__applications">
            <button
              type="button"
              className="venue-hire-confirmed-panel__applications-header"
              onClick={() => setShowApplicationsTile((v) => !v)}
              aria-expanded={showApplicationsTile}
            >
              <span className="venue-hire-confirmed-panel__applications-header-inner">
                <h3 className="venue-hire-confirmed-card__title venue-hire-confirmed-panel__applications-title">
                  <span className="venue-hire-confirmed-card__title-inner">
                    <MessageIcon /> Applications ({hireApplicationsLoading ? '…' : hireApplications.length})
                  </span>
                </h3>
                {showApplicationsTile ? <UpChevronIcon className="venue-hire-confirmed-panel__see-applications-chevron" aria-hidden /> : <DownChevronIcon className="venue-hire-confirmed-panel__see-applications-chevron" aria-hidden />}
              </span>
            </button>
            {showApplicationsTile && (
              <div className="venue-hire-confirmed-panel__applications-body">
                {canUpdate && applicationsInviteOnly != null && onApplicationsVisibilityChange && (
                  <div className="venue-hire-confirmed-panel__applications-open-tile">
                    <div className="venue-hire-confirmed-card__visibility">
                      <span className="venue-hire-confirmed-card__visibility-label">Open for applications</span>
                      <div className="venue-hire-confirmed-card__visibility-control">
                        <span className={`venue-hire-confirmed-card__visibility-option ${applicationsInviteOnly ? 'venue-hire-confirmed-card__visibility-option--active' : ''}`}>
                          Invite-only
                        </span>
                        <div className="gigs-toggle-container venue-hire-confirmed-card__visibility-toggle">
                          <label className="gigs-toggle-switch">
                            <input
                              type="checkbox"
                              checked={!applicationsInviteOnly}
                              onChange={(e) => onApplicationsVisibilityChange(!e.target.checked)}
                            />
                            <span className="gigs-toggle-slider" />
                          </label>
                        </div>
                        <span className={`venue-hire-confirmed-card__visibility-option ${!applicationsInviteOnly ? 'venue-hire-confirmed-card__visibility-option--active' : ''}`}>
                          Yes
                        </span>
                      </div>
                      {!applicationsInviteOnly && (
                        <p className="venue-hire-confirmed-card__visibility-helper">
                          When enabled, this date appears publicly on your{' '}
                          <a
                            href={rawGig?.venueId ? `/venues/${rawGig.venueId}` : undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="venue-hire-confirmed-card__visibility-helper-link"
                            onClick={(e) => !rawGig?.venueId && e.preventDefault()}
                          >
                            venue profile
                          </a>
                          .
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {hireApplicationsLoading ? (
                  <p className="venue-hire-confirmed-card__empty-text">Loading…</p>
                ) : hireApplications.length === 0 ? (
                  <p className="venue-hire-confirmed-card__empty-text">Bookers applying to book this slot will show here</p>
                ) : (
                  <div className="venue-hire-application-tiles">
                    {hireApplications.map((conv) => {
                      const applicant = getApplicantFromConversation(conv);
                      const profileData = applicationProfiles[conv.id];
                      const name = (profileData?.name || applicant?.accountName || conv?.artistName || 'Artist').trim() || 'Artist';
                      const photoUrl = profileData?.picture || applicant?.musicianImg || applicant?.accountImg;
                      const participantId = applicant?.participantId;
                      const isBooker = participantId && rawGig?.hirerUserId && participantId === rawGig.hirerUserId;
                      const isDeclinedOther = !isBooker;
                      return (
                        <div key={conv.id} className="venue-hire-application-tile">
                          <div className="venue-hire-application-tile__photo">
                            {photoUrl ? (
                              <img src={photoUrl} alt="" className="venue-hire-application-tile__img" />
                            ) : (
                              <MicrophoneIcon />
                            )}
                          </div>
                          <div className="venue-hire-application-tile__main">
                            <span className="venue-hire-application-tile__name">{name}</span>
                            <div className="venue-hire-application-tile__actions">
                              {participantId && (
                                <button
                                  type="button"
                                  className="btn tertiary venue-hire-application-tile__btn"
                                  onClick={() => openTechRiderForApplication(participantId)}
                                  disabled={applicationsTechRiderLoading}
                                >
                                  <TechRiderIcon /> Tech setup
                                </button>
                              )}
                              {participantId && (
                                <button
                                  type="button"
                                  className="btn tertiary venue-hire-application-tile__btn"
                                  onClick={(e) => openInNewTab(`/artist/${participantId}`, e)}
                                >
                                  <NewTabIcon /> View profile
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn secondary venue-hire-application-tile__btn"
                                onClick={() => navigate(`/venues/dashboard/messages?conversationId=${conv.id}`)}
                              >
                                Message
                              </button>
                              {isBooker && (
                                <span className="venue-gig-page__hire-booking-pill venue-gig-page__hire-booking-pill--confirmed">Confirmed</span>
                              )}
                              {isDeclinedOther && (
                                <span className="venue-hire-application-tile__status venue-hire-application-tile__status--declined">Declined</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {isVenueHire && hireId && hireState !== 'confirmed' && (
          <div className="venue-hire-confirmed-card venue-hire-confirmed-panel__applications">
            <h3 className="venue-hire-confirmed-card__title">
              <span className="venue-hire-confirmed-card__title-inner">
                <MessageIcon /> Applications ({hireApplicationsLoading ? '…' : hireApplications.length})
              </span>
            </h3>
            {canUpdate && applicationsInviteOnly != null && onApplicationsVisibilityChange && (
              <div className="venue-hire-confirmed-panel__applications-open-tile">
                <div className="venue-hire-confirmed-card__visibility">
                  <span className="venue-hire-confirmed-card__visibility-label">Open for applications</span>
                  <div className="venue-hire-confirmed-card__visibility-control">
                    <span className={`venue-hire-confirmed-card__visibility-option ${applicationsInviteOnly ? 'venue-hire-confirmed-card__visibility-option--active' : ''}`}>
                      Invite-only
                    </span>
                    <div className="gigs-toggle-container venue-hire-confirmed-card__visibility-toggle">
                      <label className="gigs-toggle-switch">
                        <input
                          type="checkbox"
                          checked={!applicationsInviteOnly}
                          onChange={(e) => onApplicationsVisibilityChange(!e.target.checked)}
                        />
                        <span className="gigs-toggle-slider" />
                      </label>
                    </div>
                    <span className={`venue-hire-confirmed-card__visibility-option ${!applicationsInviteOnly ? 'venue-hire-confirmed-card__visibility-option--active' : ''}`}>
                      Yes
                    </span>
                  </div>
                  {!applicationsInviteOnly && (
                    <p className="venue-hire-confirmed-card__visibility-helper">
                      When enabled, this date appears publicly on your{' '}
                      <a
                        href={rawGig?.venueId ? `/venues/${rawGig.venueId}` : undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="venue-hire-confirmed-card__visibility-helper-link"
                        onClick={(e) => !rawGig?.venueId && e.preventDefault()}
                      >
                        venue profile
                      </a>
                      .
                    </p>
                  )}
                </div>
              </div>
            )}
            {hireApplicationsLoading ? (
              <p className="venue-hire-confirmed-card__empty-text">Loading…</p>
            ) : hireApplications.length === 0 ? (
              <p className="venue-hire-confirmed-card__empty-text">Bookers applying to book this slot will show here</p>
            ) : (
              <div className="venue-hire-application-tiles">
                {hireApplications.map((conv) => {
                  const applicant = getApplicantFromConversation(conv);
                  const profileData = applicationProfiles[conv.id];
                  const name = (profileData?.name || applicant?.accountName || conv?.artistName || 'Artist').trim() || 'Artist';
                  const photoUrl = profileData?.picture || applicant?.musicianImg || applicant?.accountImg;
                  const participantId = applicant?.participantId;
                  const isAccepting = acceptingApplicationConvId === conv.id;
                  return (
                    <div key={conv.id} className="venue-hire-application-tile">
                      <div className="venue-hire-application-tile__photo">
                        {photoUrl ? (
                          <img src={photoUrl} alt="" className="venue-hire-application-tile__img" />
                        ) : (
                          <MicrophoneIcon />
                        )}
                      </div>
                      <div className="venue-hire-application-tile__main">
                        <span className="venue-hire-application-tile__name">{name}</span>
                        <div className="venue-hire-application-tile__actions">
                          {participantId && (
                            <button
                              type="button"
                              className="btn tertiary venue-hire-application-tile__btn"
                              onClick={() => openTechRiderForApplication(participantId)}
                              disabled={applicationsTechRiderLoading}
                            >
                              <TechRiderIcon /> Tech setup
                            </button>
                          )}
                          {participantId && (
                            <button
                              type="button"
                              className="btn tertiary venue-hire-application-tile__btn"
                              onClick={(e) => openInNewTab(`/artist/${participantId}`, e)}
                            >
                              <NewTabIcon /> View profile
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn secondary venue-hire-application-tile__btn"
                            onClick={() => navigate(`/venues/dashboard/messages?conversationId=${conv.id}`)}
                          >
                            Message
                          </button>
                          {declinedApplicationConvIds.has(conv.id) ? (
                            <span className="venue-hire-application-tile__status venue-hire-application-tile__status--declined">Declined</span>
                          ) : (
                            <>
                              {canUpdate && (
                                <button
                                  type="button"
                                  className="btn accept venue-hire-application-tile__btn"
                                  onClick={() => handleAcceptApplication(conv)}
                                  disabled={isAccepting}
                                >
                                  {isAccepting ? 'Accepting…' : 'Accept'}
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn danger venue-hire-application-tile__btn"
                                onClick={() => handleDeclineApplication(conv)}
                                disabled={decliningApplicationConvId === conv.id}
                              >
                                {decliningApplicationConvId === conv.id ? (
                                  <><LoadingSpinner width={14} height={14} /> Declining…</>
                                ) : (
                                  'Decline'
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {applicationsTechRiderProfile && (
        <ApplicantTechSetupModal
          techRider={applicationsTechRiderProfile.techRider}
          artistName={applicationsTechRiderProfile.name}
          venueTechRider={venueForHire?.techRider || null}
          application={hireState === 'confirmed' && rawGig?.techSetup ? { techSetup: rawGig.techSetup } : null}
          onClose={() => setApplicationsTechRiderProfile(null)}
        />
      )}

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

      <AddPerformersModal
        isOpen={showAddPerformersModal}
        onClose={() => {
          setShowAddPerformersModal(false);
          setAddPerformerQuery('');
          setAddPerformerShowCrmList(false);
          setAddPerformerSelectedIds([]);
          setEditingPerformerIndex(null);
        }}
        addPerformerQuery={addPerformerQuery}
        setAddPerformerQuery={setAddPerformerQuery}
        addPerformerShowCrmList={addPerformerShowCrmList}
        setAddPerformerShowCrmList={setAddPerformerShowCrmList}
        addPerformerSelectedIds={addPerformerSelectedIds}
        toggleCrmSelection={(entryId) =>
          setAddPerformerSelectedIds((prev) =>
            prev.includes(entryId) ? prev.filter((id) => id !== entryId) : [...prev, entryId]
          )
        }
        addPerformerSaving={addPerformerSaving}
        onAddFromTextBox={handleAddPerformerFromTextBox}
        onAddFromCrmList={handleAddSelectedFromCrmList}
        crmLoading={crmLoading}
        filteredCrmEntries={filteredCrmEntries}
        noCrmMessage={
          availableCrmEntries.length === 0 && crmEntries.length > 0
            ? 'All CRM artists are already added.'
            : 'No artists in CRM yet.'
        }
        editMode={editingPerformerIndex !== null}
        onSaveEdit={handleSaveEditPerformer}
        onRemoveEdit={handleRemovePerformer}
      />
      <AddToContactsModal
        isOpen={showAddToContactsModal}
        onClose={() => {
          setShowAddToContactsModal(false);
          setAddToContactsPerformerIndex(null);
        }}
        initialName={
          addToContactsPerformerIndex != null && performerItems[addToContactsPerformerIndex] != null
            ? (performerItems[addToContactsPerformerIndex].displayName ||
                (performerItems[addToContactsPerformerIndex].contactId ? crmNamesById[performerItems[addToContactsPerformerIndex].contactId] : '') ||
                '')
            : ''
        }
        onSave={handleAddToContactsSave}
        saving={addToContactsSaving}
      />
      <ContactDetailsModal
        isOpen={contactModalEntryId != null}
        onClose={() => setContactModalEntryId(null)}
        entry={crmEntries.find((e) => e.id === contactModalEntryId) || null}
      />
    </>
  );
}
