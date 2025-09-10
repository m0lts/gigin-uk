import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    LeftChevronIcon,
    AmpIcon,
    DrumsIcon,
    MicrophoneIcon,
    PianoIcon,
    SpeakersIcon } from '@features/shared/ui/extras/Icons';

export const InHouseEquipment = ({ formData, handleInputChange, stepError, setStepError }) => {

    const navigate = useNavigate();
    const [equipmentAvailable, setEquipmentAvailable] = useState(formData.equipmentAvailable || '');
    const [equipmentType, setEquipmentType] = useState(formData.equipment || []);

    const handleNext = () => {
        if (formData.equipmentAvailable === '') {
            setStepError('Please tell us if you have any equipment available.')
            return;
        };
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

    const equipmentOptions = [
        'PA System',
        'Stage Monitors',
        'Guitar Amp',
        'Bass Amp',
        'Mixing/Sound Desk',
        'DI Boxes',
        'Cables (XLRs, Jack Leads)',
        'Guiter',
        'Piano/Keyboard',
        'Bass'
      ]

    return (
        <div className='stage equipment'>
            <div className="stage-content">
                <div className="stage-definition">
                <h1>Equipment in the Venue</h1>
                <p className='stage-copy'>Let musicians know what equipment is available at your venue, so they can bring only what they need.</p>                </div>
                <div className='selections large'>
                    <button 
                        className={`card small centered ${equipmentAvailable === 'yes' ? 'selected' : ''}${stepError ? 'error' : ''}`}
                        onClick={() => {setEquipmentAvailable('yes'); handleInputChange('equipmentAvailable', 'yes')}}
                    >
                        <span className='title'>Yes</span>
                    </button>
                    <button 
                        className={`card small centered ${equipmentAvailable === 'no' ? 'selected' : ''}${stepError ? 'error' : ''}`}
                        onClick={() => {setEquipmentAvailable('no'); handleInputChange('equipmentAvailable', 'no')}}
                    >
                        <span className='title'>No</span>
                    </button>
                </div>
                {equipmentAvailable === 'yes' && (
                    <>
                        <div className='equipment-type'>
                            <h6>Select the equipment available to musicians</h6>
                            <div className='selections'>
                                {equipmentOptions.map(type => (
                                    <button 
                                        key={type}
                                        className={`card small ${equipmentType.includes(type) ? 'selected' : ''} `}
                                        onClick={() => handleEquipmentTypeToggle(type)}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className='input-group'>
                            <label htmlFor='information' className='input-label'>Equipment Information</label>
                            <textarea
                                id='information'
                                placeholder='Provide any extra information about the equipment if required.'
                                value={formData.equipmentInformation}
                                onChange={(e) => handleInputChange('equipmentInformation', e.target.value)}
                            />
                        </div>
                    </>
                )}
            </div>
            <div className='stage-controls'>
                <button className='btn secondary' onClick={() => navigate(-1)}>
                    Back
                </button>
                <button className='btn primary' onClick={handleNext}>Continue</button>
            </div>
        </div>
    );
};