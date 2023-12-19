import { useState, useEffect } from "react";
import { AmpIcon, MicrophoneIcon, MixingDeckIcon, PianoIcon, SoundSystemIcon } from "../../../Global/Icons/Icons";

export const InHouseEquipment = ({ inHouseEquipment = [], setInHouseEquipment }) => {

    // In House Equipment structure = [{equipment, image}, {equipment: image}]
    const [selectedEquipment, setSelectedEquipment] = useState([]);
    const handleEquipmentClick = (item) => {
        const updatedEquipment = [...selectedEquipment];
        const index = updatedEquipment.findIndex(equip => equip === item);

        if (index === -1) {
            updatedEquipment.push(item);
        } else {
            updatedEquipment.splice(index, 1);
        }

        setSelectedEquipment(updatedEquipment);
    }
    useEffect(() => {
        setInHouseEquipment(selectedEquipment.map(equip => ({ equipment: equip })));
    }, [selectedEquipment, setInHouseEquipment]);

    return (
        <div className='in-house-equipment profile-creator-stage'>
            <h1 className='title'>In House Equipment</h1>
            <p className="text">Please select any equipment at the venue available to the musicians.</p>
            <div className="options">
                <div 
                    className={`card ${selectedEquipment.includes('Piano') && 'active'}`}
                    onClick={() => handleEquipmentClick('Piano')}
                >
                    <PianoIcon />
                    <h2 className="text">Piano</h2>
                </div>
                <div 
                    className={`card ${selectedEquipment.includes('Sound System') && 'active'}`}
                    onClick={() => handleEquipmentClick('Sound System')}
                >
                    <SoundSystemIcon />
                    <h2 className="text">Sound System</h2>
                </div>
                <div 
                    className={`card ${selectedEquipment.includes('Microphone') && 'active'}`}
                    onClick={() => handleEquipmentClick('Microphone')}
                >
                    <MicrophoneIcon />
                    <h2 className="text">Microphone</h2>
                </div>
                <div 
                    className={`card ${selectedEquipment.includes('Amp') && 'active'}`}
                    onClick={() => handleEquipmentClick('Amp')}
                >
                    <AmpIcon />
                    <h2 className="text">Amp</h2>
                </div>
                <div 
                    className={`card ${selectedEquipment.includes('Mixing Deck') && 'active'}`}
                    onClick={() => handleEquipmentClick('Mixing Deck')}
                >
                    <MixingDeckIcon />
                    <h2 className="text">Mixing Deck</h2>
                </div>
            </div>
        </div>
    )
}