import { MicrophoneIcon, ClubIcon } from "../../../../components/ui/Extras/Icons";

export const MusicianTypeStage = ({ data, onChange }) => {

    const handleMusicianTypeSelect = (value) => {
        onChange('musicianType', value)
    }

    return (
        <div className="stage musician-type">
            <h3 className="section-title">Music</h3>
            <div className="body">
                <h1>What type of performer are you?</h1>
                    <div className="selections">
                        <div className={`card ${data === 'Musician/Band' ? 'selected' : ''}`} onClick={() => handleMusicianTypeSelect('Musician/Band')}>
                            <MicrophoneIcon />
                            <h4 className="text">Musician/Band</h4>
                        </div>
                        <div className={`card ${data === 'DJ' ? 'selected' : ''}`} onClick={() => handleMusicianTypeSelect('DJ')}>
                            <ClubIcon />
                            <h4 className="text">DJ</h4>
                        </div>
                    </div>            
            </div>
        </div>
    );
};