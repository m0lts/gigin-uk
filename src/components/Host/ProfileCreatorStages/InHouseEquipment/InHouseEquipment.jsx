import { useState, useEffect } from "react";
import { AmpIcon, DrumIcon, ElectricGuitarIcon, GuitarIcon, KeyboardIcon, MicrophoneIcon, MicrophoneStandIcon, MixingDeckIcon, MusicVenueIcon, PianoIcon, PlugIcon, SoundSystemIcon } from "../../../Global/Icons/Icons";

export const InHouseEquipment = ({ inHouseEquipment = [], setInHouseEquipment }) => {

    // In House Equipment structure = [{equipment, image}, {equipment, image}]
    const [selectedEquipment, setSelectedEquipment] = useState([]);

    // Ensure selectedEquipment is updated with equipment that has already been selected
    useEffect(() => {
        if (inHouseEquipment && inHouseEquipment.length > 0) {
            const equipmentValues = inHouseEquipment.map(equipment => equipment.equipment);
            setSelectedEquipment(equipmentValues);
        }
    }, [])

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
                    className={`card ${selectedEquipment.includes('DJ Turntable') && 'active'}`}
                    onClick={() => handleEquipmentClick('DJ Turntable')}
                >
                    <MixingDeckIcon />
                    <h2 className="text">DJ Turntable</h2>
                </div>
                <div 
                    className={`card ${selectedEquipment.includes('XLR Cables') && 'active'}`}
                    onClick={() => handleEquipmentClick('XLR Cables')}
                >
                    <PlugIcon />
                    <h2 className="text">XLR Cables</h2>
                </div>
                <div 
                    className={`card ${selectedEquipment.includes('Jack Leads') && 'active'}`}
                    onClick={() => handleEquipmentClick('Jack Leads')}
                >
                    <PlugIcon />
                    <h2 className="text">Jack Leads</h2>
                </div>
                <div 
                    className={`card ${selectedEquipment.includes('Acoustic Guitar') && 'active'}`}
                    onClick={() => handleEquipmentClick('Acoustic Guitar')}
                >
                    <GuitarIcon />
                    <h2 className="text">Acoustic Guitar</h2>
                </div>
                <div 
                    className={`card ${selectedEquipment.includes('Electric Guitar') && 'active'}`}
                    onClick={() => handleEquipmentClick('Electric Guitar')}
                >
                    <ElectricGuitarIcon />
                    <h2 className="text">Electric Guitar</h2>
                </div>
                <div 
                    className={`card ${selectedEquipment.includes('Mic Stands') && 'active'}`}
                    onClick={() => handleEquipmentClick('Mic Stands')}
                >
                    <MicrophoneStandIcon />
                    <h2 className="text">Mic Stands</h2>
                </div>
                <div 
                    className={`card ${selectedEquipment.includes('Drum Kit') && 'active'}`}
                    onClick={() => handleEquipmentClick('Drum Kit')}
                >
                    <DrumIcon />
                    <h2 className="text">Drum Kit</h2>
                </div>
                <div 
                    className={`card ${selectedEquipment.includes('Electric Keyboard') && 'active'}`}
                    onClick={() => handleEquipmentClick('Electric Keyboard')}
                >
                    <KeyboardIcon />
                    <h2 className="text">Electric Keyboard</h2>
                </div>
                <div 
                    className={`card ${selectedEquipment.includes('Foldback Speakers') && 'active'}`}
                    onClick={() => handleEquipmentClick('Foldback Speakers')}
                >
                    <MusicVenueIcon />
                    <h2 className="text">Foldback Speakers</h2>
                </div>
            </div>
        </div>
    )
}