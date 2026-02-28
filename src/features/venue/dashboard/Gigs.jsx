import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTable, faWifi } from '@fortawesome/pro-solid-svg-icons';
import { 
    ClockIcon,
    DotIcon,
    PreviousIcon,
    TickIcon,
CloseIcon, RightArrowIcon } from '@features/shared/ui/extras/Icons';
import { CalendarIconSolid, CancelIcon, DeleteGigIcon, DeleteGigsIcon, DeleteIcon, DuplicateGigIcon, EditIcon, ErrorIcon, ExclamationIcon, ExclamationIconSolid, FilterIconEmpty, GigIcon, LinkIcon, MicrophoneIcon, MicrophoneIconSolid, NewTabIcon, OptionsIcon, SearchIcon, ShieldIcon, TemplateIcon, InviteIcon, InviteIconSolid } from '../../shared/ui/extras/Icons';
import { deleteGigsBatch } from '@services/client-side/gigs';
import { deleteVenueHireOpportunity } from '@services/client-side/venueHireOpportunities';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { openInNewTab } from '../../../services/utils/misc';
import { getVenueProfileById } from '../../../services/client-side/venues';
import Portal from '../../shared/components/Portal';
import { LoadingModal } from '../../shared/ui/loading/LoadingModal';
import { cancelGigAndRefund } from '@services/api/payments';
import { getOrCreateConversation } from '@services/api/conversations';
import { postCancellationMessage } from '@services/api/messages';
import { getMusicianProfileByMusicianId, getArtistProfileById } from '../../../services/client-side/artists';
import { toJsDate } from '../../../services/utils/dates';
import { getLocalGigDateTime } from '../../../services/utils/filtering';
import { hasVenuePerm } from '../../../services/utils/permissions';
import { duplicateGig, updateGigDocument } from '@services/api/gigs';
import { saveGigTemplate } from '@services/api/venues';
import { cancelledGigMusicianProfileUpdate } from '@services/api/artists';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import { logGigCancellation, revertGigAfterCancellationVenue } from '../../../services/api/gigs';
import { GigInvitesModal } from '../components/GigInvitesModal';
import { GigsCalendarReact } from './GigsCalendarReact';
import { getCalendarFeedUrl } from '@services/api/calendar';


function getLocalHireDateTime(hire) {
  const v = hire?.date ?? hire?.startDateTime;
  if (!v) return null;
  if (typeof v?.toDate === 'function') return v.toDate();
  if (Number.isFinite(v?.seconds)) return new Date(v.seconds * 1000);
  if (typeof v === 'string') { const d = new Date(v); return isNaN(d.getTime()) ? null : d; }
  if (typeof v === 'number') return new Date(v);
  return null;
}

