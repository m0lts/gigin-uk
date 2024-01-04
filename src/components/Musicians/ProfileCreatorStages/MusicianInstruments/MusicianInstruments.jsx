import { useState, useEffect } from "react";
import { DrumIcon, ElectricGuitarIcon, GuitarIcon, KeyboardIcon, MicrophoneIcon, PianoIcon } from "../../../Global/Icons/Icons";

export const MusicianInstruments = ({ musicianInstruments, setMusicianInstruments, setNextButtonAvailable }) => {

    // Musician instruments structure = [{instrument, canTakeToGigs}, {instrument, canTakeToGigs}]
    const [selectedInstruments, setSelectedInstruments] = useState([]);

    // Ensure selectedEquipment is updated with equipment that has already been selected
    useEffect(() => {
        if (musicianInstruments && musicianInstruments.length > 0) {
            setSelectedInstruments(musicianInstruments);
        }
    }, [])

    const handleCardClick = (instrument) => {
        const updatedInstrument = [...selectedInstruments];
        const index = updatedInstrument.findIndex(item => item === instrument);

        if (index === -1) {
            updatedInstrument.push(instrument);
        } else {
            updatedInstrument.splice(index, 1);
        }

        setSelectedInstruments(updatedInstrument);
    }
    
    useEffect(() => {
        setMusicianInstruments(selectedInstruments);
    }, [selectedInstruments, setMusicianInstruments]);

    useEffect(() => {
        if (musicianInstruments && musicianInstruments.length > 0) {
            setNextButtonAvailable(true);
        } else {
            setNextButtonAvailable(false);
        }
      }, [musicianInstruments]);


    return (
        <div className='musician-instruments profile-creator-stage'>
            <h1 className='title'>Show us your skills!</h1>
            <p className="text">Please select any instruments you can play at gigs.</p>
            <div className="options">
                <div 
                    className={`card ${selectedInstruments.includes('Piano') && 'active'}`}
                    onClick={() => handleCardClick('Piano')}
                >   
                    <PianoIcon />
                    <h2 className="text">Piano</h2>
                </div>
                <div 
                    className={`card ${selectedInstruments.includes('Voice') && 'active'}`}
                    onClick={() => handleCardClick('Voice')}
                >
                    <MicrophoneIcon />
                    <h2 className="text">Voice</h2>
                </div>
                <div 
                    className={`card ${selectedInstruments.includes('Acoustic Guitar') && 'active'}`}
                    onClick={() => handleCardClick('Acoustic Guitar')}
                >
                    <GuitarIcon />
                    <h2 className="text">Acoustic Guitar</h2>
                </div>
                <div 
                    className={`card ${selectedInstruments.includes('Electric Guitar') && 'active'}`}
                    onClick={() => handleCardClick('Electric Guitar')}
                >
                    <ElectricGuitarIcon />
                    <h2 className="text">Electric Guitar</h2>
                </div>
                <div 
                    className={`card ${selectedInstruments.includes('Drums') && 'active'}`}
                    onClick={() => handleCardClick('Drums')}
                >
                    <DrumIcon />
                    <h2 className="text">Drums</h2>
                </div>
                <div 
                    className={`card ${selectedInstruments.includes('Electric Keyboard') && 'active'}`}
                    onClick={() => handleCardClick('Electric Keyboard')}
                >
                    <KeyboardIcon />
                    <h2 className="text">Electric Keyboard</h2>
                </div>
            </div>
        </div>
    )
}