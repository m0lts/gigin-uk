import { useState } from 'react';
import { CloseIcon } from '/components/ui/Icons/Icons'
import '/styles/common/modals.styles.css'
import { GigDate } from './Stage1_Date';
import { GigLocation } from './Stage2_Location';
import { GigPrivacy } from './Stage3_Privacy';
import { GigMusic } from './Stage4_Music';
import { GigTimings } from './Stage5_Timings';
import { GigBudget } from './Stage6_Budget';
import { GigReview } from './Stage7_Review';
import { v4 as uuidv4 } from 'uuid';
import '/styles/host/gig-post.styles.css'

export const GigPostModal = ({ setGigPostModal, venueProfiles, user }) => {

    const [stage, setStage] = useState(1);
    const [formData, setFormData] = useState({
        gigId: uuidv4(),
        venueId: '',
        userId: user.userId,
        date: null,
        dateUndecided: false,
        coordinates: null,
        venueName: '',
        address: '',
        privacy: '',
        kind: '',
        gigType: '',
        genre: '',
        musicType: '',
        startTime: null,
        duration: null,
        budget: '',
        extraInformation: '',
        privateApplications: false,
    });

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
        setStage(prevStage => prevStage + 1);
    };

    const prevStage = () => {
        setStage(prevStage => prevStage - 1);
    };


    const renderStageContent = () => {
        switch(stage) {
            case 1:
                return (
                    <GigDate
                        formData={formData}
                        handleInputChange={handleInputChange}
                    />
                );
            case 2:
                return (
                    <GigLocation
                        formData={formData}
                        handleInputChange={handleInputChange}
                        venueProfiles={venueProfiles}
                    />
                );
            case 3:
                return (
                    <GigPrivacy
                        formData={formData}
                        handleInputChange={handleInputChange}
                    />
                );
            case 4:
                return (
                    <GigMusic
                        formData={formData}
                        handleInputChange={handleInputChange}
                    />
                );
            case 5:
                return (
                    <GigTimings
                        formData={formData}
                        handleInputChange={handleInputChange}
                    />
                );
            case 6:
                return (
                    <GigBudget
                        formData={formData}
                        handleInputChange={handleInputChange}
                    />
                );
            case 7:
                return (
                    <GigReview
                        formData={formData}
                        handleInputChange={handleInputChange}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className="modal gig-post" onClick={handleModalClick}>
            <div className="modal-content">
                {(stage !== 1 && stage !== 7) ? (
                    <button className="btn secondary close" onClick={() => setGigPostModal(false)}>
                        Save and Exit
                    </button>
                ) : stage === 1 && (
                    <button className="btn secondary close" onClick={() => setGigPostModal(false)}>
                        Close
                    </button>
                )}
                <div className="stage">
                    {renderStageContent()}
                </div>
                <div className="progress-bar">

                </div>
                <div className={`control-buttons ${stage === 1 && 'single'}`}>
                    {stage === 1 ? (
                        <button className='btn primary' onClick={nextStage}>Next</button>
                    ) : stage === 7 ? (
                        <>
                            <button className='btn secondary' onClick={prevStage}>Back</button>
                            <button className='btn primary' onClick={() => setGigPostModal(false)}>Post the Gig</button>
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