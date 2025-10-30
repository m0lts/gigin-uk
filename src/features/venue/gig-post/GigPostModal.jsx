import { useState, useEffect } from 'react';
import '@styles/shared/modals.styles.css'
import { GigDate } from './Date';
import { GigLocation } from './Location';
import { GigPrivacy } from './Privacy';
import { GigMusic } from './Music';
import { GigTimings } from './Timings';
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
import { getMusicianProfileByMusicianId, updateMusicianProfile } from '../../../services/client-side/musicians';
import { getOrCreateConversation } from '@services/function-calls/conversations';
import { sendGigInvitationMessage } from '../../../services/client-side/messages';
import { formatDate } from '../../../services/utils/dates';
import Portal from '../../shared/components/Portal';
import { removeVenueRequest } from '../../../services/client-side/venues';
import { hasVenuePerm } from '../../../services/utils/permissions';
import { friendlyError } from '../../../services/utils/errors';
import { inviteToGig, postMultipleGigs } from '../../../services/function-calls/gigs';
import { LoadingSpinner } from '../../shared/ui/loading/Loading';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
  
function formatPounds(amount) {
    if (amount == null || isNaN(amount)) return "£0";
    const rounded = Math.round(amount * 100) / 100;
    return Number.isInteger(rounded) ? `£${rounded}` : `£${rounded.toFixed(2)}`;
}

