import { useState, useEffect } from 'react';
import '@styles/shared/modals.styles.css'
import { GigDate } from './Date';
import { GigLocation } from './Location';
import { GigPrivacy } from './Privacy';
import { GigMusic } from './Music';
// GigTimings component kept for reference but no longer used as a stage
import { GigBudget } from './Budget';
import { GigReview } from './Review';
import { v4 as uuidv4 } from 'uuid';
import '@styles/host/gig-post.styles.css'
import { GigGenre } from './Genre';
import { GigExtraDetails } from './ExtraDetails';
import { GigTemplates } from './Templates';
import { formatISO, addDays, addWeeks, addMonths } from 'date-fns';
import { GigName } from './Name';
import { toast } from 'sonner';
import { OpenMicGig } from './OpenMic';
import { TicketedGig } from './TicketedGig';
import { GeoPoint, Timestamp } from 'firebase/firestore';
import { geohashForLocation } from 'geofire-common';
import { validateGigTimings } from '../../../services/utils/validation';
import { getMusicianProfileByMusicianId, updateMusicianProfile } from '../../../services/client-side/artists';
import { getOrCreateConversation } from '@services/api/conversations';
import { sendGigInvitationMessage } from '../../../services/client-side/messages';
import { formatDate } from '../../../services/utils/dates';
import Portal from '../../shared/components/Portal';
import { removeVenueRequest, removePreferredDateFromRequest } from '../../../services/client-side/venues';
import { hasVenuePerm } from '../../../services/utils/permissions';
import { friendlyError } from '../../../services/utils/errors';
import { inviteToGig, postMultipleGigs, updateGigDocument } from '@services/api/gigs';
import { deleteGigsBatch } from '@services/client-side/gigs';
import { LoadingSpinner } from '../../shared/ui/loading/Loading';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import { InviteMethodsModal } from '../dashboard/InviteMethodsModal';
import { createGigInvite } from '@services/api/gigInvites';
  
function formatPounds(amount) {
    if (amount == null || isNaN(amount)) return "£0";
    const rounded = Math.round(amount * 100) / 100;
    return Number.isInteger(rounded) ? `£${rounded}` : `£${rounded.toFixed(2)}`;
}

