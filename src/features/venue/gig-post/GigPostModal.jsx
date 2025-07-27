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
import { postMultipleGigs } from '@services/gigs';
import { toast } from 'sonner';
import { OpenMicGig } from './OpenMic';
import { TicketedGig } from './TicketedGig';
import { GeoPoint, Timestamp } from 'firebase/firestore';
import { formatDate } from '@services/utils/dates';
import { getMusicianProfileByMusicianId } from '../../../services/musicians';
import { sendGigInvitationMessage } from '../../../services/messages';
import { getOrCreateConversation } from '../../../services/conversations';
import { geohashForLocation } from 'geofire-common';

export const GigPostModal = ({ setGigPostModal, venueProfiles, templates, incompleteGigs, editGigData, buildingForMusician, buildingForMusicianData, user }) => {
    const [stage, setStage] = useState(incompleteGigs.length > 0 || templates.length > 0 ? 0 : 1);
    const [formData, setFormData] = useState(editGigData ? editGigData : {
        gigId: uuidv4(),
        venueId: '',
        venue: {
            venueName: '',
            address: '',
            photo: null,
        },
        date: null,
        dateUndecided: false,
        coordinates: null,
        privacy: '',
        kind: '',
        gigName: '',
        gigType: '',
        genre: '',
        noMusicPreference: false,
        startTime: '',
        duration: 0,
        budget: '£',
        extraInformation: '',
        privateApplications: false,
        applicants: [],
        createdAt: new Date(),
        accountName: user.name,
        status: 'open',
        numberOfApplicants: 0,
        openMicApplications: null,
        limitApplications: null,
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const resetFormData = () => {
        setFormData({
            gigId: uuidv4(),
            venueId: '',
            venue: {
                venueName: '',
                address: '',
                photo: null,
            },
            date: null,
            dateUndecided: false,
            coordinates: null,
            privacy: '',
            kind: '',
            gigName: '',
            gigType: '',
            genre: '',
            noMusicPreference: false,
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
        });
    };

    useEffect(() => {
        if (buildingForMusician && buildingForMusicianData) {
            console.log(buildingForMusicianData)
          const { type, genres, venueId } = buildingForMusicianData;
      
          const matchedVenue = venueId
            ? venueProfiles.find(v => v.venueId === venueId)
            : null;
      
          setFormData(prev => ({
            ...prev,
            gigType: type,
            genre: genres,
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

    const nextStage = () => {
        setError('');
    
        if (stage === 0) {
            setStage(prevStage => prevStage + 1);
            return;
        }
    
        if (stage === 1) {
            if ((formData.date !== null && !formData.dateUndecided) || formData.dateUndecided) {
                setStage(prevStage => prevStage + 1);
            } else {
                setError('Please select a date for the gig.');
            }
            return;
        }
    
        if (stage === 2) {
            if (formData.venueId !== '') {
                setStage(prevStage => prevStage + 1);
            } else {
                setError('Please select a venue.');
            }
            return;
        }
    
        if (stage === 3) {
            if (formData.gigName && formData.gigName.trim() !== '') {
                setStage(prevStage => prevStage + 1);
            } else {
                setError('Please give your gig a name.');
            }
            return;
        }
    
        if (stage === 4) {
            if (formData.privacy === '') {
                setError('Please select a privacy setting.');
            } else if (formData.kind === '') {
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
            setStage(prevStage => prevStage + 1);
            return;
        }
    
        if (stage === 8) {
            if (formData.startTime !== '' && formData.duration !== 0) {
                setStage(prevStage => prevStage + 1);
            } else {
                setError('Please enter a start time and gig duration.');
            }
            return;
        }
    
        if (stage === 9) {
            if (formData.kind === 'Open Mic') {
                if (formData.openMicApplications === null) {
                    setError("Please select whether you'd like the musicians to apply.");
                } else if (formData.limitApplications === null) {
                    setError("Please select whether you'd like to limit the amount of musicians.");
                } else if (formData.limitApplications && formData.numberOfApplicants === 0) {
                    setError("Please enter the maximum number of applicants.");
                } else {
                    setStage(prevStage => prevStage + 1);
                }
                return;
            } else if (formData.kind === 'Ticketed Gig') {
                setStage(prevStage => prevStage + 1);
                return;
            } else {
                if (formData.budget !== '£') {
                    setStage(prevStage => prevStage + 1);
                } else {
                    setError('Please enter a budget.');
                }
                return;
            }
        }
    };
    
    const prevStage = () => {
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
                        />
                    );
                } else {
                    setStage(1);
                }
            case 1:
                return (
                    <GigDate
                        formData={formData}
                        handleInputChange={handleInputChange}
                        setStage={setStage}
                        error={error}
                        setError={setError}
                    />
                );
            case 2:
                return (
                    <GigLocation
                        formData={formData}
                        handleInputChange={handleInputChange}
                        venueProfiles={venueProfiles}
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
                    <GigExtraDetails
                        formData={formData}
                        handleInputChange={handleInputChange}
                        setStage={setStage}
                        error={error}
                        setError={setError}
                    />
                );
            case 8:
                return (
                    <GigTimings
                        formData={formData}
                        handleInputChange={handleInputChange}
                        setStage={setStage}
                        error={error}
                        setError={setError}
                    />
                );
            case 9:
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
                } else if (formData.kind === 'Ticketed Gig') {
                    return (
                        <TicketedGig
                            formData={formData}
                            handleInputChange={handleInputChange}
                            setStage={setStage}
                        />
                    );
                } else {
                    return (
                        <GigBudget
                            formData={formData}
                            handleInputChange={handleInputChange}
                            setStage={setStage}
                            error={error}
                            setError={setError}
                        />
                    );
                }
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
                    />
                );
            default:
                return null;
        }
    };

    const getProgressPercentage = () => {
        if (templates.length > 0 || incompleteGigs.length > 0) {
            return ((stage) / 10) * 100;
        } else {
            return ((stage) / 10) * 100;
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
            const startDate = new Date(formData.date);
            let gigDocuments = [];
            if (formData.repeatData.repeat !== 'no') {
                const repeatType = formData.repeatData.repeat;
                const endAfter = parseInt(formData.repeatData.endAfter, 10);
                const endDate = formData.repeatData.endDate ? new Date(formData.repeatData.endDate) : null;
                let i = 0;
                while (true) {
                    let newDate;
                    switch (repeatType) {
                        case 'daily':
                        newDate = addDays(startDate, i);
                        break;
                        case 'weekly':
                        newDate = addWeeks(startDate, i);
                        break;
                        case 'monthly':
                        newDate = addMonths(startDate, i);
                        break;
                        default:
                        newDate = startDate;
                    }
                    const localDate = new Date(newDate.toLocaleString('en-US', { timeZone: 'Europe/London' }));
                    if (endDate && localDate > endDate) {
                        break;
                    }
                    const newGig = {
                        ...formData,
                        gigId: uuidv4(),
                        date: localDate,
                        createdAt: new Date(),
                        complete: true,
                        startDateTime: getStartDateTime(localDate, formData.startTime),
                        ...getGeoField(formData.coordinates),
                        budgetValue: getBudgetValue(formData.budget),
                    };
                    delete newGig.repeatData;
                    gigDocuments.push(newGig);
                    i++;
                    if (endAfter && i >= endAfter) {
                        break;
                    }
                }
            } else {
                const singleGig = {
                    ...formData,
                    createdAt: new Date(),
                    complete: true,
                    startDateTime: getStartDateTime(formData.date, formData.startTime),
                    ...getGeoField(formData.coordinates),
                    budgetValue: getBudgetValue(formData.budget),
                };
                if (buildingForMusician) {
                    const invitationPackage = {
                        id: buildingForMusicianData.id,
                        timestamp: Timestamp.now(),
                        fee: formData.budget || '£0',
                        status: 'pending',
                        invited: true,
                    }
                    if (!Array.isArray(singleGig.applicants)) {
                        singleGig.applicants = [];
                    }
                    singleGig.applicants.push(invitationPackage);
                }
                delete singleGig.repeatData;
                gigDocuments.push(singleGig);
            }
          await postMultipleGigs(formData.venueId, gigDocuments)
          setLoading(false);
          if (buildingForMusician) {
            const venueToSend = user.venueProfiles.find(venue => venue.id === formData.venueId);
            const musicianProfile = await getMusicianProfileByMusicianId(buildingForMusicianData.id);
            const conversationId = await getOrCreateConversation(musicianProfile, formData, venueToSend, 'invitation');
            await sendGigInvitationMessage(conversationId, {
                senderId: user.uid,
                text: `${venueToSend.accountName} has invited you to play at their gig at ${formData.venue.venueName} on the ${formatDate(formData.date)} for ${formData.budget}.
                ${formData.privateApplicationsLink ? `Follow this link to apply: ${formData.privateApplicationsLink}` : ''}`,
            })
          }
          toast.success(`Gig${formData?.repeatData?.repeat && formData?.repeatData?.repeat !== "no" ? 's' : ''} Posted Successfully.`)
          setGigPostModal(false);
        } catch (error) {
          setLoading(false);
          toast.error('Error posting gig. Please try again.')
          console.error('Failed to post gig:', error);
        }
      };


    const handleSaveAndExit = async () => {
        setSaving(true);
        let gigDataPacket;
        if (formData.complete) {
          gigDataPacket = {
            ...formData,
          };
        } else {
          gigDataPacket = {
            ...formData,
            complete: false,
          };
        }
        try {
          const startDate = new Date(gigDataPacket.date);
          let gigDocuments = [];
          if (gigDataPacket.repeatData?.repeat) {
            const repeatType = gigDataPacket.repeatData.repeat;
            const endAfter = parseInt(gigDataPacket.repeatData.endAfter, 10);
            const endDate = gigDataPacket.repeatData.endDate ? new Date(gigDataPacket.repeatData.endDate) : null;
            let i = 0;
            while (true) {
              let newDate;
              switch (repeatType) {
                case 'daily':
                  newDate = addDays(startDate, i);
                  break;
                case 'weekly':
                  newDate = addWeeks(startDate, i);
                  break;
                case 'monthly':
                  newDate = addMonths(startDate, i);
                  break;
                default:
                  newDate = startDate;
              }
              const localDate = new Date(newDate.toLocaleString('en-US', { timeZone: 'Europe/London' }));
              if (endDate && localDate > endDate) {
                break;
              }
              const newGig = {
                ...gigDataPacket,
                gigId: uuidv4(),
                date: localDate,
                complete: false,
                createdAt: new Date(),
                startDateTime: getStartDateTime(localDate, formData.startTime),
                ...getGeoField(formData.coordinates),
                budgetValue: getBudgetValue(formData.budget),
              };
              delete newGig.repeatData;
              gigDocuments.push(newGig);
              i++;
              if (endAfter && i >= endAfter) {
                break;
              }
            }
          } else {
            const singleGig = {
              ...gigDataPacket,
              createdAt: new Date(),
              startDateTime: getStartDateTime(formData.date, formData.startTime),
              ...getGeoField(formData.coordinates),
              budgetValue: getBudgetValue(formData.budget),
            };
            delete singleGig.repeatData;
            gigDocuments.push(singleGig);
          }
          await postMultipleGigs(formData.venueId, gigDocuments);
          setSaving(false);
          toast.success(`Gig${formData?.repeatData ? 's' : ''} Saved.`)
          setGigPostModal(false);
        } catch (error) {
          setSaving(false);
          toast.error('Error saving gig. Please try again.')
          console.error('Failed to save gig:', error);
        }
      };

    return (
        <div className='modal gig-post' onClick={handleModalClick}>
            <div className='modal-content'>
                {(stage !== 1 && stage !== 10 && stage !== 0) ? (
                    <button className='btn tertiary close-modal' onClick={handleSaveAndExit}>
                        {saving ? 'Saving...' : 'Save and Exit'}
                    </button>
                ) : (stage === 1 || stage === 0) && (
                    <button className='btn tertiary close-modal' onClick={() => setGigPostModal(false)}>
                        Close
                    </button>
                )}
                <div className='stage'>
                    {loading ? (
                        <div className='head'>
                            <h1 className='title'>Posting Gig...</h1>
                        </div>
                    ) : (
                        renderStageContent()
                    )}
                </div>
                <div className='progress-bar-container'>
                    <div className='progress-bar' style={{ width: `${getProgressPercentage()}%` }}></div>
                </div>
                <div className={`control-buttons ${(stage === 1 || stage === 0) && 'single'}`}>
                    {(stage === 1 || stage === 0) ? (
                        <button className='btn primary' onClick={nextStage}>Next</button>
                    ) : stage === 10 ? (
                        <>
                            <button className='btn secondary' onClick={prevStage}>Back</button>
                            <button className='btn primary' onClick={handlePostGig}>Post Gig</button>
                        </>
                    ) : (
                        <>
                            <button className='btn secondary' onClick={prevStage}>Back</button>
                            <button className='btn primary' onClick={nextStage}>Next</button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}