export const GigPostModal = ({ setGigPostModal, venueProfiles, setVenueProfiles, templates, incompleteGigs, editGigData, buildingForMusician, buildingForMusicianData, user, setBuildingForMusician, setBuildingForMusicianData, setEditGigData, refreshTemplates, refreshGigs, requestId, setRequestId, setRequests }) => {
    const [stage, setStage] = useState(incompleteGigs?.length > 0 || templates?.length > 0 ? 0 : 1);
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
        privateApplications: false,
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
            privateApplications: false,
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
            venue: matchedVenue
              ? {
                  venueName: matchedVenue.name || '',
                  address: matchedVenue.address || '',
                  photo: matchedVenue.photos[0] || '',
                }
              : prev.venue,
          }));
      
          setStage(1);
        }
      }, [buildingForMusician, buildingForMusicianData, venueProfiles]);

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
                setStage(prevStage => prevStage + 1);
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
    
        if (stage === 6) {
            if (formData.noMusicPreference || (Array.isArray(formData.genre) && formData.genre.length > 0)) {
                setStage(prevStage => prevStage + 1);
            } else {
                setError('Please select at least one genre or click no specifics.');
            }
            return;
        }
    
        if (stage === 7) {
            const { valid, error: timingError } = validateGigTimings(formData, extraSlots);
            if (!valid) {
              setError(timingError);
            } else {
              setStage(prevStage => prevStage + 1);
            }
            return;
          }
    
          if (stage === 8) {
            if (formData.kind === 'Open Mic') {
              if (formData.openMicApplications === null) {
                setError("Please select whether you'd like the musicians to apply.");
              }
               else {
                setStage(prev => prev + 1);
              }
              return;
            }

            if (formData.kind === 'Ticketed Gig') {
              if (formData.ticketedGigUnderstood) {
                setStage(prev => prev + 1);
              } else {
                setError("You must click 'I understand' to post a ticketed gig.");
              }
              return;
            }
          
            if (hasAllSlotBudgets(formData, extraSlots)) {
              setStage(prev => prev + 1);
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

        if (stage === 9) {
            setStage(prevStage => prevStage + 1);
        }

    };
    
    const prevStage = () => {
        if (stage === 7 && buildingForMusician && buildingForMusicianData?.type) {
            setStage(prevStage => prevStage - 2);
        }
        setStage(prevStage => prevStage - 1);
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
            case 6:
                if (buildingForMusician && buildingForMusicianData?.genres) {
                    setStage(7);
                    return null;
                }
                return (
                    <GigGenre
                        formData={formData}
                        handleInputChange={handleInputChange}
                        setStage={setStage}
                        error={error}
                        setError={setError}
                    />
                );
            case 7:
                return (
                    <GigTimings
                        formData={formData}
                        handleInputChange={handleInputChange}
                        extraSlots={extraSlots}
                        setExtraSlots={setExtraSlots}
                        error={error}
                    />
                );
            case 8:
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
            case 9:
                return (
                    <GigExtraDetails
                        formData={formData}
                        handleInputChange={handleInputChange}
                    />
                );
            case 10:
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
                    />
                );
            default:
                return null;
        }
    };

    const getProgressPercentage = () => {
        if (templates?.length > 0 || incompleteGigs?.length > 0) {
            if (formData.kind === 'Open Mic' || formData.kind === 'Ticketed Gig') {
                return ((stage) / 10) * 100;
            } else {
                return ((stage) / 10) * 100;
            }
        } else {
            if (formData.kind === 'Open Mic' || formData.kind === 'Ticketed Gig') {
                return ((stage) / 10) * 100;
            } else {
                return ((stage) / 10) * 100;
            }
        }
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
      
              const groupIds = Array.from({ length: allSlots.length }, () => uuidv4());
      
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
                  createdAt: new Date(),
                  complete: true,
                  startDateTime: getStartDateTime(occDate, slot.startTime),
                  startTime: slot.startTime,
                  duration: slot.duration,
                  budget: slotBudgetText,
                  ...getGeoField(formData.coordinates),
                  budgetValue: slotBudgetValue === undefined ? '£' : slotBudgetValue,
                  gigSlots: groupIds.filter(id => id !== slotGigId),
                  status: 'open',
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
                : formData.privateApplications
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
      
              const privateLink =
                base.privateApplications
                  ? `https://www.giginmusic.com/gig/${formData.gigId}?token=${base.privateApplicationToken ?? uuidv4()}`
                  : null;
      
              const singleGig = {
                ...base,
                gigId: occurrenceGigId,
                date: occDate,
                createdAt: new Date(),
                complete: true,
                startDateTime: getStartDateTime(occDate, base.startTime),
                ...getGeoField(base.coordinates),
                budgetValue: getBudgetValue(base.budget),
                privateApplicationsLink: privateLink,
                status: 'open',
                venueId: formData.venueId,
                ...(editGigData ? applicantsForEdit : applicantsForNew),
              };
      
              allGigsToPost.push(singleGig);
              if (!firstGigDoc) firstGigDoc = singleGig;
            }
          }
      
          const newGigIds = await postMultipleGigs(formData.venueId, allGigsToPost);

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
            const musicianProfile = await getMusicianProfileByMusicianId(buildingForMusicianData.id);
            const res = await inviteToGig(firstGigDoc.gigId, musicianProfile);
            if (!res.ok) {
              if (res.code === "permission-denied") {
                toast.error("You don’t have permission to invite musicians for this venue.");
              } else if (res.code === "failed-precondition") {
                toast.error("This gig is missing required venue info.");
              } else {
                toast.error("Error inviting musician. Do you have permission to invite musicians to gigs at this venue?");
              }
              return;
            }
            const conversationId = await getOrCreateConversation(
              musicianProfile,
              firstGigDoc,
              venueToSend,
              "invitation"
            );
            if (formData.kind !== 'Ticketed Gig' && formData.kind !== 'Open Mic') {
              await sendGigInvitationMessage(conversationId, {
                senderId: user.uid,
                text: `${venueToSend.accountName} has invited ${musicianProfile.name} to play at their gig at ${formData.venue.venueName} on the ${formatDate(firstGigDoc.date, 'long')} for ${firstGigDoc.budget}.
                  ${firstGigDoc.privateApplicationsLink ? `Follow this link to apply: ${firstGigDoc.privateApplicationsLink}` : ""}`,
              });
            } else {
              await sendGigInvitationMessage(conversationId, {
                senderId: user.uid,
                text: `${venueToSend.accountName} has invited ${musicianProfile.name} to play at their gig at ${formData.venue.venueName} on the ${formatDate(firstGigDoc.date, 'long')}.
                  ${firstGigDoc.privateApplicationsLink ? `Follow this link to apply: ${firstGigDoc.privateApplicationsLink}` : ""}`,
              });
            }
            if (requestId) {
              await removeVenueRequest(requestId);
              setRequests(prev =>
                prev.map(req => req.id === requestId ? { ...req, removed: true } : req)
              );
              setRequestId(null);
            }
            setBuildingForMusician(false);
            setBuildingForMusicianData(false);
          }
          await refreshGigs();
          resetFormData();
          toast.success(`Gig${formData?.repeatData?.repeat && formData?.repeatData?.repeat !== "no" ? 's' : ''} Posted Successfully.`);
          setGigPostModal(false);
          setLoading(false);
        } catch (error) {
          setLoading(false);
          toast.error(friendlyError(error));
          console.error('Failed to post gig:', error);
        }
      };

    return (
            <div className='modal gig-post' onClick={handleModalClick}>
                <div className='modal-content'>
                    {!loading && (
                      <button className='btn tertiary close-modal' onClick={() => {setGigPostModal(false); resetFormData()}}>
                          Cancel
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
                                ) : stage === 10 ? (
                                <>
                                    <button className='btn secondary' onClick={prevStage}>Back</button>
                                    <button className='btn primary' onClick={handlePostGig}>
                                        Post Gig{formData?.repeatData?.repeat && formData?.repeatData?.repeat !== "no" ? 's' : ''}
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
    )
}