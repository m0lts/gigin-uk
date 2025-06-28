import { ClubIcon, MicrophoneIcon } from '@features/shared/ui/extras/Icons';

export const GigMusic = ({ formData, handleInputChange, setStage }) => {
    
    const handleGigTypeSelect = (value) => {
        handleInputChange({
            gigType: value,
        });
        setStage(prevStage => prevStage + 1);
    };

    return (
        <>
            <div className='head'>
                <h1 className='title'>Tell us what music you're after...</h1>
                <p className='text'>Let's personalise your music experience.</p>
            </div>
            <div className='body music'>
                <div className='selections'>
                    <div className={`card ${formData.gigType === 'Musician/Band' ? 'selected' : ''}`} onClick={() => handleGigTypeSelect('Musician/Band')}>
                        <MicrophoneIcon />
                        <h4 className='text'>Musician/Band</h4>
                    </div>
                    <div className={`card ${formData.gigType === 'DJ' ? 'selected' : ''}`} onClick={() => handleGigTypeSelect('DJ')}>
                        <ClubIcon />
                        <h4 className='text'>DJ</h4>
                    </div>
                </div>
            </div>
        </>
    );
};
