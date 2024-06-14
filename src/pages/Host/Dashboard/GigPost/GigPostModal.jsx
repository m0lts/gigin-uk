import { useState } from 'react';
import { CloseIcon } from '/components/ui/Icons/Icons'
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
        noMusicPreference: false,
        startTime: '',
        duration: 0,
        budget: '',
        extraInformation: '',
        privateApplications: false,
    });

    console.log(formData)

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
        // if (stage === 1 && formData.date !== null && formData.dateUndecided === false) {
        //     setStage(prevStage => prevStage + 1);
        // } else if (stage === 1 && formData.date === null && formData.dateUndecided === true){
        //     setStage(prevStage => prevStage + 1);
        // } else {
        //     return;
        // }
        // if (stage === 2 && formData.venueId !== '') {
        //     setStage(prevStage => prevStage + 1);
        // } else {
        //     return;
        // }
        // if (stage === 3 && formData.privacy !== '' && formData.kind !== '') {
        //     setStage(prevStage => prevStage + 1);
        // } else {
        //     return;
        // }
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
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className="modal gig-post" onClick={handleModalClick}>
            <div className="modal-content">
                {(stage !== 1 && stage !== 9) ? (
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
                    ) : stage === 9 ? (
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