import { MicrophoneIcon, ClubIcon } from '@features/shared/ui/extras/Icons';
import { PeopleGroupIcon } from '../../shared/ui/extras/Icons';

export const MusicianTypeStage = ({ data, onChange, band = false }) => {

    const handleMusicianTypeSelect = (value) => {
        onChange('musicianType', value)
    }

    return (
        <div className='stage musician-type'>
            <h3 className='section-title'>Music</h3>
            <div className='body'>
                <h1>What type of performer are you?</h1>
                    <div className='selections'>
                        <div className={`card ${data === 'Musician' ? 'selected' : ''}`} onClick={() => handleMusicianTypeSelect('Musician')}>
                            <MicrophoneIcon />
                            <h4 className='text'>Musician</h4>
                        </div>
                        {band && (
                            <div className={`card ${data === 'Band' ? 'selected' : ''}`} onClick={() => handleMusicianTypeSelect('Band')}>
                                <PeopleGroupIcon />
                                <h4 className='text'>Band</h4>
                            </div>
                        )}
                        <div className={`card ${data === 'DJ' ? 'selected' : ''}`} onClick={() => handleMusicianTypeSelect('DJ')}>
                            <ClubIcon />
                            <h4 className='text'>DJ</h4>
                        </div>
                    </div>            
            </div>
        </div>
    );
};