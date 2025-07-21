import { ClubIcon, MicrophoneIcon } from '@features/shared/ui/extras/Icons';
import { ClubIconSolid, MicrophoneIconSolid } from '../../shared/ui/extras/Icons';

export const GigMusic = ({ formData, handleInputChange, setStage, error }) => {
    
    const handleGigTypeSelect = (value) => {
        handleInputChange({
            gigType: value,
        });
        setStage(prevStage => prevStage + 1);
    };

    return (
        <>
            <div className='head'>
                <h1 className='title'>Tell us what type of musician you're after...</h1>
                <p className='text'>Let's get the right fit for you.</p>
            </div>
            <div className='body music'>
                <div className='selections'>
                    <div className={`card ${formData.gigType === 'Musician/Band' ? 'selected' : ''}`} onClick={() => handleGigTypeSelect('Musician/Band')}>
                        {formData.gigType === 'Musician/Band' ? (
                            <MicrophoneIconSolid />
                        ) : (
                            <MicrophoneIcon />
                        )}
                        <h4 className='text'>Musician/Band</h4>
                    </div>
                    <div className={`card ${formData.gigType === 'DJ' ? 'selected' : ''}`} onClick={() => handleGigTypeSelect('DJ')}>
                        {formData.gigType === 'DJ' ? (
                            <ClubIconSolid />
                        ) : (
                            <ClubIcon />
                        )}
                        <h4 className='text'>DJ</h4>
                    </div>
                </div>
                {error && (
                    <div className="error-cont" style={{ width: 'fit-content', margin: '1rem auto' }}>
                        <p className="error-message">{error}</p>
                    </div>
                )}
            </div>
        </>
    );
};
