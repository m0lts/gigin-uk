import { useState } from 'react';
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

export const GigPostModal = ({ setGigPostModal, venueProfiles, templates, incompleteGigs, editGigData, user }) => {
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
        status: 'open'
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const handleInputChange = (updates) => {
        setFormData((prevFormData) => ({
            ...prevFormData,
            ...updates,
        }));
    };

    const handleModalClick = (e) => {
        if (e.target.className === 'modal') {
          setGigPostModal(false);
        }
    };

    const nextStage = () => {
        if (stage === 0) {
            setStage(prevStage => prevStage + 1);
        }
        if (stage === 1) {
            if ((formData.date !== null && !formData.dateUndecided) || (formData.date === null && formData.dateUndecided)) {
                setStage(prevStage => prevStage + 1);
            }
            return;
        }
        if (stage === 2) {
            if (formData.venue.venueId !== '') {
                setStage(prevStage => prevStage + 1);
            }
            return;
        }
        if (stage === 3) {
            if (formData.gigName && formData.gigName.trim() !== '') {
                setStage(prevStage => prevStage + 1);
            }
            return;
        }
        if (stage === 4) {
            if (formData.kind === '' ) {
                setError(true);
            }
            if (formData.privacy !== '' && formData.kind !== '') {
                setStage(prevStage => prevStage + 1);
            }
            return;
        }
        if (stage === 5) {
            if (formData.gigType !== '') {
                setStage(prevStage => prevStage + 1);
            }
            return;
        }
        if (stage === 6) {
            if (formData.noMusicPreference || (Array.isArray(formData.genre) && formData.genre.length > 0)) {
                setStage(prevStage => prevStage + 1);
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
            }
            return;
        }
        if (stage === 9) {
            if (formData.budget !== '£') {
                setStage(prevStage => prevStage + 1);
            }
            return;
        }
    };
    
    const prevStage = () => {
        setStage(prevStage => prevStage - 1);
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
                    />
                );
            case 2:
                return (
                    <GigLocation
                        formData={formData}
                        handleInputChange={handleInputChange}
                        venueProfiles={venueProfiles}
                        setStage={setStage}
                    />
                );
            case 3:
                return (
                    <GigName
                        formData={formData}
                        handleInputChange={handleInputChange}
                        setStage={setStage}
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
                return (
                    <GigMusic
                        formData={formData}
                        handleInputChange={handleInputChange}
                        setStage={setStage}
                    />
                );
            case 6:
                return (
                    <GigGenre
                        formData={formData}
                        handleInputChange={handleInputChange}
                        setStage={setStage}
                    />
                );
            case 7:
                return (
                    <GigExtraDetails
                        formData={formData}
                        handleInputChange={handleInputChange}
                        setStage={setStage}
                    />
                );
            case 8:
                return (
                    <GigTimings
                        formData={formData}
                        handleInputChange={handleInputChange}
                        setStage={setStage}
                    />
                );
            case 9:
                return (
                    <GigBudget
                        formData={formData}
                        handleInputChange={handleInputChange}
                        setStage={setStage}
                    />
                );
            case 10:
                return (
                    <GigReview
                        formData={formData}
                        handleInputChange={handleInputChange}
                        setStage={setStage}
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
                };
                delete singleGig.repeatData;
                gigDocuments.push(singleGig);
            }
          await postMultipleGigs(formData.venueId, gigDocuments)
          setLoading(false);
          setGigPostModal(false);
        } catch (error) {
          setLoading(false);
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
            };
            delete singleGig.repeatData;
            gigDocuments.push(singleGig);
          }
          await postMultipleGigs(formData.venueId, gigDataPacket)
          setSaving(false);
          setGigPostModal(false);
        } catch (error) {
          setSaving(false);
          console.error('Failed to save gig:', error);
        }
      };

    return (
        <div className='modal gig-post' onClick={handleModalClick}>
            <div className='modal-content'>
                {(stage !== 1 && stage !== 10 && stage !== 0) ? (
                    <button className='btn secondary close' onClick={handleSaveAndExit}>
                        {saving ? 'Saving...' : 'Save and Exit'}
                    </button>
                ) : (stage === 1 || stage === 0) && (
                    <button className='btn secondary close' onClick={() => setGigPostModal(false)}>
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