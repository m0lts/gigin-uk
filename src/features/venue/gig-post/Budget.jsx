import { useEffect, useMemo, useRef, useState } from 'react'
import { CoinsIcon, CoinsIconSolid, TicketIcon, TicketIconLight } from '../../shared/ui/extras/Icons';

export const GigBudget = ({ formData, handleInputChange, error, extraSlots, setError, setStage }) => {

    const budgetInputRef = useRef(null);
    const [localKind, setLocalKind] = useState((formData.kind === 'Live Music' || formData.kind === 'Wedding' || formData.kind === 'Background Music') ? 'Flat Fee' : 'Ticketed Gig');
    const [showSecondStage, setShowSecondStage] = useState(formData.kind ? true : false);
    const [showPaymentOptions, setShowPaymentOptions] = useState((formData.kind === 'Wedding' || formData.kind === 'Background Music') ? false : true);

    useEffect(() => {
        if (budgetInputRef.current) {
            budgetInputRef.current.focus();
        };
    }, []);

    const formatPoundsInput = (raw) => {
        const digits = String(raw || '').replace(/[^\d]/g, '');
        return `£${digits}`;
    };
    
    const handleBudgetChange = (e) => {
        handleInputChange({ budget: formatPoundsInput(e.target.value) });
    };
    
    const setSlotBudget = (index, value) => {
        const v = formatPoundsInput(value);
        const current = Array.isArray(formData.slotBudgets) ? [...formData.slotBudgets] : [];
        const allSlotsLen = 1 + (extraSlots?.length || 0);
        if (current.length < allSlotsLen) current.length = allSlotsLen;
        current[index] = v;
        handleInputChange({ slotBudgets: current });
    };
    
    const handleKindSelect = (kind) => {
        setError(null);
        if (kind === 'Live Music') {
          handleInputChange({ kind, ticketedGigUnderstood: false });
          setLocalKind('Flat Fee');
        } else {
          handleInputChange({ kind, budget: '£', slotBudgets: [] });
          setLocalKind('Ticketed Gig');
        }
        setShowSecondStage(true);
    };
    
    const allSlots = [{ startTime: formData.startTime, duration: formData.duration }, ...(extraSlots || [])];

    const parsePounds = (s) => {
        const n = Number(String(s ?? '').replace(/[^\d]/g, ''));
        return Number.isFinite(n) ? n : 0;
    };

    const totalSlotsBudget = useMemo(() => {
        const slotBudgets = (formData.slotBudgets || []).slice(0, allSlots.length);
        return slotBudgets.reduce((sum, s) => sum + parsePounds(s), 0);
      }, [formData.slotBudgets, allSlots.length]);
      
      const formatPounds = (n) => `£${Number(n || 0).toLocaleString('en-GB')}`;

    return (
        <>
            <div className='head'>
                <h1 className='title'>{showPaymentOptions ? 'Payment Method' : "Enter Your Budget"}</h1>
            </div>
            <div className='body budget'>
                {showPaymentOptions && (
                    <div className="selections">
                        <div className={`card ${localKind === 'Ticketed Gig' ? 'selected' : ''}`} onClick={() => handleKindSelect('Ticketed Gig')}>
                            {localKind === 'Ticketed Gig' ? (
                                <TicketIcon />
                            ) : (
                                <TicketIconLight />
                            )}
                            <h4 className='text'>Tickets</h4>
                        </div>
                        <div className={`card ${localKind === 'Flat Fee' ? 'selected' : ''}`} onClick={() => handleKindSelect('Live Music')}>
                            {localKind === 'Flat Fee' ? (
                                <CoinsIconSolid />
                                ) : (
                                <CoinsIcon />
                            )}
                            <h4 className='text'>Flat Fee</h4>
                        </div>
                    </div>
                )}
                    {showSecondStage && localKind === 'Flat Fee' ? (
                        <div className="budget-container">
                            {showPaymentOptions && (
                                extraSlots.length > 0 ? (
                                    <h4>Enter a budget for each set.</h4>
                                ) : (
                                    <h4>What's your budget for the evening?</h4>
                                )
                            )}
                            {allSlots.length === 1 ? (
                                <div className='input-group'>
                                    <input
                                    type='text'
                                    name='budget'
                                    id='budget'
                                    ref={budgetInputRef}
                                    onChange={handleBudgetChange}
                                    value={formData.budget || '£'}
                                    autoComplete="off"
                                    />
                                </div>
                                ) : (
                                <div className="slots-container">
                                    <div className='slot-budgets'>
                                        {allSlots.map((slot, i) => (
                                        <div className='input-group' key={i}>
                                            <label className='label'>
                                                Set {i + 1} — {slot.startTime} • {slot.duration} mins
                                            </label>
                                            <input
                                                type='text'
                                                inputMode='numeric'
                                                value={(formData.slotBudgets?.[i]) ?? '£'}
                                                onChange={(e) => setSlotBudget(i, e.target.value)}
                                                autoComplete="off"
                                            />
                                        </div>
                                        ))}
                                        {/* (Optional) Show total */}
                                    </div>
                                    <div className='sub-text'>
                                        <h6>Total</h6>
                                        <h1>{formatPounds(totalSlotsBudget)}</h1>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : showSecondStage && localKind === 'Ticketed Gig' && (
                        <div className='ticketed-container'>
                            <h4 className='text' style={{ marginTop: '1rem', fontSize: '1.1rem', width: '75%' }}>Musicians that play at a ticketed gig won't be paid by you, but will take home 100% of the ticket revenue. Decide between yourself and the musician who should organise the ticket sales.</h4>
                            {extraSlots.length > 0 && (<p style={{ marginTop: '1rem', width: '75%' }}>You must tell the musicians about the multiple gig slots, so the musicians can decide how to split the ticket sales.</p>)}
                            <div className='input-group'>
                                <h6>Confirm that you understand how a ticketed gig works.</h6>
                                <div className="selections">
                                    <button
                                    type="button"
                                    className={`card small ${formData.ticketedGigUnderstood === true ? 'selected' : ''}`}
                                    onClick={() => {handleInputChange({ ticketedGigUnderstood: true }); setStage(9)}}
                                    >
                                        Yes, I understand
                                    </button>
                                    <button
                                    type="button"
                                    className={`card small`}
                                    onClick={() => {setLocalKind('Flat Fee'); handleKindSelect('Live Music')}}
                                    >
                                        No, change payment type
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                {error && (
                    <div className="error-cont" style={{ width: 'fit-content', margin: '1rem auto' }}>
                        <p className="error-message">{error}</p>
                    </div>
                )}
            </div>
        </>
    )
}