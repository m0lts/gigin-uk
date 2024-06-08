import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LeftChevronIcon } from '/components/ui/Icons/Icons';
import { AmpIcon, DrumsIcon, MicrophoneIcon, PianoIcon, SpeakersIcon } from '../../../components/ui/Icons/Icons';

export const InHouseEquipment = ({ formData, handleInputChange }) => {

    const navigate = useNavigate();
    const [equipmentAvailable, setEquipmentAvailable] = useState(formData.equipmentAvailable || '');
    const [equipmentType, setEquipmentType] = useState(formData.equipment || []);

    const handleNext = () => {
        if (formData.equipmentAvailable === '') return;
        navigate('/host/venue-builder/photos');
    };

    useEffect(() => {
        if (formData.type === '') {
            navigate('/host/venue-builder');
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
            <h3 className='subtitle'>Have you any equipment available to musicians?</h3>
            <div className='selections'>
                <button 
                    className={`card small ${equipmentAvailable === 'yes' ? 'selected' : ''}`}
                    onClick={() => {setEquipmentAvailable('yes'); handleInputChange('equipmentAvailable', 'yes')}}
                >
                    <div className="status-dot">
                        {equipmentAvailable === 'yes' && (
                            <div className="inner"></div>
                        )}
                    </div>
                    <span className="title">Yes</span>
                </button>
                <button 
                    className={`card small ${equipmentAvailable === 'no' ? 'selected' : ''}`}
                    onClick={() => {setEquipmentAvailable('no'); handleInputChange('equipmentAvailable', 'no')}}
                >
                    <div className="status-dot">
                        {equipmentAvailable === 'no' && (
                            <div className="inner"></div>
                        )}
                    </div>
                    <span className="title">No</span>
                </button>
            </div>
            {equipmentAvailable === 'yes' && (
                <div className='equipment-type'>
                    <h4>What equipment do you have?</h4>
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
                        {/* <button 
                            className={`card small ${equipmentType === 'Speakers' ? 'selected' : ''}`}
                            onClick={() => {setEquipmentType('Speakers'); handleInputChange('equipmentType', 'Speakers')}}
                        >
                            <div className="status-dot">
                                {equipmentType === 'Speakers' && (
                                    <div className="inner"></div>
                                )}
                            </div>
                            <SpeakersIcon />
                            <span className="title">Speakers</span>
                        </button>
                        <button 
                            className={`card small ${equipmentType === 'Microphone' ? 'selected' : ''}`}
                            onClick={() => {setEquipmentType('Microphone'); handleInputChange('equipmentType', 'Microphone')}}
                        >
                            <div className="status-dot">
                                {equipmentType === 'Microphone' && (
                                    <div className="inner"></div>
                                )}
                            </div>
                            <MicrophoneIcon />
                            <span className="title">Microphone</span>
                        </button>
                        <button 
                            className={`card small ${equipmentType === 'Piano' ? 'selected' : ''}`}
                            onClick={() => {setEquipmentType('Piano'); handleInputChange('equipmentType', 'Piano')}}
                        >
                            <div className="status-dot">
                                {equipmentType === 'Piano' && (
                                    <div className="inner"></div>
                                )}
                            </div>
                            <PianoIcon />
                            <span className="title">Piano</span>
                        </button>
                        <button 
                            className={`card small ${equipmentType === 'Amp' ? 'selected' : ''}`}
                            onClick={() => {setEquipmentType('Amp'); handleInputChange('equipmentType', 'Amp')}}
                        >
                            <div className="status-dot">
                                {equipmentType === 'Amp' && (
                                    <div className="inner"></div>
                                )}
                            </div>
                            <AmpIcon />
                            <span className="title">Amp</span>
                        </button>
                        <button 
                            className={`card small ${equipmentType === 'Drums' ? 'selected' : ''}`}
                            onClick={() => {setEquipmentType('Drums'); handleInputChange('equipmentType', 'Drums')}}
                        >
                            <div className="status-dot">
                                {equipmentType === 'Drums' && (
                                    <div className="inner"></div>
                                )}
                            </div>
                            <DrumsIcon />
                            <span className="title">Drums</span>
                        </button> */}
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