export const GigPostModal = ({ setGigPostModal, venueProfiles, setVenueProfiles, templates, incompleteGigs, editGigData, buildingForMusician, buildingForMusicianData, user, setBuildingForMusician, setBuildingForMusicianData, setEditGigData, refreshTemplates, refreshGigs, requestId, setRequestId, setRequests, showInviteMethodsModal, setShowInviteMethodsModal, createdGigForInvite, setCreatedGigForInvite, preferredDate, setPreferredDate }) => {
    
    const [stage, setStage] = useState(() => {
        if (editGigData) {
            return 9; // Start at review stage when editing
        }
        return incompleteGigs?.length > 0 || templates?.length > 0 ? 0 : 1;
    });
    const [inviteExpiryDate, setInviteExpiryDate] = useState(null);
    const [formData, setFormData] = useState(editGigData ? editGigData : {
        gigId: uuidv4(),
        venueId: '',
        venue: {
            venueName: '',
            address: '',
            photo: null,
            userId: user.uid,
            type: ''
        },
        date: null,
        dateUndecided: false,
        coordinates: null,
        privacy: 'Public',
        kind: '',
        gigName: '',
        gigType: '',
        genre: '',
        noMusicPreference: true,
        startTime: '',
        duration: 0,
        budget: '£',
        extraInformation: '',
        private: buildingForMusician ? true : false,
        applicants: [],
        createdAt: new Date(),
        createdBy: user.uid,
        accountName: user.name,
        status: 'open',
        numberOfApplicants: 0,
        openMicApplications: null,
        limitApplications: null,
        loadInTime: '',
        soundCheckTime: '',
        soundTechnicianRequired: false,
        technicalInformation: '',
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [extraSlots, setExtraSlots] = useState([]);
    const { isSmUp } = useBreakpoint();

    const resetFormData = () => {
        setFormData({
            gigId: uuidv4(),
            venueId: '',
            venue: {
                venueName: '',
                address: '',
                photo: null,
                type: '',
                userId: '',
            },
            date: null,
            dateUndecided: false,
            coordinates: null,
            privacy: 'Public',
            kind: '',
            gigName: '',
            gigType: '',
            genre: '',
            noMusicPreference: true,
            startTime: '',
            duration: 0,
            budget: '£',
            extraInformation: '',
            private: false,
            applicants: [],
            createdAt: new Date(),
            accountName: user.name,
            status: 'open',
            numberOfApplications: 0,
            openMicApplications: null,
            limitApplications: null,
            loadInTime: '',
            soundCheckTime: '',
            soundTechnicianRequired: false,
            technicalInformation: '',
        });
        setExtraSlots([]);
        setBuildingForMusician(false)
        setBuildingForMusicianData(null)
        setEditGigData(null)
    };


    useEffect(() => {
        refreshTemplates();
        refreshGigs();
    }, []);

    // Initialize extraSlots from editGigData if editing a grouped gig
    useEffect(() => {
        if (editGigData?.extraSlots && Array.isArray(editGigData.extraSlots)) {
            setExtraSlots(editGigData.extraSlots);
        } else if (!editGigData) {
            setExtraSlots([]);
        }
    }, [editGigData]);

    // Auto-select venue if user only has one venue profile
    useEffect(() => {
        if (
            venueProfiles?.length === 1 &&
            !editGigData &&
            !buildingForMusician &&
            !formData.venueId &&
            stage === 1
        ) {
            const venue = venueProfiles[0];
            setFormData(prev => ({
                ...prev,
                venueId: venue.venueId,
                venue: {
                    venueName: venue.name,
                    address: venue.address,
                    photo: venue.photos?.[0] || null,
                    userId: user.uid,
                    type: venue.type,
                },
                coordinates: venue.coordinates,
            }));
            setStage(2);
        }
    }, [venueProfiles, editGigData, buildingForMusician, formData.venueId, stage, user.uid]);

    useEffect(() => {
        if (buildingForMusician && buildingForMusicianData) {
          const { type, genres, venueId } = buildingForMusicianData;
          const matchedVenue = venueId
            ? venueProfiles.find(v => v.venueId === venueId)
            : null;
          setFormData(prev => ({
            ...prev,
            gigType: type,
            genre: genres ? genres : [],
            venueId: venueId || '',
            private: true, // Auto-set private to true when building for musician
            date: preferredDate || prev.date, // Set date if preferredDate is provided
            venue: matchedVenue
              ? {
                  venueName: matchedVenue.name || '',
                  address: matchedVenue.address || '',
                  photo: matchedVenue.photos[0] || '',
                  userId: user.uid,
                  type: matchedVenue.type,
                }
              : prev.venue,
            coordinates: matchedVenue?.coordinates || prev.coordinates,
          }));
      
          // If venue is set and date is provided, move to next stage
          if (matchedVenue && preferredDate) {
            setStage(2); // Move to date stage (or next appropriate stage)
          } else {
            setStage(1);
          }
        }
      }, [buildingForMusician, buildingForMusicianData, venueProfiles, preferredDate, user.uid]);

    const handleInputChange = (updates) => {
        setFormData((prevFormData) => ({
            ...prevFormData,
            ...updates,
        }));
        setError('')
    };

    const handleModalClick = (e) => {
        if (e.target.className === 'modal') {
          setGigPostModal(false);
        }
    };

    const hasAllSlotBudgets = (formData, extraSlots) => {
        const totalSlots = 1 + (extraSlots?.length || 0);
        if (totalSlots <= 1) {
          return /\d/.test(formData?.budget || '');
        }
        const arr = (formData?.slotBudgets || []).slice(0, totalSlots);
        if (arr.length < totalSlots) return false;
        return arr.every(b => /\d/.test(String(b || '')));
      };

    const nextStage = () => {
        setError('');
    
        if (stage === 0) {
            setStage(prevStage => prevStage + 1);
            return;
        }
    
        if (stage === 1) {
            if (formData.venueId !== '') {
                setStage(prevStage => prevStage + 1);
            } else {
                setError('Please select a venue.');
            }
            return;
        }

        if (stage === 2) {
            if ((formData.date !== null && !formData.dateUndecided) || formData.dateUndecided) {
                // Validate timings along with date
                const { valid, error: timingError } = validateGigTimings(formData, extraSlots);
                if (!valid) {
                    setError(timingError);
                } else {
                    // If a template was selected, skip to review stage (stage 9)
                    if (formData.templateId) {
                        setStage(9);
                    } else {
                        setStage(prevStage => prevStage + 1);
                    }
                }
            } else {
                setError('Please select a date for the gig.');
            }
            return;
        }
    
        if (stage === 3) {
            if (!formData.gigName || formData.gigName.trim() === '') {
                setFormData(prev => ({
                    ...prev,
                    gigName: `Gig at ${prev.venue?.venueName || 'Unknown Venue'}`
                }));
                setStage(prevStage => prevStage + 1);
            } else {
                setStage(prevStage => prevStage + 1);
            }
            return;
        }
    
        if (stage === 4) {
            // if (formData.privacy === '') {
            //     setError('Please select a privacy setting.');
            // } else
            if (formData.kind === '') {
                setError('Please select a type of gig.');
            } else {
                setStage(prevStage => prevStage + 1);
            }
            return;
        }
    
        if (stage === 5) {
            if (formData.gigType !== '') {
                setStage(prevStage => prevStage + 1);
            } else {
                setError('Please select a gig type.');
            }
            return;
        }
    
        // Stage 6: Genre (commented out - moved to ExtraDetails)
        // if (stage === 6) {
        //     if (formData.noMusicPreference || (Array.isArray(formData.genre) && formData.genre.length > 0)) {
        //         setStage(prevStage => prevStage + 1);
        //     } else {
        //         setError('Please select at least one genre or click no specifics.');
        //     }
        //     return;
        // }
    
        if (stage === 6) {
            // ExtraDetails stage (gig description) - no validation needed, just move to next
            setStage(prevStage => prevStage + 1);
            return;
        }
    
        if (stage === 7) {
            if (formData.kind === 'Open Mic') {
              if (formData.openMicApplications === null) {
                setError("Please select whether you'd like the musicians to apply.");
              }
               else {
                setStage(9); // Go directly to review (stage 9) - stage 8 removed
              }
              return;
            }

            if (formData.kind === 'Ticketed Gig') {
              if (formData.ticketedGigUnderstood) {
                setStage(9); // Go directly to review (stage 9) - stage 8 removed
              } else {
                setError("You must click 'I understand' to post a ticketed gig.");
              }
              return;
            }
          
            if (hasAllSlotBudgets(formData, extraSlots)) {
              setStage(9); // Go directly to review (stage 9) - stage 8 removed
            } else {
              const totalSlots = 1 + (extraSlots?.length || 0);
              setError(
                totalSlots > 1
                  ? 'Please enter a budget for each set.'
                  : 'Please enter a budget.'
              );
            }
            return;
          }

        // Stage 8 removed - ExtraDetails moved to stage 6

    };
    
    const prevStage = () => {
        // Updated for removed genre stage - ExtraDetails is now at stage 6
        if (stage === 9) {
            // Go back to Budget stage (7) from Review, skipping removed stage 8
            setStage(7);
        } else if (stage === 7 && buildingForMusician && buildingForMusicianData?.type) {
            setStage(prevStage => prevStage - 2);
        } else {
            setStage(prevStage => prevStage - 1);
        }
        setError('')
    };


    const renderStageContent = () => {
        switch (stage) {
            case 0:
                if (!editGigData) {
                    return (
                        <GigTemplates
                            templates={templates}
                            incompleteGigs={incompleteGigs}
                            setFormData={setFormData}
                            resetFormData={resetFormData}
                            setExtraSlots={setExtraSlots}
                            setStage={setStage}
                        />
                    );
                } else {
                    setStage(1);
                }
            case 1:
                return (
                    <GigLocation
                        formData={formData}
                        handleInputChange={handleInputChange}
                        venueProfiles={venueProfiles}
                        setStage={setStage}
                        error={error}
                        setError={setError}
                        user={user}
                    />
                );
            case 2:
                return (
                    <GigDate
                        formData={formData}
                        handleInputChange={handleInputChange}
                        setStage={setStage}
                        error={error}
                        setError={setError}
                        extraSlots={extraSlots}
                        setExtraSlots={setExtraSlots}
                    />
                );
            case 3:
                return (
                    <GigName
                        formData={formData}
                        handleInputChange={handleInputChange}
                        setStage={setStage}
                        error={error}
                        setError={setError}
                    />
                );
            case 4:
                return (
                    <GigPrivacy
                        formData={formData}
                        handleInputChange={handleInputChange}
                        setStage={setStage}
                        error={error}
                        setError={setError}
                    />
                );
            case 5:
                if (buildingForMusician && buildingForMusicianData?.type) {
                    setStage(6);
                    return null;
                }
                return (
                    <GigMusic
                        formData={formData}
                        handleInputChange={handleInputChange}
                        setStage={setStage}
                        error={error}
                        setError={setError}
                    />
                );
            // case 6: Genre stage (commented out)
            //     if (buildingForMusician && buildingForMusicianData?.genres) {
            //         setStage(7);
            //         return null;
            //     }
            //     return (
            //         <GigGenre
            //             formData={formData}
            //             handleInputChange={handleInputChange}
            //             setStage={setStage}
            //             error={error}
            //             setError={setError}
            //         />
            //     );
            case 6:
                // ExtraDetails (gig description) moved here from stage 8
                return (
                    <GigExtraDetails
                        formData={formData}
                        handleInputChange={handleInputChange}
                    />
                );
            case 7:
                if (formData.kind === 'Open Mic') {
                    return (
                        <OpenMicGig
                            formData={formData}
                            handleInputChange={handleInputChange}
                            setStage={setStage}
                            error={error}
                            setError={setError}
                        />
                    );
                // } else if (formData.kind === 'Ticketed Gig') {
                //     return (
                //         <TicketedGig
                //             formData={formData}
                //             handleInputChange={handleInputChange}
                //             setStage={setStage}
                //         />
                //     );
                // } else {
                } else {
                    return (
                        <GigBudget
                            formData={formData}
                            handleInputChange={handleInputChange}
                            setStage={setStage}
                            error={error}
                            setError={setError}
                            extraSlots={extraSlots}
                        />
                    );
                }
            // case 8: ExtraDetails moved to stage 6
            case 9:
                return (
                    <GigReview
                        formData={formData}
                        handleInputChange={handleInputChange}
                        setStage={setStage}
                        error={error}
                        setError={setError}
                        buildingForMusician={buildingForMusician}
                        buildingForMusicianData={buildingForMusicianData}
                        extraSlots={extraSlots}
                        inviteExpiryDate={inviteExpiryDate}
                        setInviteExpiryDate={setInviteExpiryDate}
                    />
                );
            default:
                return null;
        }
    };

    const getProgressPercentage = () => {
        if (templates?.length > 0 || incompleteGigs?.length > 0) {
            if (formData.kind === 'Open Mic' || formData.kind === 'Ticketed Gig') {
                return ((stage) / 9) * 100;
            } else {
                return ((stage) / 9) * 100;
            }
        } else {
            if (formData.kind === 'Open Mic' || formData.kind === 'Ticketed Gig') {
                return ((stage) / 9) * 100;
            } else {
                return ((stage) / 9) * 100;
            }
        }
    };

    const getOccurrenceCount = () => {
        if (!formData.date) return 1;
        
        const repeatEnabled =
            !!formData.repeatData &&
            formData.repeatData.repeat &&
            formData.repeatData.repeat !== "no";
        
        if (!repeatEnabled) return 1;
        
        const MAX_OCCURRENCES = 10;
        const startDate = new Date(formData.date);
        const repeatType = formData.repeatData?.repeat;
        const endAfterRaw = formData.repeatData?.endAfter;
        const endAfter = Number.isFinite(parseInt(endAfterRaw, 10))
            ? Math.max(1, Math.min(MAX_OCCURRENCES, parseInt(endAfterRaw, 10)))
            : undefined;
        const endDate = formData.repeatData?.endDate
            ? new Date(formData.repeatData.endDate)
            : null;
        
        const addByRepeat = (date, index) => {
            const d = new Date(date);
            switch (repeatType) {
                case "daily":
                    d.setDate(d.getDate() + index);
                    return d;
                case "weekly":
                    d.setDate(d.getDate() + 7 * index);
                    return d;
                case "fortnightly":
                    d.setDate(d.getDate() + 14 * index);
                    return d;
                case "monthly":
                    d.setMonth(d.getMonth() + index);
                    return d;
                default:
                    return d;
            }
        };
        
        const occ = [];
        const maxByEnd = endAfter || (endDate ? MAX_OCCURRENCES : MAX_OCCURRENCES);
        for (let i = 0; i < maxByEnd; i++) {
            const next = addByRepeat(startDate, i);
            if (endDate && next > endDate) break;
            occ.push(next);
        }
        
        return occ.length || 1;
    };

    const getButtonText = () => {
        if (editGigData) {
            return 'Save Edits';
        }
        if (buildingForMusician) {
            return 'Create and Invite to Gig';
        }
        const occurrenceCount = getOccurrenceCount();
        return occurrenceCount > 1 ? 'Create Gigs' : 'Create Gig';
    };

    const getStartDateTime = (date, time) => {
        if (!date || !time) return null;
      
        const datePart = new Date(date);
        const [hours, minutes] = time.split(':').map(Number);
        datePart.setHours(hours);
        datePart.setMinutes(minutes);
        datePart.setSeconds(0);
      
        return Timestamp.fromDate(datePart);
    };
      
    const getGeoField = (coordinates) => {
        if (!coordinates || coordinates.length !== 2) return null;
      
        const [lng, lat] = coordinates;
        const geopoint = new GeoPoint(lat, lng);
        const geohash = geohashForLocation([lat, lng]).substring(0, 8);
      
        return {
          geopoint,
          geohash,
        };
      };

    const getBudgetValue = (budget) => {
        if (typeof budget !== 'string') return null;
        const numericPart = budget.replace(/[^0-9.]/g, '');
        const parsed = parseFloat(numericPart);
        return isNaN(parsed) ? null : parsed;
    };


    const handlePostGig = async () => {
        setLoading(true);
        try {
          const venueId = formData?.venueId;
          if (!venueId) throw new Error("Missing venueId");
          const permNeeded = editGigData ? "gigs.update" : "gigs.create";
          if (!hasVenuePerm(venueProfiles, venueId, permNeeded)) {
            setLoading(false);
            toast.error("You don’t have permission to perform this action.");
            return;
          }
          const repeatEnabled =
            !!formData.repeatData &&
            formData.repeatData.repeat &&
            formData.repeatData.repeat !== "no";
      
          const MAX_OCCURRENCES = 10;
          const startDate = new Date(formData.date);
          const repeatType = formData.repeatData?.repeat;
          const endAfterRaw = formData.repeatData?.endAfter;
          const endAfter = Number.isFinite(parseInt(endAfterRaw, 10))
            ? Math.max(1, Math.min(MAX_OCCURRENCES, parseInt(endAfterRaw, 10)))
            : undefined;
          const endDate = formData.repeatData?.endDate
            ? new Date(formData.repeatData.endDate)
            : null;
      
          const addByRepeat = (date, index) => {
            const d = new Date(date);
            switch (repeatType) {
              case "daily":
                d.setDate(d.getDate() + index);
                return d;
              case "weekly":
                d.setDate(d.getDate() + 7 * index);
                return d;
              case "fortnightly":
                d.setDate(d.getDate() + 14 * index);
                return d;
              case "monthly":
                d.setMonth(d.getMonth() + index);
                return d;
              default:
                return d;
            }
          };
      
          const buildOccurrences = () => {
            if (!repeatEnabled) return [startDate];
            const occ = [];
            const maxByEnd = endAfter || (endDate ? MAX_OCCURRENCES : MAX_OCCURRENCES);
            for (let i = 0; i < maxByEnd; i++) {
              const next = addByRepeat(startDate, i);
              if (endDate && next > endDate) break;
              occ.push(next);
            }
            return occ;
          };
      
          const occurrences = buildOccurrences();
          if (!occurrences.length) {
            throw new Error("No occurrences computed for the chosen repeat settings.");
          }
      
          // 🔒 Preserve existing applicants on edit; always ensure array is present
          const existingApplicants = Array.isArray(formData.applicants) ? formData.applicants : [];
          const applicantsForEdit = { applicants: existingApplicants }; // edit must keep applicants
          const applicantsForNew = { applicants: [] }; // new gigs have empty array
      
          const allGigsToPost = [];
          let firstGigDoc = null;
      
          for (const occDate of occurrences) {
            if (extraSlots.length > 0) {
              const allSlots = [
                { startTime: formData.startTime, duration: formData.duration },
                ...extraSlots
              ];
      
              let budgetValues = [null];
              if (formData.kind !== 'Ticketed Gig' && formData.kind !== 'Open Mic') {
                const budgets = (formData.slotBudgets || []).slice(0, allSlots.length);
                if (budgets.length !== allSlots.length || budgets.some(b => !b || !/\d/.test(b))) {
                  setLoading(false);
                  toast.error('Please enter a budget for each slot.');
                  return;
                }
                budgetValues = budgets.map(b => parseInt(String(b).replace(/[^\d]/g, ''), 10) || 0);
              }
      
              // Build base safely; we’ll set applicants explicitly below
              const {
                slotBudgets: _discardSlotBudgets,
                repeatData: _discardRepeatData,
                templateId: _discardTemplateId,
                createdAt: _discardCreatedAt,
                gigId: _discardGigId,
                applicants: _discardApplicants, // ⬅️ we explicitly drop applicants from base
                ...base
              } = formData;
      
              // Use existing gig IDs if editing, otherwise create new ones
              const existingIds = editGigData?.existingGigIds || [];
              const groupIds = [];
              
              if (editGigData && existingIds.length > 0) {
                // When editing, use existing IDs for matching slots, create new ones for extra slots
                for (let i = 0; i < allSlots.length; i++) {
                  groupIds.push(i < existingIds.length ? existingIds[i] : uuidv4());
                }
              } else {
                // When creating new, generate all new IDs
                for (let i = 0; i < allSlots.length; i++) {
                  groupIds.push(uuidv4());
                }
              }
      
              for (let i = 0; i < allSlots.length; i++) {
                const slot = allSlots[i];
                const slotGigId = groupIds[i];
                const slotBudgetValue = budgetValues[i];
                const slotBudgetText = formatPounds(slotBudgetValue);
      
                const slotGig = {
                  ...base,
                  gigId: slotGigId,
                  date: occDate,
                  gigName: `${formData.gigName} (Set ${i + 1})`,
                  createdAt: editGigData && existingIds.length > 0 ? formData.createdAt : new Date(),
                  complete: true,
                  startDateTime: getStartDateTime(occDate, slot.startTime),
                  startTime: slot.startTime,
                  duration: slot.duration,
                  budget: slotBudgetText,
                  ...getGeoField(formData.coordinates),
                  budgetValue: slotBudgetValue === undefined ? '£' : slotBudgetValue,
                  gigSlots: groupIds.filter(id => id !== slotGigId),
                  status: editGigData ? formData.status : 'open',
                  venueId: formData.venueId,
                  // ✅ Applicants rule: keep on edit, otherwise empty array (must exist)
                  ...(editGigData ? applicantsForEdit : applicantsForNew),
                };
      
                allGigsToPost.push(slotGig);
                if (!firstGigDoc) firstGigDoc = slotGig;
              }
            } else {
              const occurrenceGigId = editGigData
                ? formData.gigId
                : uuidv4();
      
              // Build base safely; we’ll set applicants explicitly below
              const {
                gigSlots: _discardGigSlots,
                slotBudgets: _discardSlotBudgets,
                repeatData: _discardRepeatData,
                templateId: _discardTemplateId,
                createdAt: _discardCreatedAt,
                gigId: _discardGigId,
                applicants: _discardApplicants, // ⬅️ drop from base
                ...base
              } = formData;
      
              const singleGig = {
                ...base,
                gigId: occurrenceGigId,
                date: occDate,
                createdAt: new Date(),
                complete: true,
                startDateTime: getStartDateTime(occDate, base.startTime),
                ...getGeoField(base.coordinates),
                budgetValue: getBudgetValue(base.budget),
                status: 'open',
                venueId: formData.venueId,
                ...(editGigData ? applicantsForEdit : applicantsForNew),
              };
      
              allGigsToPost.push(singleGig);
              if (!firstGigDoc) firstGigDoc = singleGig;
            }
          }
      
          const { gigIds: newGigIds } = await postMultipleGigs({ venueId: formData.venueId, gigDocuments: allGigsToPost });
          
          // If editing and we have fewer slots, delete the extra gigs
          if (editGigData?.existingGigIds && editGigData.existingGigIds.length > allGigsToPost.length) {
            const usedIds = new Set(allGigsToPost.map(g => g.gigId));
            const gigsToDelete = editGigData.existingGigIds.filter(id => !usedIds.has(id));
            if (gigsToDelete.length > 0) {
              try {
                await deleteGigsBatch(gigsToDelete);
              } catch (error) {
                console.error('Error deleting extra gigs:', error);
                // Continue even if deletion fails
              }
            }
          }

          // update local state as you already do:
          setVenueProfiles(prev => {
            if (!Array.isArray(prev)) return prev;
            return prev.map(vp => {
              const vpId = vp?.id ?? vp?.venueId;
              if (vpId !== formData.venueId) return vp;
              const existing = Array.isArray(vp.gigs) ? vp.gigs : [];
              const gigs = Array.from(new Set([...existing, ...newGigIds]));
              return { ...vp, gigs };
            });
          });
      
          if (buildingForMusician && firstGigDoc) {
            if (!hasVenuePerm(venueProfiles, venueId, "gigs.invite")) {
              toast.error("You do not have permission to invite musicians to gigs at this venue.");
              setBuildingForMusician(false);
              setBuildingForMusicianData(false);
              return;
            }
            const venueToSend = user.venueProfiles.find(v => v.id === formData.venueId);
            
            // Create invite document if gig is private and artist has an id
            let createdInvite = null;
            if (formData.private && buildingForMusicianData.id) {
              try {
                // Set time to end of day (23:59:59) if date is selected
                let expiresAt = null;
                if (inviteExpiryDate) {
                  const date = new Date(inviteExpiryDate);
                  date.setHours(23, 59, 59, 999);
                  expiresAt = date;
                }
                // Use crmEntryId if artist doesn't have Gigin profile, otherwise use artistId
                createdInvite = await createGigInvite({
                  gigId: firstGigDoc.gigId,
                  expiresAt: expiresAt?.toISOString() || null,
                  artistId: buildingForMusicianData.crmEntryId ? null : buildingForMusicianData.id,
                  crmEntryId: buildingForMusicianData.crmEntryId || null,
                  artistName: buildingForMusicianData.name || null
                });
              } catch (error) {
                console.error('Error creating invite document:', error);
                toast.error('Failed to create invite document. The gig was created but you may need to create the invite manually.');
              }
            }
            
            // Always add the artist to the applicants array when building for a musician
            if (buildingForMusicianData.id) {
              try {
                const now = new Date();
                const applicant = {
                  id: buildingForMusicianData.id,
                  timestamp: now,
                  fee: firstGigDoc.budget || "£0",
                  status: "pending",
                  invited: true,
                  viewed: false,
                  // Include inviteId and expiresAt if invite was created
                  ...(createdInvite?.inviteId ? { inviteId: createdInvite.inviteId } : {}),
                  ...(createdInvite?.expiresAt ? { inviteExpiresAt: createdInvite.expiresAt } : {})
                };
                
                // Get current applicants and add the new one if not already present
                const currentApplicants = Array.isArray(firstGigDoc.applicants) ? firstGigDoc.applicants : [];
                const alreadyIncluded = currentApplicants.some(a => a?.id === buildingForMusicianData.id);
                
                if (!alreadyIncluded) {
                  await updateGigDocument({
                    gigId: firstGigDoc.gigId,
                    action: 'gigs.update',
                    updates: {
                      applicants: [...currentApplicants, applicant]
                    }
                  });
                }
              } catch (error) {
                console.error('Error adding applicant to gig:', error);
                // Don't fail the whole process if this fails
              }
            }
            
            // Check if artist has a Gigin profile (has an id that can be found)
            let musicianProfile = null;
            let hasGiginProfile = false;
            if (buildingForMusicianData.id) {
              try {
                musicianProfile = await getMusicianProfileByMusicianId(buildingForMusicianData.id);
                // Check if profile exists and has a userId (meaning they have a Gigin account)
                hasGiginProfile = !!(musicianProfile && musicianProfile.userId);
              } catch (error) {
                console.error('Error fetching musician profile:', error);
                hasGiginProfile = false;
              }
            }

            if (hasGiginProfile && musicianProfile) {
              // Artist has a Gigin profile with userId - use existing invite flow
              if (!musicianProfile.musicianId) {
                // Ensure musicianId is set
                musicianProfile.musicianId = musicianProfile.id || buildingForMusicianData.id;
              }

              const res = await inviteToGig({ gigId: firstGigDoc.gigId, musicianProfile });
            if (!res.success) {
              if (res.code === "permission-denied") {
                toast.error("You don’t have permission to invite musicians for this venue.");
              } else if (res.code === "failed-precondition") {
                toast.error("This gig is missing required venue info.");
              } else {
                toast.error("Error inviting musician. Do you have permission to invite musicians to gigs at this venue?");
              }
              return;
            }
            const { conversationId } = await getOrCreateConversation(
              { musicianProfile, gigData: firstGigDoc, venueProfile: venueToSend, type: "invitation" }
            );
            if (formData.kind !== 'Ticketed Gig' && formData.kind !== 'Open Mic') {
              await sendGigInvitationMessage(conversationId, {
                senderId: user.uid,
                text: `${venueToSend.accountName} has invited ${musicianProfile.name} to play at their gig at ${formData.venue.venueName} on the ${formatDate(firstGigDoc.date, 'long')} for ${firstGigDoc.budget}.`,
              });
            } else {
              await sendGigInvitationMessage(conversationId, {
                senderId: user.uid,
                text: `${venueToSend.accountName} has invited ${musicianProfile.name} to play at their gig at ${formData.venue.venueName} on the ${formatDate(firstGigDoc.date, 'long')}.`,
              });
            }
            } else {
              // Artist doesn't have a Gigin profile - show invite methods modal
              // Use CRM entry data if available, otherwise use buildingForMusicianData
              const artistData = {
                name: buildingForMusicianData.name,
                email: buildingForMusicianData.email || null,
                phone: buildingForMusicianData.phone || null,
                instagram: buildingForMusicianData.instagram || null,
                facebook: buildingForMusicianData.facebook || null,
                other: buildingForMusicianData.other || null,
              };
              
              // Set the created gig data and show invite methods modal
              if (setCreatedGigForInvite && setShowInviteMethodsModal) {
                setCreatedGigForInvite({
                  gig: firstGigDoc,
                  artist: artistData,
                  venue: venueToSend,
                });
                setShowInviteMethodsModal(true);
                // Don't close the gig post modal yet - we'll close it after invite methods modal
              } else {
                // Fallback if props not available - just show success and close
                console.error('setCreatedGigForInvite or setShowInviteMethodsModal not available', {
                  setCreatedGigForInvite: typeof setCreatedGigForInvite,
                  setShowInviteMethodsModal: typeof setShowInviteMethodsModal,
                  hasSetCreatedGigForInvite: !!setCreatedGigForInvite,
                  hasSetShowInviteMethodsModal: !!setShowInviteMethodsModal
                });
                resetFormData();
                const isRepeat = formData?.repeatData?.repeat && formData?.repeatData?.repeat !== "no";
                const message = editGigData 
                  ? `Gig edited successfully.`
                  : `Gig${isRepeat ? 's' : ''} created successfully.`;
                toast.success(message);
                setGigPostModal(false);
              }
              setBuildingForMusician(false);
              setBuildingForMusicianData(false);
            }
            
            // Remove preferred date from request if one was used (runs for all cases)
            if (requestId && preferredDate) {
              try {
                // Optimistically update local state first
                setRequests(prev =>
                  prev.map(req => {
                    if (req.id !== requestId) return req;
                    const preferredDates = req.preferredDates || [];
                    if (!Array.isArray(preferredDates) || preferredDates.length === 0) return req;
                    
                    // Normalize the date to compare - use date components for reliable comparison
                    const targetDate = preferredDate instanceof Date 
                      ? new Date(preferredDate) 
                      : new Date(preferredDate);
                    if (isNaN(targetDate.getTime())) return req;
                    
                    // Get target date components (using local date to avoid timezone issues)
                    const targetYear = targetDate.getFullYear();
                    const targetMonth = targetDate.getMonth();
                    const targetDay = targetDate.getDate();
                    
                    // Filter out the matching date
                    const updatedDates = preferredDates.filter(dateItem => {
                      let date;
                      if (dateItem.toDate && typeof dateItem.toDate === 'function') {
                        date = dateItem.toDate();
                      } else if (dateItem._seconds || dateItem.seconds) {
                        const seconds = dateItem._seconds || dateItem.seconds;
                        const nanoseconds = dateItem._nanoseconds || dateItem.nanoseconds || 0;
                        date = new Date(seconds * 1000 + nanoseconds / 1000000);
                      } else {
                        date = new Date(dateItem);
                      }
                      if (isNaN(date.getTime())) return true;
                      // Compare by date components (year, month, day) to avoid timezone issues
                      const dateYear = date.getFullYear();
                      const dateMonth = date.getMonth();
                      const dateDay = date.getDate();
                      return !(dateYear === targetYear && dateMonth === targetMonth && dateDay === targetDay); // Keep dates that don't match
                    });
                    
                    return {
                      ...req,
                      preferredDates: updatedDates.length > 0 ? updatedDates : null
                    };
                  })
                );
                
                // Then update the backend
                await removePreferredDateFromRequest(requestId, preferredDate);
                setPreferredDate(null);
              } catch (error) {
                console.error('Error removing preferred date from request:', error);
                toast.error('Failed to remove preferred date from request');
              }
            } else if (requestId && buildingForMusician) {
              // If no preferredDate but requestId exists and building for musician, remove the entire request (old behavior)
              try {
                await removeVenueRequest(requestId);
                setRequests(prev =>
                  prev.map(req => req.id === requestId ? { ...req, removed: true } : req)
                );
                setRequestId(null);
              } catch (error) {
                console.error('Error removing request:', error);
              }
            }
          }
          await refreshGigs();
          
          // Show success message - modal closing is handled in the buildingForMusician block above
          // Only close here if we didn't set up the invite modal (i.e., not building for musician or musician has profile)
          if (!buildingForMusician || (buildingForMusician && !setCreatedGigForInvite)) {
            resetFormData();
            const isRepeat = formData?.repeatData?.repeat && formData?.repeatData?.repeat !== "no";
            const message = editGigData 
              ? `Gig edited successfully.`
              : `Gig${isRepeat ? 's' : ''} created successfully.`;
            toast.success(message);
            setGigPostModal(false);
          }
          // If we set createdGigForInvite in the buildingForMusician block, the modal will be shown
          // and we don't close the gig post modal here - it will be closed when the invite modal closes
          
          setLoading(false);
        } catch (error) {
          setLoading(false);
          toast.error(friendlyError(error));
          console.error('Failed to post gig:', error);
        }
      };

    return (
            <>
            {showInviteMethodsModal && createdGigForInvite && (
              <InviteMethodsModal
                artist={createdGigForInvite.artist}
                gigData={createdGigForInvite.gig}
                venue={createdGigForInvite.venue}
                user={user}
                onClose={() => {
                  setShowInviteMethodsModal(false);
                  setCreatedGigForInvite(null);
                  setGigPostModal(false);
                }}
                onEmailSent={() => {
                  setShowInviteMethodsModal(false);
                  setCreatedGigForInvite(null);
                  setGigPostModal(false);
                }}
              />
            )}
            <div className='modal gig-post' onClick={handleModalClick}>
                <div className='modal-content'>
                    {!loading && (
                      <button 
                        className='btn tertiary close-modal' 
                        onClick={() => {
                          if (editGigData && stage !== 9) {
                            handlePostGig();
                          } else {
                            setGigPostModal(false); 
                            resetFormData();
                          }
                        }}
                      >
                          {editGigData && stage !== 9 ? 'Save and Exit' : 'Cancel'}
                      </button>
                    )}
                    <div className='stage'>
                        {loading ? (
                            <div className='head'>
                                <LoadingSpinner />
                            </div>
                        ) : (
                            renderStageContent()
                        )}
                    </div>
                    {!loading && (
                      <>
                        <div className='progress-bar-container'>
                            <div className='progress-bar' style={{ width: `${getProgressPercentage()}%` }}></div>
                        </div>
                        <div
                            className={`control-buttons ${
                                (stage === 0 || stage === 1) && incompleteGigs?.length === 0 && templates?.length === 0
                                ? 'single'
                                : ''
                            }`}
                        >
                            {(stage === 0 || stage === 1) ? (
                                (incompleteGigs?.length === 0 && templates?.length === 0) ? (
                                    <button className='btn primary' onClick={nextStage}>Next</button>
                                ) : (
                                    <>
                                    <button className='btn secondary' onClick={prevStage}>Back</button>
                                    <button className='btn primary' onClick={nextStage}>Next</button>
                                    </>
                                )
                                ) : stage === 9 ? (
                                <>
                                    <button className='btn secondary' onClick={prevStage}>Back</button>
                                    <button className='btn primary' onClick={handlePostGig}>
                                        {getButtonText()}
                                    </button>
                                </>
                                ) : (
                                <>
                                    <button className='btn secondary' onClick={prevStage}>Back</button>
                                    <button className='btn primary' onClick={nextStage}>Next</button>
                                </>
                            )}
                        </div>
                      </>
                    )}
                </div>
            </div>
            </>
    );
};