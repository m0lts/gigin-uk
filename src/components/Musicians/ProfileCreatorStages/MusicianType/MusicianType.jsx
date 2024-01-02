import { useState, useEffect } from "react";
import { AlbumIcon, GuitarIcon, MicrophoneIcon, MicrophoneStandIcon, MixingDeckIcon } from "../../../Global/Icons/Icons";

export const MusicianType = ({ musicianType = [], setMusicianType, setMusicianInstruments }) => {

    const [selectedCards, setSelectedCards] = useState([]);

    const handleCardClick = (card) => {
        const updatedSelection = [...selectedCards];
        const index = updatedSelection.indexOf(card);

        if (index === -1) {
            updatedSelection.push(card);
        } else {
            updatedSelection.splice(index, 1);
        }

        if (updatedSelection.includes('Singer / Songwriter')) {
            setMusicianInstruments(['Voice']);
          } else {
            setMusicianInstruments(null);
          }

        setSelectedCards(updatedSelection);
    };

    useEffect(() => {
        setMusicianType(selectedCards);
    }, [selectedCards, setMusicianType]);

    // Ensure the musician types that have already been selected are displayed as selected
    useEffect(() => {
        if (musicianType && musicianType.length > 0) {
            const musicianTypes = musicianType.map(type => type);
            setSelectedCards(musicianTypes);
        }
    }, [])

    return (
        <div className='musician-type profile-creator-stage'>
            <h1 className='title'>What type of musician are you?</h1>
            <p className="text">Select multiple options if necessary.</p>
            <div className="options">
                <div 
                    className={`card ${selectedCards.includes('Instrumentalist / Vocalist') && 'active'}`}
                    onClick={() => handleCardClick('Instrumentalist / Vocalist')}
                >
                    <GuitarIcon />
                    <h2 className="text">Instrumentalist / Vocalist</h2>
                </div>
                <div 
                    className={`card ${selectedCards.includes('Singer / Songwriter') && 'active'}`}
                    onClick={() => handleCardClick('Singer / Songwriter')}
                >
                    <MicrophoneStandIcon />
                    <h2 className="text">Singer / Songwriter</h2>
                </div>
                <div 
                    className={`card ${selectedCards.includes('DJ') && 'active'}`}
                    onClick={() => handleCardClick('DJ')}
                >
                    <MixingDeckIcon />
                    <h2 className="text">DJ</h2>
                </div>
            </div>
        </div>
    )
}