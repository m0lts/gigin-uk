import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LeftChevronIcon, AmpIcon, DrumsIcon, MicrophoneIcon, PianoIcon, SpeakersIcon } from '/components/ui/Extras/Icons';

export const InHouseEquipment = ({ formData, handleInputChange }) => {

    const navigate = useNavigate();
    const [equipmentAvailable, setEquipmentAvailable] = useState(formData.equipmentAvailable || '');
    const [equipmentType, setEquipmentType] = useState(formData.equipment || []);

    const handleNext = () => {
        if (formData.equipmentAvailable === '') return;
        navigate('/venues/add-venue/photos');
    };

    useEffect(() => {
        if (formData.type === '') {
            navigate('/venues/add-venue');
        }
    }, [formData])

    const handleEquipmentTypeToggle = (type) => {
        const newEquipmentType = equipmentType.includes(type)
            ? equipmentType.filter(item => item !== type)
            : [...equipmentType, type];

        setEquipmentType(newEquipmentType);
        handleInputChange('equipment', newEquipmentType);
    };

    return (
        <div className='stage equipment'>
            <h3>Do you have any equipment available to musicians?</h3>
            <div className='selections'>
                <button 
                    className={`card small centered ${equipmentAvailable === 'yes' ? 'selected' : ''}`}
                    onClick={() => {setEquipmentAvailable('yes'); handleInputChange('equipmentAvailable', 'yes')}}
                >
                    <span className="title">Yes</span>
                </button>
                <button 
                    className={`card small centered ${equipmentAvailable === 'no' ? 'selected' : ''}`}
                    onClick={() => {setEquipmentAvailable('no'); handleInputChange('equipmentAvailable', 'no')}}
                >
                    <span className="title">No</span>
                </button>
            </div>
            {equipmentAvailable === 'yes' && (
                <div className='equipment-type'>
                    <h6>What equipment do you have?</h6>
                    <div className="selections">
                        {['Speakers', 'Microphone', 'Piano', 'Amp', 'Drums'].map(type => (
                            <button 
                                key={type}
                                className={`card small ${equipmentType.includes(type) ? 'selected' : ''}`}
                                onClick={() => handleEquipmentTypeToggle(type)}
                            >
                                <div className="status-dot">
                                    {equipmentType.includes(type) && (
                                        <div className="inner"></div>
                                    )}
                                </div>
                                {type === 'Speakers' && <SpeakersIcon />}
                                {type === 'Microphone' && <MicrophoneIcon />}
                                {type === 'Piano' && <PianoIcon />}
                                {type === 'Amp' && <AmpIcon />}
                                {type === 'Drums' && <DrumsIcon />}
                                <span className="title">{type}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
            <div className="controls">
                <button className='btn secondary' onClick={() => navigate(-1)}>
                    <LeftChevronIcon />
                </button>
                <button className='btn primary' onClick={handleNext}>Continue</button>
            </div>
        </div>
    );
};