export const Gigs = ({ gigs, venueHireOpportunities = [], venues, setGigPostModal, setEditGigData, setShowAddGigsModal, setAddGigsEditData, setAddGigsInitialDateIso, requests, setRequests, user, refreshGigs }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const {isMdUp, isLgUp, isXlUp} = useBreakpoint();
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState('asc');
    const [selectedGigs, setSelectedGigs] = useState([]);
    const [confirmModal, setConfirmModal] = useState(false);
    const [confirmMessage, setConfirmMessage] = useState('');
    const [confirmType, setConfirmType] = useState('');
    const [openOptionsGigId, setOpenOptionsGigId] = useState(null);
    const [gigsView, setGigsView] = useState('react'); // 'table' | 'react' (react = calendar view)
    const [cancellationReason, setCancellationReason] = useState({
      reason: '',
      extraDetails: '',
    });
    const [loading, setLoading] = useState(false);
    const [editingSoundManager, setEditingSoundManager] = useState(null);
    const [soundManagerValue, setSoundManagerValue] = useState('');
    const [soundManagerPosition, setSoundManagerPosition] = useState({ top: 0, left: 0 });
    const [editingNotes, setEditingNotes] = useState(null);
    const [notesValue, setNotesValue] = useState('');
    const [notesPosition, setNotesPosition] = useState({ top: 0, left: 0 });
    const [showInvitesModal, setShowInvitesModal] = useState(false);
    const [selectedGigForInvites, setSelectedGigForInvites] = useState(null);
    const [showSubscribeModal, setShowSubscribeModal] = useState(false);
    const [calendarFeedUrl, setCalendarFeedUrl] = useState(null);
    const [subscribeLoading, setSubscribeLoading] = useState(false);

    const toggleOptionsMenu = (gigId) => {
        setOpenOptionsGigId(prev => (prev === gigId ? null : gigId));
    };

    const closeOptionsMenu = () => {
        setOpenOptionsGigId(null);
    };

    const isSelected = (id) => selectedGigs.includes(id);

    const toggleGigSelection = (id) => {
        setSelectedGigs((prev) =>
            prev.includes(id) ? prev.filter((gigId) => gigId !== id) : [...prev, id]
        );
    };

    const clearSelection = () => setSelectedGigs([]);

    useEffect(() => {
      const handleClickOutside = (e) => {
        if (!e.target.closest('.options-cell')) {
          setOpenOptionsGigId(null);
        }
      };
      window.addEventListener('click', handleClickOutside);
      return () => window.removeEventListener('click', handleClickOutside);
    }, []);
  
    const [searchParams] = useSearchParams();
    const selectedVenue = searchParams.get('venue') || '';
    const selectedDate = searchParams.get('date') || '';
    const selectedStatus = searchParams.get('status') || 'all';
  
    const now = useMemo(() => new Date(), []);
  
    const normalizedGigs = useMemo(() => {
      return gigs
        .filter((gig) => gig.kind !== 'Venue Rental' && gig.bookingMode !== 'rental')
        .map(gig => {
          const dt = getLocalGigDateTime(gig);
          const isoDate = dt ? dt.toISOString().split('T')[0] : null;
          const confirmedApplicant = gig.applicants?.some(a => a.status === 'confirmed');
          const acceptedApplicant = gig.applicants?.some(a => a.status === 'accepted');
          const inDispute = gig?.disputeLogged;
          let status = 'past';
          if (dt && dt > now) {
            if (confirmedApplicant) status = 'confirmed';
            else if (acceptedApplicant) status = 'awaiting payment';
            else if (gig.status === 'open') status = 'upcoming';
            else status = 'closed';
          } else if (dt && dt < now) {
            if (!!inDispute) status = 'in dispute';
          }
          return {
            ...gig,
            dateObj: dt,
            dateIso: isoDate,
            dateTime: dt,
            status,
          };
        });
    }, [gigs, now]);

    const normalizedHireOpportunities = useMemo(() => {
      return (venueHireOpportunities || []).map((h) => {
        const dt = getLocalHireDateTime(h);
        const isoDate = dt ? dt.toISOString().split('T')[0] : null;
        const hireStatus = h.status ?? 'available';
        let status = 'past';
        if (dt && dt > now) {
          status = hireStatus === 'confirmed' ? 'confirmed' : hireStatus === 'pending' ? 'upcoming' : 'upcoming';
        }
        return {
          ...h,
          itemType: 'venue_hire',
          hireSpaceId: h.id ?? h.hireSpaceId,
          gigId: h.id ?? h.hireSpaceId,
          gigName: 'For Hire',
          dateObj: dt,
          dateIso: isoDate,
          dateTime: dt,
          status,
          startTime: h.startTime ?? '',
          renterName: h.hirerName ?? null,
          rentalAccessFrom: h.accessFrom ?? h.startTime,
          rentalHardCurfew: h.curfew ?? h.endTime,
          private: !!h.private,
          venueId: h.venueId,
        };
      });
    }, [venueHireOpportunities, now]);
  
    const handleSearchChange = (e) => setSearchQuery(e.target.value);
  
    const updateUrlParams = (key, value) => {
      const params = new URLSearchParams(location.search);
      value ? params.set(key, value) : params.delete(key);
      navigate(`?${params.toString()}`);
    };

    // Function to get status display for a gig or group
    const getStatusDisplay = (gig, group) => {
      const dt = gig.dateObj || getLocalGigDateTime(gig);
      const isPast = dt && dt < now;
      
      if (isPast) {
        return {
          statusClass: 'past',
          icon: <PreviousIcon />,
          text: 'Past',
          subText: null
        };
      }

      const applicants = gig.applicants || [];
      const confirmedApplicant = applicants.some(a => a.status === 'confirmed');
      const acceptedApplicant = applicants.some(a => a.status === 'accepted');
      const pendingApplicants = applicants.filter(a => a.status === 'pending');
      const pendingCount = pendingApplicants.length;
      
      // Check if any applicant is negotiating (has conversationId or proposedFee different from budget)
      const isNegotiating = applicants.some(a => 
        a.status === 'pending' && (a.conversationId || (a.proposedFee && gig.budgetValue && a.proposedFee !== gig.budgetValue))
      ) || applicants.some(a => 
        a.status === 'accepted' && a.conversationId
      );

      // For grouped gigs, check all slots
      if (group && group.isGroup && group.allGigs.length > 1) {
        const allSlots = group.allGigs;
        const slotsWithConfirmed = allSlots.filter(slot => 
          (slot.applicants || []).some(a => a.status === 'confirmed')
        );
        const confirmedSlotsCount = slotsWithConfirmed.length;
        const totalSlots = allSlots.length;
        const allSlotsConfirmed = confirmedSlotsCount === totalSlots;

        if (allSlotsConfirmed) {
          return {
            statusClass: 'confirmed',
            icon: <TickIcon />,
            text: 'Confirmed',
            subText: null
          };
        }

        // Count total pending applications across all slots
        const totalPending = allSlots.reduce((sum, slot) => 
          sum + ((slot.applicants || []).filter(a => a.status === 'pending').length), 0
        );

        // Check if any slot is negotiating
        const anySlotNegotiating = allSlots.some(slot => {
          const slotApplicants = slot.applicants || [];
          return slotApplicants.some(a => 
            a.status === 'pending' && (a.conversationId || (a.proposedFee && slot.budgetValue && a.proposedFee !== slot.budgetValue))
          ) || slotApplicants.some(a => 
            a.status === 'accepted' && a.conversationId
          );
        });

        // Check if any slot is awaiting payment
        const anySlotAwaitingPayment = allSlots.some(slot => {
          const slotApplicants = slot.applicants || [];
          return slotApplicants.some(a => 
            a.status === 'accepted'
          );
        });

        if (anySlotAwaitingPayment) {
          return {
            statusClass: 'awaiting payment',
            icon: <ExclamationIconSolid />,
            text: 'Awaiting Payment',
            subText: `${confirmedSlotsCount}/${totalSlots} Slots Booked`
          };
        }

        if (anySlotNegotiating) {
          return {
            statusClass: 'upcoming', // Use 'upcoming' CSS class for negotiating
            icon: <ClockIcon />,
            text: 'Negotiating',
            subText: `${confirmedSlotsCount}/${totalSlots} Slots Booked`
          };
        }

        return {
          statusClass: 'upcoming',
          icon: <ClockIcon />,
          text: totalPending > 0 ? `${totalPending} Pending Application${totalPending !== 1 ? 's' : ''}` : '0 Pending Applications',
          subText: `${confirmedSlotsCount}/${totalSlots} Slots Booked`
        };
      }

      // For single gigs
      if (confirmedApplicant) {
        return {
          statusClass: 'confirmed',
          icon: <TickIcon />,
          text: 'Confirmed',
          subText: null
        };
      }

      // Check for awaiting payment (accepted but not confirmed)
      if (acceptedApplicant) {
        return {
          statusClass: 'awaiting payment',
          icon: <ExclamationIconSolid />,
          text: 'Awaiting Payment',
          subText: null
        };
      }

      // Check for negotiating (pending with conversation or proposed fee, or accepted with conversation)
      if (isNegotiating) {
        return {
          statusClass: 'upcoming', // Use 'upcoming' CSS class for negotiating
          icon: <ClockIcon />,
          text: 'Negotiating',
          subText: null
        };
      }

      return {
        statusClass: 'upcoming',
        icon: <ClockIcon />,
        text: pendingCount > 0 ? `${pendingCount} Pending Application${pendingCount !== 1 ? 's' : ''}` : '0 Pending Applications',
        subText: null
      };
    };
  
    // Group gigs by their gigSlots relationship; then append venue hire opportunity groups
    const groupedGigs = useMemo(() => {
      const processed = new Set();
      const groups = [];
      
      normalizedGigs.forEach(gig => {
        if (processed.has(gig.gigId)) return;
        
        const hasSlots = Array.isArray(gig.gigSlots) && gig.gigSlots.length > 0;
        
        if (hasSlots) {
          const groupGigs = [gig];
          const groupIds = new Set([gig.gigId]);
          processed.add(gig.gigId);
          const queue = [...gig.gigSlots];
          
          while (queue.length > 0) {
            const slotId = queue.shift();
            if (processed.has(slotId)) continue;
            const slotGig = normalizedGigs.find(g => g.gigId === slotId);
            if (slotGig) {
              groupGigs.push(slotGig);
              groupIds.add(slotId);
              processed.add(slotId);
              if (Array.isArray(slotGig.gigSlots)) {
                slotGig.gigSlots.forEach(id => {
                  if (!groupIds.has(id) && !processed.has(id)) queue.push(id);
                });
              }
            }
          }
          groupGigs.sort((a, b) => (a.dateTime && b.dateTime ? a.dateTime - b.dateTime : 0));
          groups.push({ isGroup: true, primaryGig: groupGigs[0], allGigs: groupGigs, gigIds: Array.from(groupIds) });
        } else {
          groups.push({ isGroup: false, primaryGig: gig, allGigs: [gig], gigIds: [gig.gigId] });
          processed.add(gig.gigId);
        }
      });

      normalizedHireOpportunities.forEach((hire) => {
        const id = hire.hireSpaceId ?? hire.gigId;
        groups.push({
          isGroup: false,
          primaryGig: hire,
          allGigs: [hire],
          gigIds: [id],
          itemType: 'venue_hire',
        });
      });
      
      return groups;
    }, [normalizedGigs, normalizedHireOpportunities]);

    const filteredGigs = useMemo(() => {
      return groupedGigs.filter(group => {
        const gig = group.primaryGig;
        const matchesSearch = searchQuery === '' || gig.gigName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesVenue = selectedVenue === '' || gig.venueId === selectedVenue;
        const matchesDate = selectedDate === '' || gig.dateIso === selectedDate;
        const matchesStatus = selectedStatus === 'all' || gig.status === selectedStatus;
  
        return matchesSearch && matchesVenue && matchesDate && matchesStatus;
      });
    }, [groupedGigs, searchQuery, selectedVenue, selectedDate, selectedStatus]);
  
    const sortedGigs = useMemo(() => {
      return filteredGigs.slice().sort((a, b) => {
        const aTime = a.primaryGig.dateTime;
        const bTime = b.primaryGig.dateTime;
        if (aTime > now && bTime > now) {
          return sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
        }
        if (aTime < now && bTime < now) {
          return sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
        }
        return aTime < now ? 1 : -1;
      });
    }, [filteredGigs, sortOrder, now]);
  
    const toggleSortOrder = () => {
      setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'));
    };

    const openGigPostModal = (gig) => {
        // Find the group this gig belongs to
        const group = groupedGigs.find(g => g.gigIds.includes(gig.gigId));
        
        if (group && group.isGroup && group.allGigs.length > 1) {
            // Package all slots together for editing
            const sortedSlots = [...group.allGigs].sort((a, b) => {
                if (!a.startTime || !b.startTime) return 0;
                const [aH, aM] = a.startTime.split(':').map(Number);
                const [bH, bM] = b.startTime.split(':').map(Number);
                return (aH * 60 + aM) - (bH * 60 + bM);
            });
            
            const primaryGig = sortedSlots[0];
            const baseGigName = primaryGig.gigName.replace(/\s*\(Set\s+\d+\)\s*$/, '');
            
            // Create extraSlots from remaining slots
            const extraSlots = sortedSlots.slice(1).map(slot => ({
                startTime: slot.startTime,
                duration: slot.duration,
            }));
            
            // Get budgets for each slot
            const slotBudgets = sortedSlots.map(slot => {
                return slot.budgetValue !== undefined ? slot.budgetValue : null;
            });
            
            const convertedGig = {
                ...primaryGig,
                gigName: baseGigName,
                date: primaryGig.date ? primaryGig.date.toDate() : null,
                extraSlots: extraSlots,
                slotBudgets: slotBudgets,
                // Preserve existing gig IDs for editing
                existingGigIds: sortedSlots.map(slot => slot.gigId),
            };
            setEditGigData(convertedGig);
        } else {
            const convertedGig = {
                ...gig,
                date: gig.date ? gig.date.toDate() : null,
                // Set existingGigIds for single-slot gigs so we can add slots to the same gig
                existingGigIds: [gig.gigId],
            };
            setEditGigData(convertedGig);
        }
        setGigPostModal(true);
    }

    const handleDeleteSelected = async () => {
        if (selectedGigs.length === 0) return;
        try {
          setLoading(true);
          
          // Find all groups that contain the selected gigs and get all gig IDs
          const gigIdsToDelete = new Set();
          selectedGigs.forEach(gigId => {
            const group = groupedGigs.find(g => g.gigIds.includes(gigId));
            if (group) {
              group.gigIds.forEach(id => gigIdsToDelete.add(id));
            } else {
              gigIdsToDelete.add(gigId);
            }
          });
          
          await deleteGigsBatch(Array.from(gigIdsToDelete));
          toast.success('Gig Deleted.');
          setConfirmModal(false);
          setSelectedGigs([]);
          refreshGigs();
          setConfirmType(null);
          setConfirmMessage(null);
        } catch (error) {
          console.error('Failed to delete selected gig:', error);
          toast.error('Failed to delete selected gig. Please try again.');
          setConfirmModal(false);
        } finally {
          setLoading(false);
        }
      };
      
      const handleDuplicateSelected = async () => {
        if (selectedGigs.length === 0) return;      
        try {
          setLoading(true);
          const newGigIds = [];
          
          // Find all groups that contain the selected gigs
          const groupsToDuplicate = new Set();
          selectedGigs.forEach(gigId => {
            const group = groupedGigs.find(g => g.gigIds.includes(gigId));
            if (group) {
              groupsToDuplicate.add(group);
            }
          });
          
          // Duplicate all gigs in each group and update gigSlots references
          for (const group of groupsToDuplicate) {
            // Create mapping of old gig IDs to new gig IDs
            const idMapping = new Map();
            const oldGigIds = group.gigIds;
            
            // First, duplicate all gigs and create the mapping
            for (const oldGigId of oldGigIds) {
              try {
                const response = await duplicateGig({ gigId: oldGigId });
                // The API client extracts data, so response should be { gigId: newGigId }
                // Handle both object response and direct string response
                const newGigId = typeof response === 'string' ? response : (response?.gigId || response);
                if (!newGigId || typeof newGigId !== 'string') {
                  console.error('Failed to get valid new gig ID from duplicate response:', response);
                  continue;
                }
                idMapping.set(oldGigId, newGigId);
                newGigIds.push(newGigId);
              } catch (error) {
                console.error(`Failed to duplicate gig ${oldGigId}:`, error);
                throw error;
              }
            }
            
            // Small delay to ensure all gigs are fully created in Firestore
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Then, update each new gig's gigSlots array to reference the new IDs
            for (const oldGigId of oldGigIds) {
              const newGigId = idMapping.get(oldGigId);
              if (!newGigId) continue;
              
              const originalGig = group.allGigs.find(g => g.gigId === oldGigId);
              
              if (originalGig && Array.isArray(originalGig.gigSlots) && originalGig.gigSlots.length > 0) {
                // Map old gig IDs to new gig IDs
                const newGigSlots = originalGig.gigSlots
                  .map(oldSlotId => idMapping.get(oldSlotId))
                  .filter(Boolean);
                
                // Only update if we have valid new gig slots
                if (newGigSlots.length > 0) {
                  try {
                    console.log(`Updating gig ${newGigId} with gigSlots:`, newGigSlots);
                    // Update the new gig's gigSlots array
                    await updateGigDocument({
                      gigId: newGigId,
                      action: 'gigs.update',
                      updates: { gigSlots: newGigSlots }
                    });
                  } catch (error) {
                    console.error(`Failed to update gigSlots for gig ${newGigId}:`, error);
                    console.error('Error details:', {
                      gigId: newGigId,
                      action: 'gigs.update',
                      updates: { gigSlots: newGigSlots },
                      errorMessage: error.message,
                      errorPayload: error.payload
                    });
                    // Continue with other gigs even if one fails
                  }
                } else {
                  console.warn(`No valid gigSlots to update for gig ${newGigId}. Original slots:`, originalGig.gigSlots, 'Mapped slots:', newGigSlots);
                }
              }
            }
          }
          
          toast.success('Gig Duplicated');
          setConfirmModal(false);
          setSelectedGigs([]);
          setConfirmType(null);
          setConfirmMessage(null);
          refreshGigs();
        } catch (error) {
          console.error('Failed to duplicate gigs:', error);
          toast.error('Failed to duplicate gigs. Please try again.');
          setConfirmModal(false);
        } finally {
          setLoading(false);
        }
      };

      const formatCancellationReason = (reason) => {
        if (reason === 'fee') {
            return "they're not happy with the fee";
        } else if (reason === 'availability') {
            return 'of availability';
        } else if (reason === 'double-booking') {
            return 'of a double booking';
        } else if (reason === 'personal-reasons') {
            return 'of personal reasons';
        } else if (reason === 'illness') {
            return 'of illness';
        } else if (reason === 'information') {
            return 'of not enough information';
        } else {
            return 'of other reasons';
        }
    }

      const handleCancelSelected = async () => {
        if (selectedGigs.length === 0) return;
        setLoading(true);
        try {
            // Get all gig IDs in the group(s) to cancel
            const gigIdsToCancel = new Set();
            selectedGigs.forEach(gigId => {
              const group = groupedGigs.find(g => g.gigIds.includes(gigId));
              if (group) {
                group.gigIds.forEach(id => gigIdsToCancel.add(id));
              } else {
                gigIdsToCancel.add(gigId);
              }
            });
            
            // Process cancellation for each gig in the group
            const allGigsToCancel = Array.from(gigIdsToCancel).map(id => 
              gigs.find(g => g.gigId === id)
            ).filter(Boolean);
            
            if (allGigsToCancel.length === 0) {
              setLoading(false);
              return;
            }
            
            const primaryGig = allGigsToCancel[0];
            const venueProfile = await getVenueProfileById(primaryGig.venueId);
            
            const handleMusicianCancellation = async (musician, gigData) => {
              if (!musician) {
                console.error('Musician profile is null');
                return;
              }
              // Normalize profile for API compatibility
              const normalizedProfile = {
                ...musician,
                musicianId: musician.id || musician.profileId || musician.musicianId,
                profileId: musician.id || musician.profileId || musician.musicianId,
              };
              const { conversationId } = await getOrCreateConversation({ musicianProfile: normalizedProfile, gigData: gigData, venueProfile, type: 'cancellation' });
              await postCancellationMessage(
                { conversationId, senderId: user.uid, message: `${gigData.venue.venueName} has unfortunately had to cancel because ${formatCancellationReason(
                  cancellationReason
                )}. We apologise for any inconvenience caused.`, cancellingParty: 'venue' }
              );
              const musicianId = normalizedProfile.musicianId;
              await revertGigAfterCancellationVenue({ gigData: gigData, musicianId, cancellationReason });
              await cancelledGigMusicianProfileUpdate({ musicianId, gigId: gigData.gigId });
              const cancellingParty = 'venue';
              await logGigCancellation({ gigId: gigData.gigId, musicianId, reason: cancellationReason, cancellingParty, venueId: venueProfile.venueId });
            };
            
            // Process cancellation for all gigs in the group
            for (const gigToCancel of allGigsToCancel) {
              const taskNames = [
                gigToCancel.clearPendingFeeTaskName,
                gigToCancel.automaticMessageTaskName,
              ];
              await cancelGigAndRefund({
                taskNames,
                transactionId: gigToCancel.paymentIntentId,
                gigId: gigToCancel.gigId,
                venueId: gigToCancel.venueId,
              });
              const confirmedApplicant = (gigToCancel.applicants || []).find(app => app.status === 'confirmed');
              if (confirmedApplicant) {
                let musicianProfile = await getMusicianProfileByMusicianId(confirmedApplicant.id);
                if (!musicianProfile) {
                  musicianProfile = await getArtistProfileById(confirmedApplicant.id);
                }
                if (musicianProfile) {
                  await handleMusicianCancellation(musicianProfile, gigToCancel);
                }
              }
            }
            setLoading(false);
            toast.success('Gig cancellation successful.')
            setConfirmModal(false);
            setSelectedGigs([]);
            setCancellationReason({
              reason: '',
              extraDetails: '',
            })
            setConfirmType(null);
            setConfirmMessage(null)
        } catch (error) {
            console.error('Error cancelling task:', error.message);
            toast.error('Failed to cancel gig.')
        } finally {
          setLoading(false);
        }
    };

      const handleCloneAsTemplate = async (gig) => {
        // Find the group this gig belongs to
        const group = groupedGigs.find(g => g.gigIds.includes(gig.gigId));
        
        if (group && group.isGroup && group.allGigs.length > 1) {
          // Package all slots together for template
          const sortedSlots = [...group.allGigs].sort((a, b) => {
            if (!a.startTime || !b.startTime) return 0;
            const [aH, aM] = a.startTime.split(':').map(Number);
            const [bH, bM] = b.startTime.split(':').map(Number);
            return (aH * 60 + aM) - (bH * 60 + bM);
          });
          
          const primaryGig = sortedSlots[0];
          const baseGigName = primaryGig.gigName.replace(/\s*\(Set\s+\d+\)\s*$/, '');
          
          // Create extraSlots from remaining slots
          const extraSlots = sortedSlots.slice(1).map(slot => ({
            startTime: slot.startTime,
            duration: slot.duration,
          }));
          
          // Get budgets for each slot
          const slotBudgets = sortedSlots.map(slot => {
            return slot.budgetValue !== undefined ? slot.budgetValue : null;
          });
          
          const templateId = uuidv4();
          const templateData = {
            ...primaryGig,
            gigName: baseGigName,
            gigId: null,
            date: null,
            templateName: baseGigName,
            templateId: templateId,
            extraSlots: extraSlots,
            slotBudgets: slotBudgets,
          };
          
          try {
            await saveGigTemplate({ templateData: templateData });
            toast.success('Template Saved');
          } catch (error) {
            console.error('Failed to save template:', error);
            toast.error('Failed to save template');
          }
        } else {
          const templateId = uuidv4();
          const templateData = {
            ...gig,
            gigId: null,
            date: null,
            templateName: gig.gigName,
            templateId: templateId,
          };
        
          try {
            await saveGigTemplate({ templateData: templateData });
            toast.success('Template Saved');
          } catch (error) {
            console.error('Failed to save template:', error);
            toast.error('Failed to save template');
          }
        }
      };

    const copyToClipboard = (link) => {
      navigator.clipboard.writeText(`${link}`).then(() => {
          toast.success(`Copied Gig Link: ${link}`);
      }).catch((err) => {
          toast.error('Failed to copy link. Please try again.')
          console.error('Failed to copy link: ', err);
      });
    };

    const calculateEndTime = (startTime, duration) => {
      if (!startTime || !duration) return null;
      const [hours, minutes] = startTime.split(':').map(Number);
      const totalMinutes = hours * 60 + minutes + duration;
      const endHours = Math.floor(totalMinutes / 60) % 24;
      const endMinutes = totalMinutes % 60;
      return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
    };

    const handleSaveSoundManager = async (gigId, venueId) => {
      if (!hasVenuePerm(venues, venueId, 'gigs.update')) {
        toast.error('You do not have permission to update this gig.');
        setEditingSoundManager(null);
        setSoundManagerValue('');
        return;
      }
      try {
        // Find the group this gig belongs to
        const group = groupedGigs.find(g => g.gigIds.includes(gigId));
        const gigIdsToUpdate = group ? group.gigIds : [gigId];
        
        // Update all gigs in the group
        await Promise.all(gigIdsToUpdate.map(id => 
          updateGigDocument({
            gigId: id,
            action: 'gigs.update',
            updates: { soundManager: soundManagerValue.trim() || null }
          })
        ));
        
        setEditingSoundManager(null);
        setSoundManagerValue('');
        refreshGigs();
      } catch (error) {
        console.error('Error updating sound manager:', error);
        toast.error('Failed to update sound manager. Please try again.');
      }
    };

    const handleSaveNotes = async (gigId, venueId) => {
      if (!hasVenuePerm(venues, venueId, 'gigs.update')) {
        toast.error('You do not have permission to update this gig.');
        setEditingNotes(null);
        setNotesValue('');
        return;
      }
      try {
        // Find the group this gig belongs to
        const group = groupedGigs.find(g => g.gigIds.includes(gigId));
        const gigIdsToUpdate = group ? group.gigIds : [gigId];
        
        // Update all gigs in the group
        await Promise.all(gigIdsToUpdate.map(id => 
          updateGigDocument({
            gigId: id,
            action: 'gigs.update',
            updates: { notes: notesValue.trim() || null }
          })
        ));
        
        setEditingNotes(null);
        setNotesValue('');
        refreshGigs();
      } catch (error) {
        console.error('Error updating notes:', error);
        toast.error('Failed to update notes. Please try again.');
      }
    };

    const handleSubscribeClick = async () => {
      setShowSubscribeModal(true);
      if (!calendarFeedUrl && venues?.length) {
        setSubscribeLoading(true);
        try {
          const res = await getCalendarFeedUrl({
            venueIds: venues.map((v) => v.venueId).filter(Boolean),
          });
          setCalendarFeedUrl(res?.feedUrl ?? null);
        } catch (err) {
          console.error('Failed to get calendar feed URL:', err);
          toast.error('Failed to load calendar link.');
        } finally {
          setSubscribeLoading(false);
        }
      }
    };
  
    return (
      <>
        <div className='head gigs'>
          <div className="title requests title-container">
            <div className='title-and-view-switcher'>
              <h1 className='title'>My Gigs</h1>
              <div className='gigs-view-switcher'>
                <button
                  type='button'
                  className={`gigs-view-btn ${gigsView === 'react' ? 'active' : ''}`}
                  onClick={() => setGigsView('react')}
                  aria-pressed={gigsView === 'react'}
                >
                  <CalendarIconSolid />
                  <span>Calendar</span>
                </button>
                <button
                  type='button'
                  className={`gigs-view-btn ${gigsView === 'table' ? 'active' : ''}`}
                  onClick={() => setGigsView('table')}
                  aria-pressed={gigsView === 'table'}
                >
                  <FontAwesomeIcon icon={faTable} className='icon' />
                  <span>Table</span>
                </button>
              </div>
            </div>
            {gigsView === 'react' && (
              <button
                type="button"
                className="btn tertiary"
                onClick={handleSubscribeClick}
              >
                <FontAwesomeIcon icon={faWifi} className="icon" style={{ marginRight: '0.35rem' }} />
                Subscribe to calendar
              </button>
            )}
            <div className="gigs-head-create-buttons">
              {gigsView === 'react' && (
                <button
                  type="button"
                  className="btn primary gigs-react-add-booking-btn"
                  onClick={() => { setAddGigsEditData(null); setAddGigsInitialDateIso(null); setShowAddGigsModal(true); }}
                >
                  Add Event
                </button>
              )}
              {/* Create Gig button commented out – using Add/Book a Gig instead
              <button
                type="button"
                className="btn primary gigs-create-gig-btn"
                onClick={() => setGigPostModal(true)}
              >
                Create Gig
              </button>
              */}
            </div>
          </div>
          {gigsView === 'table' && (
            <>
            <div className='filters'>
              <div className="status-buttons">
                  <button className={`btn ${selectedStatus === 'all' ? 'active' : ''}`} onClick={() => updateUrlParams('status', 'all')}>
                      All
                  </button>
                  <button className={`btn ${selectedStatus === 'confirmed' ? 'active' : ''}`} onClick={() => updateUrlParams('status', 'confirmed')}>
                      Confirmed
                  </button>
                  <button className={`btn ${selectedStatus === 'upcoming' ? 'active' : ''}`} onClick={() => updateUrlParams('status', 'upcoming')}>
                      Upcoming
                  </button>
                  <button className={`btn ${selectedStatus === 'past' ? 'active' : ''}`} onClick={() => updateUrlParams('status', 'past')}>
                      Past
                  </button>
              </div>
              {isXlUp ? (
                <>
                  <span className="separator"></span>
                  <div className="search-bar-container">
                      <SearchIcon />
                      <input
                      type='text'
                      placeholder='Search By Name...'
                      value={searchQuery}
                      onChange={handleSearchChange}
                      className='search-bar'
                      aria-label='Search gigs'
                      />
                  </div>
                  <span className="separator"></span>
                  <input
                      type='date'
                      id='dateSelect'
                      value={selectedDate}
                      onChange={(e) => updateUrlParams('date', e.target.value)}
                      className='date-select'
                  />
                  <span className="separator"></span>
                  <select
                      id='venueSelect'
                      value={selectedVenue}
                      onChange={(e) => updateUrlParams('venue', e.target.value)}
                  >
                      <option value=''>Filter by Venue</option>
                      {venues.map((venue) => (
                      <option value={venue.venueId} key={venue.venueId}>{venue.name}</option>
                      ))}
                  </select>
                </>
              ) : (
                <>
                  <button className={`btn tertiary ${showMobileFilters ? 'open' : ''}`} onClick={() => setShowMobileFilters(prev => !prev)}>
                      <FilterIconEmpty />
                      {isMdUp && 'Filters'}
                  </button>
                </>
              )}
            </div>

            {!isLgUp && showMobileFilters && (
              <div className="filters ext">
                  <input
                  type='date'
                  id='dateSelect'
                  value={selectedDate}
                  onChange={(e) => updateUrlParams('date', e.target.value)}
                  className='date-select'
                  />
                  <select
                  id='venueSelect'
                  value={selectedVenue}
                  onChange={(e) => updateUrlParams('venue', e.target.value)}
                  >
                  <option value=''>Venue</option>
                  {venues.map((venue) => (
                      <option value={venue.venueId} key={venue.venueId}>{venue.name}</option>
                  ))}
                  </select>
              </div>
              )}  
              </>
              )}
          </div>
        {gigsView === 'react' ? (
          <div className='body gigs gigs-calendar-body gigs-calendar-react-body'>
            <GigsCalendarReact
              gigs={filteredGigs}
              venues={venues}
              user={user}
              refreshGigs={refreshGigs}
              copyToClipboard={copyToClipboard}
              setAddGigsEditData={setAddGigsEditData}
              setShowAddGigsModal={setShowAddGigsModal}
              setShowInvitesModal={setShowInvitesModal}
              setSelectedGigForInvites={setSelectedGigForInvites}
              onAddGigForDate={(dateIso) => {
                setAddGigsEditData(null);
                setAddGigsInitialDateIso(dateIso);
                setShowAddGigsModal(true);
              }}
              onDeleteGigs={async (gigIds) => {
                if (!gigIds?.length) return;
                try {
                  await deleteGigsBatch(Array.from(gigIds));
                  toast.success('Gig deleted.');
                  refreshGigs();
                } catch (err) {
                  console.error('Failed to delete gig:', err);
                  toast.error('Failed to delete gig. Please try again.');
                }
              }}
              onDeleteHireOpportunities={async (hireIds) => {
                if (!hireIds?.length) return;
                try {
                  for (const id of hireIds) {
                    await deleteVenueHireOpportunity(id);
                  }
                  toast.success('Venue hire opportunity removed.');
                  refreshGigs();
                } catch (err) {
                  console.error('Failed to delete venue hire:', err);
                  toast.error('Failed to remove. Please try again.');
                }
              }}
            />
          </div>
        ) : (
        <div className='body gigs'>
            {/* {selectedGigs.length > 0 && (
                <div className="gig-action-bar">
                    <p>{selectedGigs.length} Gig{selectedGigs.length > 1 ? 's' : ''} Selected</p>
                    <span className="separator"></span>
                    <div className="tooltip-wrapper" data-tooltip="Delete">
                        <button
                            className="btn icon"
                            onClick={() => {
                            setConfirmType('delete');
                            setConfirmModal(true);
                            setConfirmMessage(
                                selectedGigs.length > 1
                                ? 'Are you sure you want to delete these gigs? This action cannot be undone.'
                                : 'Are you sure you want to delete this gig? This action cannot be undone.'
                            );
                            }}
                        >
                            {selectedGigs.length > 1 ? <DeleteGigsIcon /> : <DeleteGigIcon />}
                        </button>
                    </div>

                    <div className="tooltip-wrapper" data-tooltip="Duplicate">
                        <button
                            className="btn icon"
                            onClick={() => {
                            setConfirmType('duplicate');
                            setConfirmModal(true);
                            setConfirmMessage(
                                selectedGigs.length > 1
                                ? 'Duplicate these gigs? The new gigs will have no applicants.'
                                : 'Duplicate this gig? The new gig will have no applicants.'
                            );
                            }}
                        >
                            <DuplicateGigIcon />
                        </button>
                    </div>
                    <button className="btn icon" onClick={clearSelection}><ErrorIcon /></button>
                </div>
            )} */}
          <table>
              <thead>
                <tr>
                  {/* <th>
                      <input
                          type="checkbox"
                          checked={selectedGigs.length === sortedGigs.length && sortedGigs.length > 0}
                          onChange={(e) => {
                          if (e.target.checked) {
                              setSelectedGigs(sortedGigs.map((group) => group.primaryGig.gigId));
                          } else {
                              clearSelection();
                          }
                          }}
                      />
                  </th> */}
                  <th id='date'>
                    Date and Time
                  </th>
                  {isMdUp && (
                    <th id='name'>Gig Name</th>
                  )}
                  {isMdUp && <th className='centre sound-manager-column'>Sound Manager</th>}
                  {isMdUp && <th className='centre notes-column'>Notes</th>}
                  <th className='centre invite-only-column'>Invite Only?</th>
                  <th className='centre invite-artists-column'>Invite Artists</th>
                  <th className='centre'>Status</th>
                  <th id='options'></th>
                </tr>
              </thead>
              <tbody>
                {sortedGigs.length > 0 ? (
                  sortedGigs.map((group, index) => {
                    const gig = group.primaryGig;
                    const isFirstPreviousGig =
                      index > 0 &&
                      gig.dateTime < now &&
                      sortedGigs[index - 1].primaryGig.dateTime >= now;
    
                    // Get status display using the new function
                    const statusDisplay = getStatusDisplay(gig, group);
                    
                    // Get base gig name (remove "(Set X)" suffix for grouped gigs)
                    const baseGigName = group.isGroup 
                      ? gig.gigName.replace(/\s*\(Set\s+\d+\)\s*$/, '')
                      : gig.gigName;
                    
                    return (
                      <React.Fragment key={group.primaryGig.gigId}>
                        {isFirstPreviousGig && (
                          <tr className='filler-row'>
                            <td className='data' colSpan={8}>
                              <div className='flex center'>
                                <h4>Past Gigs</h4>
                              </div>
                            </td>
                          </tr>
                        )}
                        <tr onClick={(e) => {
                            navigate('/venues/dashboard/gigs/gig-applications', { state: { gig: group.primaryGig } })
                          }}>
                          {/* {gig.dateTime > now ? (
                              <td onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected(gig.gigId)}
                                onChange={() => toggleGigSelection(gig.gigId)}
                              />
                            </td>
                          ) : (
                              <td></td>
                          )} */}
                          <td className='time-and-date'>
                            {!isLgUp && gig?.applicants && gig?.applicants?.length && gig?.applicants.some(app => !app.viewed && app.invited !== true) ? (
                              <span className="notification-dot" />
                            ) : (
                              null
                            )}
                            {gig.dateObj ? (
                              <div className="date-time-container">
                                <div>
                                  {format(gig.dateObj, 'EEEE, MMM d')}
                                </div>
                                {(() => {
                                  if (group.isGroup && group.allGigs.length > 1) {
                                    // For grouped gigs, find the earliest start and latest end
                                    const allSlots = group.allGigs.filter(g => g.startTime && g.duration);
                                    if (allSlots.length > 0) {
                                      // Sort by startTime to get first and last
                                      const sortedSlots = [...allSlots].sort((a, b) => {
                                        const [aH, aM] = a.startTime.split(':').map(Number);
                                        const [bH, bM] = b.startTime.split(':').map(Number);
                                        return (aH * 60 + aM) - (bH * 60 + bM);
                                      });
                                      
                                      const firstSlot = sortedSlots[0];
                                      const lastSlot = sortedSlots[sortedSlots.length - 1];
                                      const firstStartTime = firstSlot.startTime;
                                      const lastEndTime = calculateEndTime(lastSlot.startTime, lastSlot.duration);
                                      
                                      return (
                                        <div className="time-range">
                                          {firstStartTime} - {lastEndTime}
                                        </div>
                                      );
                                    }
                                  }
                                  // For single gigs, show normal time range
                                  if (gig.startTime && gig.duration) {
                                    return (
                                      <div className="time-range">
                                        {gig.startTime} - {calculateEndTime(gig.startTime, gig.duration)}
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            ) : '—'}
                          </td>
                          {isMdUp && (
                            <td>{baseGigName}</td>
                          )}
                          {isMdUp && (
                            <td className='centre sound-manager-cell' onClick={(e) => e.stopPropagation()}>
                              <div 
                                className="sound-manager-box"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setSoundManagerPosition({ top: rect.top - 120, left: rect.left });
                                  setEditingSoundManager(group.primaryGig.gigId);
                                  setSoundManagerValue(gig.soundManager || '');
                                }}
                              >
                                <span className="sound-manager-text">
                                  {gig.soundManager || ''}
                                </span>
                              </div>
                              {editingSoundManager === group.primaryGig.gigId && (
                                <div
                                  data-sound-manager-editor
                                  className="sound-manager-editor"
                                  style={{
                                    top: `${soundManagerPosition.top}px`,
                                    left: `${soundManagerPosition.left}px`,
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <h4>Sound Manager</h4>
                                  <textarea
                                    className="sound-manager-textarea"
                                    value={soundManagerValue}
                                    onChange={(e) => setSoundManagerValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSaveSoundManager(group.primaryGig.gigId, gig.venueId);
                                      }
                                      if (e.key === 'Escape') {
                                        setEditingSoundManager(null);
                                        setSoundManagerValue('');
                                      }
                                    }}
                                    onBlur={(e) => {
                                      // Delay to allow Save button click to register
                                      setTimeout(() => {
                                        if (editingSoundManager === group.primaryGig.gigId) {
                                          handleSaveSoundManager(group.primaryGig.gigId, gig.venueId);
                                        }
                                      }, 200);
                                    }}
                                    autoFocus
                                  />
                                  <div className="sound-manager-editor-actions">
                                    <button
                                      className="btn tertiary"
                                      onClick={() => {
                                        setEditingSoundManager(null);
                                        setSoundManagerValue('');
                                      }}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      className="btn primary"
                                      onClick={() => handleSaveSoundManager(group.primaryGig.gigId, gig.venueId)}
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              )}
                            </td>
                          )}
                          {isMdUp && (
                            <td className='centre notes-cell' onClick={(e) => e.stopPropagation()}>
                            <div 
                              className="notes-box"
                              onClick={(e) => {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                setNotesPosition({ top: rect.top - 120, left: rect.left });
                                setEditingNotes(group.primaryGig.gigId);
                                setNotesValue(gig.notes || '');
                              }}
                            >
                              <span className="notes-text">
                                {gig.notes || ''}
                              </span>
                            </div>
                            {editingNotes === group.primaryGig.gigId && (
                              <div
                                data-notes-editor
                                className="notes-editor"
                                style={{
                                  top: `${notesPosition.top}px`,
                                  left: `${notesPosition.left}px`,
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <h4>Notes</h4>
                                <textarea
                                  className="notes-textarea"
                                  value={notesValue}
                                  onChange={(e) => setNotesValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handleSaveNotes(group.primaryGig.gigId, gig.venueId);
                                    }
                                    if (e.key === 'Escape') {
                                      setEditingNotes(null);
                                      setNotesValue('');
                                    }
                                  }}
                                  onBlur={(e) => {
                                    // Delay to allow Save button click to register
                                    setTimeout(() => {
                                      if (editingNotes === group.primaryGig.gigId) {
                                        handleSaveNotes(group.primaryGig.gigId, gig.venueId);
                                      }
                                    }, 200);
                                  }}
                                  autoFocus
                                />
                                <div className="notes-editor-actions">
                                  <button
                                    className="btn tertiary"
                                    onClick={() => {
                                      setEditingNotes(null);
                                      setNotesValue('');
                                    }}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    className="btn primary"
                                    onClick={() => handleSaveNotes(group.primaryGig.gigId, gig.venueId)}
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>
                          )}
                          {gig.dateTime > now && (
                            <>
                              <td className="centre gigs-private-apps-cell invite-only-cell" onClick={(e) => e.stopPropagation()}>
                                    <div className="gigs-toggle-container">
                                        <label className="gigs-toggle-switch">
                                            <input
                                                type="checkbox"
                                                checked={gig.private || false}
                                                disabled={!hasVenuePerm(venues, gig.venueId, 'gigs.update')}
                                                onChange={async (e) => {
                                                    e.stopPropagation();
                                                    if (!hasVenuePerm(venues, gig.venueId, 'gigs.update')) {
                                                        toast.error('You do not have permission to update this gig.');
                                                        return;
                                                    }
                                                    try {
                                                        const newPrivate = e.target.checked;
                                                        // Update all gigs in the group
                                                        const gigIdsToUpdate = group.gigIds;
                                                        await Promise.all(gigIdsToUpdate.map(id => 
                                                          updateGigDocument({ 
                                                            gigId: id, 
                                                            action: 'gigs.update', 
                                                            updates: { private: newPrivate } 
                                                          })
                                                        ));
                                                        toast.success(`Gig changed to ${newPrivate ? 'Invite Only' : 'Public'}`);
                                                        refreshGigs();
                                                    } catch (error) {
                                                        console.error('Error updating invite only status:', error);
                                                        toast.error('Failed to update gig. Please try again.');
                                                    }
                                                }}
                                            />
                                            <span className="gigs-toggle-slider"></span>
                                        </label>
                                    </div>
                                </td>
                              <td className="centre invite-artist-cell" onClick={(e) => e.stopPropagation()}>
                                  {statusDisplay.statusClass !== 'confirmed' && (
                                    <>
                                      {!gig.private ? (
                                        <button 
                                          className="btn icon" 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const gigLink = `${window.location.origin}/gig/${gig.gigId}`;
                                            copyToClipboard(gigLink);
                                          }}
                                          title="Copy gig link"
                                        >
                                          <LinkIcon />
                                        </button>
                                      ) : (
                                        <button 
                                          className="btn icon" 
                                          disabled={!hasVenuePerm(venues, gig.venueId, 'gigs.invite')}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (!hasVenuePerm(venues, gig.venueId, 'gigs.invite')) {
                                              toast.error('You do not have permission to perform this action.');
                                              return;
                                            }
                                            setSelectedGigForInvites(gig);
                                            setShowInvitesModal(true);
                                          }}
                                          title={!hasVenuePerm(venues, gig.venueId, 'gigs.invite') ? 'You do not have permission to create invites' : 'Create invite link'}
                                        >
                                          <InviteIconSolid />
                                        </button>
                                      )}
                                    </>
                                  )}
                                </td>
                            </>
                          )}
                          {gig.dateTime <= now && (
                            <>
                              <td className="centre gigs-private-apps-cell invite-only-cell"></td>
                              <td className="centre invite-artist-cell"></td>
                            </>
                          )}
                          <td className={`status-box ${statusDisplay.statusClass === 'awaiting payment' || statusDisplay.statusClass === 'in dispute' ? 'closed' : statusDisplay.statusClass}`}>
                            <div className={`status ${statusDisplay.statusClass === 'awaiting payment' || statusDisplay.statusClass === 'in dispute' ? 'closed' : statusDisplay.statusClass}`}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {statusDisplay.icon}
                                <span style={{ fontSize: '0.8rem' }}>{statusDisplay.text}</span>
                              </div>
                            </div>
                            {statusDisplay.subText && (
                              <div style={{ fontSize: '0.85rem', marginTop: '6px', color: '#000', textAlign: 'center' }}>
                                {statusDisplay.subText}
                              </div>
                            )}
                          </td>
                          <td className="options-cell" onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                  <button 
                                    className={`btn icon ${openOptionsGigId === group.primaryGig.gigId ? 'active' : ''}`} 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleOptionsMenu(group.primaryGig.gigId);
                                    }}
                                  >
                                      <OptionsIcon />
                                  </button>
                              </div>
                              {openOptionsGigId === group.primaryGig.gigId && (
                                  <div className="options-dropdown" onClick={(e) => e.stopPropagation()}>
                                  <button onClick={() => { closeOptionsMenu(); navigate('/venues/dashboard/gigs/gig-applications', { state: { gig } }) }}>View Details <GigIcon /></button>
                                  {(gig.dateTime > now && (gig.status === 'open' || gig.status === 'upcoming') && !gig?.applicants.some(applicant => applicant.status === 'accepted' || applicant.status === 'confirmed')) && hasVenuePerm(venues, gig.venueId, 'gigs.update') && (
                                      <button onClick={() => { 
                                        if (!hasVenuePerm(venues, gig.venueId, 'gigs.create')) {
                                          toast.error('You do not have permission to duplicate this gig.');
                                        };
                                        closeOptionsMenu();
                                        openGigPostModal(gig);
                                    }}>Edit <EditIcon /></button>
                                  )}
                                  {gig.dateTime > now && hasVenuePerm(venues, gig.venueId, 'gigs.create')&& (
                                      <button 
                                          onClick={() => {
                                              if (!hasVenuePerm(venues, gig.venueId, 'gigs.create')) {
                                                toast.error('You do not have permission to duplicate this gig.');
                                              }
                                              closeOptionsMenu();
                                              // Get all gig IDs in the group
                                              const group = groupedGigs.find(g => g.gigIds.includes(gig.gigId));
                                              const gigIdsToDuplicate = group ? group.gigIds : [gig.gigId];
                                              setSelectedGigs(gigIdsToDuplicate);
                                              setConfirmType('duplicate');
                                              setConfirmModal(true);
                                              setConfirmMessage('Duplicate this gig? The new gig will have no applicants.');
                                          }}
                                      >
                                          Duplicate
                                          <DuplicateGigIcon />
                                      </button>
                                  )}
                                  {(gig.dateTime > now && gig.status !== 'confirmed' && gig.status !== 'accepted' && gig.status !== 'awaiting payment') && hasVenuePerm(venues, gig.venueId, 'gigs.update') && (
                                      <button
                                      onClick={async () => {
                                          if (!hasVenuePerm(venues, gig.venueId, 'gigs.update')) {
                                            toast.error('You do not have permission to edit this gig.');
                                            return;
                                          }
                                          closeOptionsMenu();
                                          const newStatus = (gig.status === 'open' || gig.status === 'upcoming') ? 'closed' : 'open';
                                          try {
                                              const group = groupedGigs.find(g => g.gigIds.includes(gig.gigId));
                                              const gigIdsToUpdate = group ? group.gigIds : [gig.gigId];
                                              await Promise.all(gigIdsToUpdate.map(id => 
                                                updateGigDocument({ gigId: id, action: 'gigs.applications.manage', updates: { status: newStatus } })
                                              ));
                                              toast.success(`Gig ${newStatus === 'open' ? 'Opened for Applications' : 'Closed from Applications'}`);
                                              refreshGigs();
                                          } catch (error) {
                                              console.error('Error updating status:', error);
                                              toast.error('Failed to update gig status.');
                                          }
                                      }}
                                      >
                                          {(gig.status === "open" || gig.status === 'upcoming') ? 'Close Gig' : 'Reopen Gig'}
                                          {(gig.status === "open" || gig.status === 'upcoming') ? (
                                              <CloseIcon />
                                              ) : (
                                              <TickIcon />
                                          )}
                                      </button>
                                  )}
                                  {hasVenuePerm(venues, gig.venueId, 'gigs.create') && (
                                    <button onClick={() => {
                                      if (!hasVenuePerm(venues, gig.venueId, 'gigs.create')) {
                                        toast.error('You do not have permission to perform this action.');
                                      };
                                      closeOptionsMenu();
                                      handleCloneAsTemplate(gig);
                                    }}>
                                        Make Gig a Template <TemplateIcon />
                                    </button>
                                  )}
                                  {/* Private gig invite links are now managed through the Gig Invites modal */}
                                  {gig.dateTime > now && gig.status !== 'confirmed' && gig.status !== 'accepted' && gig.status !== 'awaiting payment' && hasVenuePerm(venues, gig.venueId, 'gigs.update') ? (
                                      <button 
                                          onClick={() => {
                                              if (!hasVenuePerm(venues, gig.venueId, 'gigs.update')) {
                                                toast.error('You do not have permission to delete this gig.');
                                              }
                                              closeOptionsMenu();
                                              // Get all gig IDs in the group
                                              const group = groupedGigs.find(g => g.gigIds.includes(gig.gigId));
                                              const gigIdsToDelete = group ? group.gigIds : [gig.gigId];
                                              setSelectedGigs(gigIdsToDelete);
                                              setConfirmType('delete');
                                              setConfirmModal(true);
                                              setConfirmMessage('Are you sure you want to delete this gig? This action cannot be undone.'); 
                                          }}>
                                              Delete
                                              <DeleteGigIcon />
                                      </button>
                                  ) : gig.dateTime > now && gig.status === 'confirmed' && hasVenuePerm(venues, gig.venueId, 'gigs.update') && (
                                        <button 
                                          onClick={() => {
                                              if (!hasVenuePerm(venues, gig.venueId, 'gigs.update')) {
                                                toast.error('You do not have permission to delete this gig.');
                                              }
                                              closeOptionsMenu();
                                              // Get all gig IDs in the group
                                              const group = groupedGigs.find(g => g.gigIds.includes(gig.gigId));
                                              const gigIdsToCancel = group ? group.gigIds : [gig.gigId];
                                              setSelectedGigs(gigIdsToCancel);
                                              setConfirmType('cancel');
                                              setConfirmModal(true);
                                              setConfirmMessage(`Are you sure you want to cancel this gig?`); 
                                          }}>
                                              Cancel
                                              <CancelIcon />
                                      </button>
                                  )}
                                  </div>
                              )}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr className='no-gigs'>
                    <td className='data' colSpan={8} style={{ padding: '0'}}>
                      <div className='flex' style={{ padding: '2rem 0', backgroundColor: 'var(--gn-grey-300)'}}>
                        <h4>No Gigs Available</h4>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {confirmModal && (
              <Portal>
                {!loading ? (
                <div className="modal cancel-gig" onClick={() => setConfirmModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>{confirmMessage}</h3>
                        {confirmType === 'cancel' && (
                          <div className="modal-body">
                            <div className="text">
                                <h4>What's your reason for cancelling?</h4>
                            </div>
                            <div className="input-container">
                                <select className='select' id='cancellation-reason' value={cancellationReason.reason} onChange={(e) => setCancellationReason((prev) => ({
                                        ...prev,
                                        reason: e.target.value,
                                    }))}>
                                    <option value=''>Please select a reason</option>
                                    <option value='fee'>Fee Dispute</option>
                                    <option value='availability'>Availability</option>
                                    <option value='double-booking'>Double Booking</option>
                                    <option value='personal-reasons'>Personal Reasons</option>
                                    <option value='illness'>Illness</option>
                                    <option value='information'>Not Enough Information</option>
                                    <option value='other'>Other</option>
                                </select>
                            </div>
                            <div className="input-container">
                                <label htmlFor="extraDetails" className='label'>Add any extra details below:</label>
                                <textarea name="extra-details" value={cancellationReason.extraDetails} id="extraDetails" className='input' onChange={(e) => setCancellationReason((prev) => ({
                                        ...prev,
                                        extraDetails: e.target.value,
                                    }))}></textarea>
                            </div>
                          </div>
                        )}
                        <div className='two-buttons' style={{ marginTop: '1rem'}}>
                            <button className="btn tertiary" onClick={() => setConfirmModal(false)}>Close</button>
                            {confirmType === 'delete' ? (
                                <button className="btn danger" onClick={handleDeleteSelected}>Delete</button>
                            ) : confirmType === 'cancel' ? (
                                <button className="btn danger" onClick={handleCancelSelected}>Confirm</button>
                            ) : (
                              <button className="btn primary" onClick={handleDuplicateSelected}>Duplicate</button>
                            )}
                        </div>
                    </div>
                </div>
                ) : (
                  <LoadingModal />
                )}
              </Portal>
            )}
            {showInvitesModal && selectedGigForInvites && (
              <GigInvitesModal
                gig={selectedGigForInvites}
                venues={venues}
                onClose={() => {
                  setShowInvitesModal(false);
                  setSelectedGigForInvites(null);
                }}
                refreshGigs={refreshGigs}
                user={user}
                fromGigsTable={true}
              />
            )}
        </div>
        )}
        {/* Modals below render for both table and calendar view so Add/Book a Gig / Subscribe work on calendar page */}
        {showSubscribeModal && (
          <Portal>
            <div
              className="modal cancel-gig"
              onClick={() => setShowSubscribeModal(false)}
              role="dialog"
              aria-modal="true"
              aria-labelledby="subscribe-calendar-title"
            >
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3 id="subscribe-calendar-title">Subscribe to your gigs calendar</h3>
                <p className="gigs-subscribe-intro">
                  Add your Gigin gigs to Google Calendar, Apple Calendar, or Outlook. They will stay in sync when you add or change gigs.
                </p>
                {subscribeLoading ? (
                  <p>Loading your calendar link…</p>
                ) : calendarFeedUrl ? (
                  <>
                    <div className="gigs-subscribe-url-row">
                      <input
                        type="text"
                        readOnly
                        value={calendarFeedUrl}
                        className="input gigs-subscribe-url-input"
                        onClick={(e) => e.target.select()}
                      />
                      <button
                        type="button"
                        className="btn primary"
                        onClick={() => {
                          copyToClipboard(calendarFeedUrl);
                        }}
                      >
                        Copy link
                      </button>
                    </div>
                    <div className="gigs-subscribe-instructions">
                      <h4>Google Calendar</h4>
                      <p>Other calendars → Add by URL → paste the link above → Add calendar.</p>
                      <h4>Apple Calendar</h4>
                      <p>File → New Calendar Subscription → paste the link above.</p>
                      <h4>Outlook</h4>
                      <p>Add calendar → Subscribe from web → paste the link above.</p>
                    </div>
                  </>
                ) : (
                  <p>No venues found. Add a venue to get a calendar link.</p>
                )}
                <div className="two-buttons" style={{ marginTop: '1rem' }}>
                  <button type="button" className="btn tertiary" onClick={() => setShowSubscribeModal(false)}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </Portal>
        )}
      </>
    );
  };