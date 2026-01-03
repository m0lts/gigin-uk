import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export const InHouseEquipment = ({ formData, handleInputChange, stepError, setStepError }) => {

    const navigate = useNavigate();

    // Initialize tech rider data structure
    const [techRider, setTechRider] = useState(formData.techRider || {
        soundSystem: {
            pa: { available: '', notes: '' },
            mixingConsole: { available: '', notes: '' },
            vocalMics: { count: '', notes: '' },
            diBoxes: { count: '', notes: '' },
            monitoring: '',
            cables: ''
        },
        backline: {
            drumKit: { available: '', notes: '' },
            bassAmp: { available: '', notes: '' },
            guitarAmp: { available: '', notes: '' },
            keyboard: { available: '', notes: '' },
            other: '',
            stageSize: ''
        },
        houseRules: {
            volumeLevel: '',
            volumeNotes: '',
            noiseCurfew: '',
            powerAccess: '',
            houseRules: ''
        }
    });

    useEffect(() => {
        if (formData.type === '') {
            navigate('/venues/add-venue');
        }
    }, [formData, navigate]);

    // Sync techRider from formData when it's loaded externally (e.g., saved venue)
    // Use a ref to track if we've already synced to avoid loops
    const techRiderSyncedRef = useRef(false);
    useEffect(() => {
        if (formData.techRider && !techRiderSyncedRef.current) {
            setTechRider(formData.techRider);
            techRiderSyncedRef.current = true;
        }
    }, [formData.techRider]);

    // Update formData whenever techRider changes (debounced to avoid excessive updates)
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            handleInputChange('techRider', techRider);
        }, 0);
        return () => clearTimeout(timeoutId);
    }, [techRider, handleInputChange]);

    const handleSoundSystemChange = (field, value) => {
        setTechRider(prev => ({
            ...prev,
            soundSystem: {
                ...prev.soundSystem,
                [field]: value
            }
        }));
        setStepError(null);
    };

    const handleBacklineChange = (field, value) => {
        setTechRider(prev => ({
            ...prev,
            backline: {
                ...prev.backline,
                [field]: value
            }
        }));
        setStepError(null);
    };

    const handleHouseRulesChange = (field, value) => {
        setTechRider(prev => ({
            ...prev,
            houseRules: {
                ...prev.houseRules,
                [field]: value
            }
        }));
        setStepError(null);
    };

    const handleYesNoToggle = (section, field, value) => {
        if (section === 'soundSystem') {
            setTechRider(prev => ({
                ...prev,
                soundSystem: {
                    ...prev.soundSystem,
                    [field]: {
                        ...prev.soundSystem[field],
                        available: value
                    }
                }
            }));
        } else if (section === 'backline') {
            setTechRider(prev => ({
                ...prev,
                backline: {
                    ...prev.backline,
                    [field]: {
                        ...prev.backline[field],
                        available: value
                    }
                }
            }));
        }
        setStepError(null);
    };

    const handleNotesChange = (section, field, value) => {
        if (section === 'soundSystem') {
            setTechRider(prev => ({
                ...prev,
                soundSystem: {
                    ...prev.soundSystem,
                    [field]: {
                        ...prev.soundSystem[field],
                        notes: value
                    }
                }
            }));
        } else if (section === 'backline') {
            setTechRider(prev => ({
                ...prev,
                backline: {
                    ...prev.backline,
                    [field]: {
                        ...prev.backline[field],
                        notes: value
                    }
                }
            }));
        }
        setStepError(null);
    };

    const handleCountChange = (section, field, value) => {
        if (section === 'soundSystem') {
            setTechRider(prev => ({
                ...prev,
                soundSystem: {
                    ...prev.soundSystem,
                    [field]: {
                        ...prev.soundSystem[field],
                        count: value
                    }
                }
            }));
        }
        setStepError(null);
    };

    const validateRequiredFields = () => {
        const errors = [];
        
        if (!techRider.soundSystem.pa.available || techRider.soundSystem.pa.available === '') {
            errors.push('PA');
        }
        if (!techRider.soundSystem.mixingConsole.available || techRider.soundSystem.mixingConsole.available === '') {
            errors.push('Mixing Console');
        }
        if (techRider.soundSystem.vocalMics.count === '' || techRider.soundSystem.vocalMics.count === null || techRider.soundSystem.vocalMics.count === undefined) {
            errors.push('No of Vocal mics available');
        }
        if (techRider.soundSystem.diBoxes.count === '' || techRider.soundSystem.diBoxes.count === null || techRider.soundSystem.diBoxes.count === undefined) {
            errors.push('No of DI boxes available');
        }
        if (!techRider.backline.drumKit.available || techRider.backline.drumKit.available === '') {
            errors.push('Drum kit');
        }
        if (!techRider.backline.bassAmp.available || techRider.backline.bassAmp.available === '') {
            errors.push('Bass amp');
        }
        if (!techRider.backline.guitarAmp.available || techRider.backline.guitarAmp.available === '') {
            errors.push('Guitar amp');
        }
        if (!techRider.backline.keyboard.available || techRider.backline.keyboard.available === '') {
            errors.push('Keyboard');
        }
        
        return errors;
    };

    const getFieldError = (fieldName) => {
        if (!stepError) return false;
        const errors = validateRequiredFields();
        return errors.includes(fieldName);
    };

    const handleNext = () => {
        const errors = validateRequiredFields();
        
        if (errors.length > 0) {
            setStepError(`Please fill in all required fields: ${errors.join(', ')}`);
            return;
        }
        
        setStepError(null);
        navigate('/venues/add-venue/photos');
    };

    return (
        <div className='stage equipment'>
            <div className="stage-content">
                <div className="stage-definition">
                    <h1>Tech Rider</h1>
                    <p className='stage-copy'>Provide details about your venue's equipment and house rules to help musicians prepare for their performance.</p>
                </div>

                {/* Sound System and Monitoring Section */}
                <div className='tech-rider-section'>
                    <h2>Sound System and Monitoring</h2>
                    
                    {/* PA */}
                    <div className='input-group'>
                        <label className='input-label'>PA<span className='required-asterisk'>*</span></label>
                        <div className='selections'>
                            <button 
                                className={`card small centered ${techRider.soundSystem.pa.available === 'yes' ? 'selected' : ''}`}
                                onClick={() => handleYesNoToggle('soundSystem', 'pa', 'yes')}
                            >
                                <span className='title'>Yes</span>
                            </button>
                            <button 
                                className={`card small centered ${techRider.soundSystem.pa.available === 'no' ? 'selected' : ''}`}
                                onClick={() => handleYesNoToggle('soundSystem', 'pa', 'no')}
                            >
                                <span className='title'>No</span>
                            </button>
                        </div>
                        <div className='input-group' style={{ marginTop: '1rem' }}>
                            <textarea
                                placeholder='Notes'
                                value={techRider.soundSystem.pa.notes}
                                onChange={(e) => handleNotesChange('soundSystem', 'pa', e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Mixing Console */}
                    <div className='input-group'>
                        <label className='input-label'>Mixing Console<span className='required-asterisk'>*</span></label>
                        <div className={`selections ${getFieldError('Mixing Console') ? 'error' : ''}`}>
                    <button 
                                className={`card small centered ${techRider.soundSystem.mixingConsole.available === 'yes' ? 'selected' : ''} ${getFieldError('Mixing Console') ? 'error' : ''}`}
                                onClick={() => handleYesNoToggle('soundSystem', 'mixingConsole', 'yes')}
                    >
                        <span className='title'>Yes</span>
                    </button>
                    <button 
                                className={`card small centered ${techRider.soundSystem.mixingConsole.available === 'no' ? 'selected' : ''} ${getFieldError('Mixing Console') ? 'error' : ''}`}
                                onClick={() => handleYesNoToggle('soundSystem', 'mixingConsole', 'no')}
                    >
                        <span className='title'>No</span>
                    </button>
                        </div>
                        <div className='input-group' style={{ marginTop: '1rem' }}>
                            <textarea
                                placeholder='Notes (e.g. number of channels)'
                                value={techRider.soundSystem.mixingConsole.notes}
                                onChange={(e) => handleNotesChange('soundSystem', 'mixingConsole', e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Vocal Mics */}
                    <div className='input-group'>
                        <label className='input-label'>No of Vocal mics available<span className='required-asterisk'>*</span></label>
                        <input
                            type='number'
                            className={`input ${getFieldError('No of Vocal mics available') ? 'error' : ''}`}
                            placeholder='Number'
                            min='0'
                            value={techRider.soundSystem.vocalMics.count}
                            onChange={(e) => handleCountChange('soundSystem', 'vocalMics', e.target.value)}
                        />
                        <textarea
                            style={{ marginTop: '0.5rem' }}
                            placeholder='Notes (e.g. mic stands?)'
                            value={techRider.soundSystem.vocalMics.notes}
                            onChange={(e) => handleNotesChange('soundSystem', 'vocalMics', e.target.value)}
                        />
                    </div>

                    {/* DI Boxes */}
                    <div className='input-group'>
                        <label className='input-label'>No of DI boxes available<span className='required-asterisk'>*</span></label>
                        <input
                            type='number'
                            className={`input ${getFieldError('No of DI boxes available') ? 'error' : ''}`}
                            placeholder='Number'
                            min='0'
                            value={techRider.soundSystem.diBoxes.count}
                            onChange={(e) => handleCountChange('soundSystem', 'diBoxes', e.target.value)}
                        />
                        <textarea
                            style={{ marginTop: '0.5rem' }}
                            placeholder='Notes'
                            value={techRider.soundSystem.diBoxes.notes}
                            onChange={(e) => handleNotesChange('soundSystem', 'diBoxes', e.target.value)}
                        />
                    </div>

                    {/* Monitoring */}
                    <div className='input-group'>
                        <label htmlFor='monitoring' className='input-label'>Monitoring</label>
                        <textarea
                            id='monitoring'
                            placeholder='Wedges, allow in-ear monitoring?'
                            value={techRider.soundSystem.monitoring}
                            onChange={(e) => handleSoundSystemChange('monitoring', e.target.value)}
                        />
                    </div>

                    {/* Cables */}
                    <div className='input-group'>
                        <label htmlFor='cables' className='input-label'>Cables</label>
                        <textarea
                            id='cables'
                            placeholder='What cables do you have available?'
                            value={techRider.soundSystem.cables}
                            onChange={(e) => handleSoundSystemChange('cables', e.target.value)}
                        />
                    </div>
                </div>

                {/* Backline Section */}
                <div className='tech-rider-section' style={{ marginTop: '2rem' }}>
                    <h2>Backline</h2>
                    
                    {/* Drum Kit */}
                    <div className='input-group'>
                        <label className='input-label'>Drum kit?<span className='required-asterisk'>*</span></label>
                        <div className={`selections ${getFieldError('Drum kit') ? 'error' : ''}`}>
                            <button 
                                className={`card small centered ${techRider.backline.drumKit.available === 'yes' ? 'selected' : ''} ${getFieldError('Drum kit') ? 'error' : ''}`}
                                onClick={() => handleYesNoToggle('backline', 'drumKit', 'yes')}
                            >
                                <span className='title'>Yes</span>
                            </button>
                            <button 
                                className={`card small centered ${techRider.backline.drumKit.available === 'no' ? 'selected' : ''} ${getFieldError('Drum kit') ? 'error' : ''}`}
                                onClick={() => handleYesNoToggle('backline', 'drumKit', 'no')}
                            >
                                <span className='title'>No</span>
                            </button>
                        </div>
                        <div className='input-group' style={{ marginTop: '1rem' }}>
                            <textarea
                                placeholder='Notes'
                                value={techRider.backline.drumKit.notes}
                                onChange={(e) => handleNotesChange('backline', 'drumKit', e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Bass Amp */}
                    <div className='input-group'>
                        <label className='input-label'>Bass amp?<span className='required-asterisk'>*</span></label>
                        <div className={`selections ${getFieldError('Bass amp') ? 'error' : ''}`}>
                            <button 
                                className={`card small centered ${techRider.backline.bassAmp.available === 'yes' ? 'selected' : ''} ${getFieldError('Bass amp') ? 'error' : ''}`}
                                onClick={() => handleYesNoToggle('backline', 'bassAmp', 'yes')}
                            >
                                <span className='title'>Yes</span>
                            </button>
                            <button 
                                className={`card small centered ${techRider.backline.bassAmp.available === 'no' ? 'selected' : ''} ${getFieldError('Bass amp') ? 'error' : ''}`}
                                onClick={() => handleYesNoToggle('backline', 'bassAmp', 'no')}
                            >
                                <span className='title'>No</span>
                            </button>
                        </div>
                        <div className='input-group' style={{ marginTop: '1rem' }}>
                            <textarea
                                placeholder='Notes'
                                value={techRider.backline.bassAmp.notes}
                                onChange={(e) => handleNotesChange('backline', 'bassAmp', e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Guitar Amp */}
                    <div className='input-group'>
                        <label className='input-label'>Guitar amp?<span className='required-asterisk'>*</span></label>
                            <div className={`selections ${getFieldError('Guitar amp') ? 'error' : ''}`}>
                            <button 
                                className={`card small centered ${techRider.backline.guitarAmp.available === 'yes' ? 'selected' : ''} ${getFieldError('Guitar amp') ? 'error' : ''}`}
                                onClick={() => handleYesNoToggle('backline', 'guitarAmp', 'yes')}
                            >
                                <span className='title'>Yes</span>
                            </button>
                                    <button 
                                className={`card small centered ${techRider.backline.guitarAmp.available === 'no' ? 'selected' : ''} ${getFieldError('Guitar amp') ? 'error' : ''}`}
                                onClick={() => handleYesNoToggle('backline', 'guitarAmp', 'no')}
                                    >
                                <span className='title'>No</span>
                                    </button>
                            </div>
                        <div className='input-group' style={{ marginTop: '1rem' }}>
                            <textarea
                                placeholder='Notes'
                                value={techRider.backline.guitarAmp.notes}
                                onChange={(e) => handleNotesChange('backline', 'guitarAmp', e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Keyboard */}
                        <div className='input-group'>
                        <label className='input-label'>Keyboard?<span className='required-asterisk'>*</span></label>
                        <div className={`selections ${getFieldError('Keyboard') ? 'error' : ''}`}>
                            <button 
                                className={`card small centered ${techRider.backline.keyboard.available === 'yes' ? 'selected' : ''} ${getFieldError('Keyboard') ? 'error' : ''}`}
                                onClick={() => handleYesNoToggle('backline', 'keyboard', 'yes')}
                            >
                                <span className='title'>Yes</span>
                            </button>
                            <button 
                                className={`card small centered ${techRider.backline.keyboard.available === 'no' ? 'selected' : ''} ${getFieldError('Keyboard') ? 'error' : ''}`}
                                onClick={() => handleYesNoToggle('backline', 'keyboard', 'no')}
                            >
                                <span className='title'>No</span>
                            </button>
                        </div>
                        <div className='input-group' style={{ marginTop: '1rem' }}>
                            <textarea
                                placeholder='Notes (W stand?)'
                                value={techRider.backline.keyboard.notes}
                                onChange={(e) => handleNotesChange('backline', 'keyboard', e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Other */}
                    <div className='input-group'>
                        <label htmlFor='other' className='input-label'>Other Notes</label>
                        <textarea
                            id='other'
                            placeholder='Notes'
                            value={techRider.backline.other}
                            onChange={(e) => handleBacklineChange('other', e.target.value)}
                        />
                        </div>

                    {/* Stage Size */}
                        <div className='input-group'>
                        <label htmlFor='stageSize' className='input-label'>Stage size</label>
                            <textarea
                            id='stageSize'
                            placeholder='Give an idea of how many performers can fit on the stage, or dimensions of performing area.'
                            value={techRider.backline.stageSize}
                            onChange={(e) => handleBacklineChange('stageSize', e.target.value)}
                        />
                    </div>
                </div>

                {/* House Rules Section */}
                <div className='tech-rider-section' style={{ marginTop: '2rem' }}>
                    <h2>House Rules</h2>
                    
                    {/* Volume Level */}
                    <div className='input-group'>
                        <label className='input-label'>Volume level</label>
                        <div className='selections'>
                            {['quiet', 'moderate', 'loud'].map(level => (
                                <button
                                    key={level}
                                    className={`card small centered ${techRider.houseRules.volumeLevel === level ? 'selected' : ''}`}
                                    onClick={() => handleHouseRulesChange('volumeLevel', level)}
                                >
                                    <span className='title'>{level.charAt(0).toUpperCase() + level.slice(1)}</span>
                                </button>
                            ))}
                        </div>
                        {techRider.houseRules.volumeLevel && (
                            <div className='input-group' style={{ marginTop: '1rem' }}>
                                <input
                                    type='text'
                                    className='input'
                                    placeholder='Notes'
                                    value={techRider.houseRules.volumeNotes}
                                    onChange={(e) => handleHouseRulesChange('volumeNotes', e.target.value)}
                                />
                            </div>
                        )}
                    </div>

                    {/* Noise Curfew */}
                    <div className='input-group'>
                        <label htmlFor='noiseCurfew' className='input-label'>Noise curfew</label>
                        <input
                            type='time'
                            id='noiseCurfew'
                            className='input'
                            value={techRider.houseRules.noiseCurfew}
                            onChange={(e) => handleHouseRulesChange('noiseCurfew', e.target.value)}
                        />
                    </div>

                    {/* Power Access */}
                    <div className='input-group'>
                        <label htmlFor='powerAccess' className='input-label'>Power access</label>
                        <textarea
                            id='powerAccess'
                            placeholder='Power access information'
                            value={techRider.houseRules.powerAccess}
                            onChange={(e) => handleHouseRulesChange('powerAccess', e.target.value)}
                        />
                    </div>

                    {/* House Rules */}
                    <div className='input-group'>
                        <label htmlFor='houseRules' className='input-label'>House rules</label>
                        <textarea
                            id='houseRules'
                            placeholder='House rules'
                            value={techRider.houseRules.houseRules}
                            onChange={(e) => handleHouseRulesChange('houseRules', e.target.value)}
                        />
                    </div>
                </div>
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
