import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    EQUIPMENT_DEFAULTS,
    normalizeTechRider,
    buildNewTechRiderShape,
} from './techRiderConfig';

export const InHouseEquipment = ({ formData, handleInputChange, stepError, setStepError }) => {
    const navigate = useNavigate();

    const [techRider, setTechRider] = useState(() =>
        formData.techRider ? normalizeTechRider(formData.techRider) : buildNewTechRiderShape()
    );

    const techRiderSyncedRef = useRef(false);
    useEffect(() => {
        if (formData.techRider && !techRiderSyncedRef.current) {
            setTechRider(normalizeTechRider(formData.techRider));
            techRiderSyncedRef.current = true;
        }
    }, [formData.techRider]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            handleInputChange('techRider', techRider);
        }, 0);
        return () => clearTimeout(timeoutId);
    }, [techRider, handleInputChange]);

    const updateEquipment = (key, updates) => {
        setTechRider((prev) => ({
            ...prev,
            equipment: prev.equipment.map((item) =>
                item.key === key ? { ...item, ...updates } : item
            ),
        }));
        setStepError(null);
    };

    const updateStageSetup = (field, value) => {
        setTechRider((prev) => ({
            ...prev,
            stageSetup: { ...prev.stageSetup, [field]: value },
        }));
        setStepError(null);
    };

    const updateHouseRules = (field, value) => {
        setTechRider((prev) => ({
            ...prev,
            houseRules: { ...prev.houseRules, [field]: value },
        }));
        setStepError(null);
    };

    const handleNext = () => {
        setStepError(null);
        navigate('/venues/add-venue/photos');
    };

    const [expandedNotes, setExpandedNotes] = useState({});
    const toggleNotes = (key) => {
        setExpandedNotes((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <div className="stage equipment">
            <div className="stage-content">
                <div className="stage-definition">
                    <h1>Tech Spec</h1>
                </div>

                {/* A) Equipment & Backline */}
                <section className="tech-rider-section tech-rider-section--equipment">
                    <h2>Equipment & Backline</h2>
                    <p className="tech-rider-helper">Turn on Available for each item you offer, then set pricing and optional notes.</p>
                    <div className="tech-rider-equipment-grid">
                        {(techRider.equipment || []).map((item) => {
                            const def = EQUIPMENT_DEFAULTS.find((d) => d.key === item.key);
                            const hasQuantity = def?.hasQuantity ?? false;
                            const showNotes = expandedNotes[item.key];
                            const hasNotes = Boolean(item.notes && String(item.notes).trim());
                            return (
                                <div
                                    key={item.key}
                                    className={`tech-rider-equipment-tile ${!item.available ? 'tech-rider-equipment-tile--unavailable' : ''}`}
                                >
                                    <div className="tech-rider-equipment-tile-header">
                                        <span className="tech-rider-equipment-label">{item.label}</span>
                                        <label className="tech-rider-available-toggle">
                                            <span className="tech-rider-available-label">{item.available ? 'Available' : 'Not Available'}</span>
                                            <span className="tech-rider-toggle-switch">
                                                <input
                                                    type="checkbox"
                                                    checked={!!item.available}
                                                    onChange={(e) => updateEquipment(item.key, { available: e.target.checked })}
                                                />
                                                <span className="tech-rider-toggle-slider" />
                                            </span>
                                        </label>
                                    </div>
                                    {item.available && (
                                        <>
                                            <div className="tech-rider-equipment-controls">
                                                <div className="tech-rider-segments">
                                                    <label className="tech-rider-segment">
                                                        <input
                                                            type="radio"
                                                            name={`pricing-${item.key}`}
                                                            checked={item.pricing !== 'hire'}
                                                            onChange={() => updateEquipment(item.key, { pricing: 'free', hireFee: null })}
                                                        />
                                                        <span>Free</span>
                                                    </label>
                                                    <label className="tech-rider-segment">
                                                        <input
                                                            type="radio"
                                                            name={`pricing-${item.key}`}
                                                            checked={item.pricing === 'hire'}
                                                            onChange={() => updateEquipment(item.key, { pricing: 'hire' })}
                                                        />
                                                        <span>Hire</span>
                                                    </label>
                                                </div>
                                                {item.pricing === 'hire' && (
                                                    <span className="tech-rider-hire-input-wrap">
                                                        <span className="tech-rider-currency" aria-hidden="true">£</span>
                                                        <input
                                                            type="number"
                                                            className="input tech-rider-hire-input"
                                                            min="0"
                                                            step="1"
                                                            placeholder="0"
                                                            value={item.hireFee ?? ''}
                                                            onChange={(e) =>
                                                                updateEquipment(item.key, {
                                                                    hireFee: e.target.value === '' ? null : e.target.value,
                                                                })
                                                            }
                                                        />
                                                    </span>
                                                )}
                                                {hasQuantity && (
                                                    <span className="tech-rider-quantity-inline">
                                                        <span className="tech-rider-quantity-label">Qty</span>
                                                        <input
                                                            type="number"
                                                            className="input tech-rider-quantity-input"
                                                            min="0"
                                                            placeholder="0"
                                                            value={item.quantity ?? ''}
                                                            onChange={(e) =>
                                                                updateEquipment(item.key, {
                                                                    quantity: e.target.value === '' ? null : e.target.value,
                                                                })
                                                            }
                                                        />
                                                    </span>
                                                )}
                                                <button
                                                    type="button"
                                                    className="btn tertiary tech-rider-add-note-btn"
                                                    onClick={() => {
                                                        if (showNotes || hasNotes) {
                                                            updateEquipment(item.key, { notes: '' });
                                                            setExpandedNotes((prev) => ({ ...prev, [item.key]: false }));
                                                        } else {
                                                            toggleNotes(item.key);
                                                        }
                                                    }}
                                                >
                                                    {(showNotes || hasNotes) ? '- Remove note' : '+ Add note'}
                                                </button>
                                            </div>
                                            {(showNotes || hasNotes) && (
                                                <div className="tech-rider-equipment-row-notes">
                                                    <textarea
                                                        className="input tech-rider-note-input"
                                                        placeholder="Details (model, limitations, etc.)"
                                                        value={item.notes ?? ''}
                                                        onChange={(e) => updateEquipment(item.key, { notes: e.target.value })}
                                                        rows={2}
                                                    />
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* B) Stage & Setup */}
                <section className="tech-rider-section tech-rider-section--stage">
                    <h2>Stage & Setup</h2>
                    <div className="tech-rider-stage-fields">
                        <div className="input-group">
                            <label htmlFor="stageSize" className="input-label">Stage size</label>
                            <textarea
                                id="stageSize"
                                className="input"
                                placeholder="e.g. 3m x 2m"
                                value={techRider.stageSetup?.stageSize ?? ''}
                                onChange={(e) => updateStageSetup('stageSize', e.target.value)}
                                rows={2}
                            />
                        </div>
                        <div className="input-group">
                            <label htmlFor="powerOutlets" className="input-label">Power outlets on/near stage</label>
                            <input
                                id="powerOutlets"
                                type="number"
                                className="input"
                                min="0"
                                placeholder="Number"
                                value={techRider.stageSetup?.powerOutlets ?? ''}
                                onChange={(e) =>
                                    updateStageSetup(
                                        'powerOutlets',
                                        e.target.value === '' ? null : e.target.value
                                    )
                                }
                            />
                        </div>
                        <div className="input-group tech-rider-input-group--full">
                            <label htmlFor="generalTechNotes" className="input-label">General tech notes</label>
                            <textarea
                                id="generalTechNotes"
                                className="input"
                                placeholder="Anything else about venue equipment not covered above."
                                value={techRider.stageSetup?.generalTechNotes ?? ''}
                                onChange={(e) => updateStageSetup('generalTechNotes', e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>
                </section>

                {/* C) Performance Conditions */}
                <section className="tech-rider-section tech-rider-section--house-rules">
                    <h2>Performance Conditions</h2>
                    <div className="tech-rider-house-rules-fields">
                        <div className="input-group">
                            <label className="input-label">Volume level</label>
                            <div className="selections">
                                {['quiet', 'moderate', 'loud'].map((level) => (
                                    <button
                                        key={level}
                                        type="button"
                                        className={`card small centered ${techRider.houseRules?.volumeLevel === level ? 'selected' : ''}`}
                                        onClick={() => updateHouseRules('volumeLevel', level)}
                                    >
                                        <span className="title">{level.charAt(0).toUpperCase() + level.slice(1)}</span>
                                    </button>
                                ))}
                            </div>
                            {techRider.houseRules?.volumeLevel && (
                                <input
                                    type="text"
                                    className="input"
                                    style={{ marginTop: '0.5rem' }}
                                    placeholder="Additional notes"
                                    value={techRider.houseRules?.volumeNotes ?? ''}
                                    onChange={(e) => updateHouseRules('volumeNotes', e.target.value)}
                                />
                            )}
                        </div>
                        <div className="input-group">
                            <label htmlFor="noiseCurfew" className="input-label">Noise curfew</label>
                            <input
                                type="time"
                                id="noiseCurfew"
                                className="input"
                                value={techRider.houseRules?.noiseCurfew ?? ''}
                                onChange={(e) => updateHouseRules('noiseCurfew', e.target.value)}
                            />
                        </div>
                    </div>
                </section>
            </div>
            <div className="stage-controls">
                <button type="button" className="btn secondary" onClick={() => navigate(-1)}>
                    Back
                </button>
                <button type="button" className="btn primary" onClick={handleNext}>
                    Continue
                </button>
            </div>
        </div>
    );
};
