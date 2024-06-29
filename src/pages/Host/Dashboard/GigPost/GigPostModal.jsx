import { useEffect, useState } from 'react';
import '/styles/common/modals.styles.css'
import { GigDate } from './Stage1_Date';
import { GigLocation } from './Stage2_Location';
import { GigPrivacy } from './Stage3_Privacy';
import { GigMusic } from './Stage4_Music';
import { GigTimings } from './Stage7_Timings';
import { GigBudget } from './Stage8_Budget';
import { GigReview } from './Stage9_Review';
import { v4 as uuidv4 } from 'uuid';
import '/styles/host/gig-post.styles.css'
import { GigGenre } from './Stage5_Genre';
import { GigExtraDetails } from './Stage6_ExtraDetails';
import { GigTemplates } from './Stage0_Templates';

export const GigPostModal = ({ setGigPostModal, venueProfiles, templates, incompleteGigs, editGigData }) => {

    const [stage, setStage] = useState(incompleteGigs.length > 0 || templates.length > 0 ? 0 : 1);
    const [formData, setFormData] = useState(editGigData ? editGigData : {
        gigId: uuidv4(),
        venue: {
            venueId: '',
            venueName: '',
            address: '',
            photo: null,
        },
        date: null,
        dateUndecided: false,
        coordinates: null,
        privacy: '',
        kind: '',
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
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

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
            setStage(prevStage => prevStage + 1)
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
            if (formData.privacy !== '' && formData.kind !== '') {
                setStage(prevStage => prevStage + 1);
            }
            return;
        }
    
        if (stage === 4) {
            if (formData.gigType !== '') {
                setStage(prevStage => prevStage + 1);
            }
            return;
        }
    
        if (stage === 5) {
            if (formData.noMusicPreference || (Array.isArray(formData.genre) && formData.genre.length > 0)) {
                setStage(prevStage => prevStage + 1);
            }
            return;
        }
    
        if (stage === 6) {
            setStage(prevStage => prevStage + 1);
            return;
        }
    
        if (stage === 7) {
            if (formData.startTime !== '' && formData.duration !== 0) {
                setStage(prevStage => prevStage + 1);
            }
            return;
        }
    
        if (stage === 8) {
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
        switch(stage) {
            case 0:
                if (!editGigData) {
                    return (
                        <GigTemplates
                            templates={templates}
                            incompleteGigs={incompleteGigs}
                            setFormData={setFormData}
                        />
                    )
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
                    <GigPrivacy
                        formData={formData}
                        handleInputChange={handleInputChange}
                        setStage={setStage}
                    />
                );
            case 4:
                return (
                    <GigMusic
                        formData={formData}
                        handleInputChange={handleInputChange}
                        setStage={setStage}
                    />
                );
            case 5:
                return (
                    <GigGenre
                        formData={formData}
                        handleInputChange={handleInputChange}
                        setStage={setStage}
                    />
                );
            case 6:
                return (
                    <GigExtraDetails
                        formData={formData}
                        handleInputChange={handleInputChange}
                        setStage={setStage}
                    />
                );
            case 7:
                return (
                    <GigTimings
                        formData={formData}
                        handleInputChange={handleInputChange}
                        setStage={setStage}
                    />
                );
            case 8:
                return (
                    <GigBudget
                        formData={formData}
                        handleInputChange={handleInputChange}
                        setStage={setStage}
                    />
                );
            case 9:
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
            return ((stage) / 9) * 100;
        } else {
            return ((stage) / 8) * 100;
        }
    };

    const handlePostGig = async () => {
        setLoading(true);
        const gigDataPacket = {
            ...formData,
            complete: true,
        }

        
        const response = await fetch('/api/gigs/postGig', { 
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                gigDataPacket
            }),
        });
    
        if (!response.ok) {
            setLoading(false);
            throw new Error('Failed to post gig');
        } else {
            setLoading(false);
            setGigPostModal(false);
            window.location.reload();
        }

    }    


    const handleSaveAndExit = async () => {
        setSaving(true);

        let gigDataPacket;
        if (formData.complete) {
            gigDataPacket = {
                ...formData,
            } 
        } else {
            gigDataPacket = {
                ...formData,
                complete: false,
            } 
        }

        const response = await fetch('/api/gigs/postGig', { 
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                gigDataPacket
            }),
        });
    
        if (!response.ok) {
            setSaving(false);
            throw new Error('Failed to post gig');
        } else {
            setSaving(false);
            setGigPostModal(false);
            window.location.reload();
        }
    }


    return (
        <div className="modal gig-post" onClick={handleModalClick}>
            <div className="modal-content">
                {(stage !== 1 && stage !== 9 && stage !== 0) ? (
                    <button className="btn secondary close" onClick={handleSaveAndExit}>
                        {saving ? 'Saving...' : 'Save and Exit'}
                    </button>
                ) : (stage === 1 || stage === 0) && (
                    <button className="btn secondary close" onClick={() => setGigPostModal(false)}>
                        Close
                    </button>
                )}
                <div className="stage">
                    {loading ? (
                        <div className="head">
                            <h1 className="title">Posting Gig...</h1>
                        </div>
                    ) : (
                        renderStageContent()
                    )}
                </div>
                <div className="progress-bar-container">
                    <div className="progress-bar" style={{ width: `${getProgressPercentage()}%` }}></div>
                </div>
                <div className={`control-buttons ${(stage === 1 || stage === 0) && 'single'}`}>
                    {(stage === 1 || stage === 0) ? (
                        <button className='btn primary' onClick={nextStage}>Next</button>
                    ) : stage === 9 ? (
                        <>
                            <button className='btn secondary' onClick={prevStage}>Back</button>
                            <button className='btn primary' onClick={handlePostGig}>Post the Gig</button>
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