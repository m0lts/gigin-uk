import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LeftChevronIcon } from '/components/ui/Icons/Icons';

export const InHouseEquipment = ({ formData, handleInputChange }) => {

    const navigate = useNavigate();
    const [equipmentAvailable, setEquipmentAvailable] = useState(formData.equipmentAvailable || '');
    const [equipmentType, setEquipmentType] = useState(formData.equipmentType || []);

    const handleNext = () => {
        if (formData.equipmentAvailable === '') return;
        navigate('/host/venue-builder/photos');
    };

    return (
        <div>
            <h1>In House Equipment</h1>
            <p>Have you any equipment available to musicians?</p>
            <div>
                <button 
                    className={equipmentAvailable === 'yes' ? 'active' : ''}
                    onClick={() => {setEquipmentAvailable('yes'); handleInputChange('equipmentAvailable', 'yes')}}
                >
                    Yes
                </button>
                <button 
                    className={equipmentAvailable === 'no' ? 'active' : ''}
                    onClick={() => {setEquipmentAvailable('no'); handleInputChange('equipmentAvailable', 'no')}}
                >
                    No
                </button>
            </div>
            {equipmentAvailable === 'yes' && (
                <div>
                    <p>What equipment do you have?</p>
                    <button 
                        className={equipmentType === 'Place of Worship' ? 'active' : ''}
                        onClick={() => {setEquipmentType('Place of Worship'); handleInputChange('equipmentType', 'Place of Worship')}}
                    >
                        Place of Worship
                    </button>
                    <button 
                        className={equipmentType === 'Village Hall' ? 'active' : ''}
                        onClick={() => {setEquipmentType('Village Hall'); handleInputChange('equipmentType', 'Village Hall')}}
                    >
                        Village Hall
                    </button>
                    <button 
                        className={equipmentType === 'Pub/Bar' ? 'active' : ''}
                        onClick={() => {setEquipmentType('Pub/Bar'); handleInputChange('equipmentType', 'Pub/Bar')}}
                    >
                        Pub/Bar
                    </button>
                    <button 
                        className={equipmentType === 'Restaurant' ? 'active' : ''}
                        onClick={() => {setEquipmentType('Restaurant'); handleInputChange('equipmentType', 'Restaurant')}}
                    >
                        Restaurant
                    </button>
                    <button 
                        className={equipmentType === 'Music Venue' ? 'active' : ''}
                        onClick={() => {setEquipmentType('Music Venue'); handleInputChange('equipmentType', 'Music Venue')}}
                    >
                        Music Venue
                    </button>
                </div>
            )}
            <button onClick={() => navigate(-1)}>
                <LeftChevronIcon />
            </button>
            <button onClick={handleNext}>Continue</button>
        </div>
    );
};