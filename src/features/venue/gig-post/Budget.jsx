import { useEffect, useRef, useState } from 'react'
import { CoinsIcon, CoinsIconSolid, TicketIcon, TicketIconLight } from '../../shared/ui/extras/Icons';

export const GigBudget = ({ formData, handleInputChange, error, extraSlots, setError, setStage }) => {

    const budgetInputRef = useRef(null);
    const [localKind, setLocalKind] = useState(formData.kind === 'Live Music' ? 'Flat Fee' : 'Ticketed Gig');
    const [showSecondStage, setShowSecondStage] = useState(formData.kind ? true : false);

    useEffect(() => {
        if (budgetInputRef.current) {
            budgetInputRef.current.focus();
        }
    }, []);

    const handleBudgetChange = (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        handleInputChange({
            budget: `£${value}`,
        });
    };

    const handleKindSelect = (e) => {
        setError(null);
        if (e === 'Live Music') {
            handleInputChange({
                kind: e,
                ticketedGigUnderstood: false,
            });
            setLocalKind('Flat Fee');
        } else {
            handleInputChange({
                kind: e,
                budget: '£',
            });
            setLocalKind(e);
        }
        setShowSecondStage(true);
    };

    const formatSubText = (kind, gigType) => {
        if (kind === 'Wedding') {
            if (gigType === 'DJ') {
                return 'Typically, a DJ for a wedding costs more than £150 an hour.'
            } else {
                return 'Typically, a musician/band for a wedding costs more than £250 an hour.'
            }
        } else if (kind === 'Background Music') {
            if (gigType === 'DJ') {
                return 'DJs typically charge around £50 an hour for background music.'
            } else {
                return 'Musicians typically charge around £50 an hour for background music.'
            }
        } else if (kind === 'Live Music') {
            if (gigType === 'DJ') {
                return 'Typically, a live DJ costs more than £100 an hour.'
            } else {
                return 'Typically, a live musician/band costs more than £100 an hour.'
            }
        } else if (kind === 'Ticketed Gig') {
            if (gigType === 'DJ') {
                return 'For ticketed gigs, a DJ costs more than £300 an hour.'
            } else {
                return 'For ticketed gigs, a musician/band costs more than £300 an hour.'
            }
        } else if (kind === 'House Party') {
            if (gigType === 'DJ') {
                return 'Typically, a DJ for a house party costs more than £50 an hour.'
            } else {
                return 'Typically, a musician/band for a house party costs more than £50 an hour.'
            }
        } else if (kind === 'Open Mic') {
            return 'Typically, for an open mic night, musicians are not paid. In this case, set the budget to £0.'
        }
    }

    return (
        <>
            <div className='head'>
                <h1 className='title'>Payment Method</h1>
            </div>
            <div className='body budget'>
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
                    {showSecondStage && localKind === 'Flat Fee' ? (
                        <div className="budget-container">
                            <h4>What's your budget for the evening?</h4>
                            {extraSlots.length > 0 && (<p>This budget will be split proportionately between the evening's sets.</p>)}
                            <p></p>
                            <div className='input-group'>
                                <input 
                                    type='text' 
                                    name='budget' 
                                    id='budget'
                                    ref={budgetInputRef}
                                    onChange={handleBudgetChange}
                                    value={formData.budget}
                                    autoComplete="off"
                                    />
                            </div>
                            <p className='sub-text'>{formatSubText(formData.kind, formData.gigType)}</p>
                        </div>
                    ) : showSecondStage && localKind === 'Ticketed Gig' && (
                        <div className='ticketed-container'>
                            <h4 className='text' style={{ marginTop: '1rem', fontSize: '1.1rem', width: '75%' }}>Musicians that play at a ticketed gig won't be paid by you, but will take home 100% of their ticket sales.</h4>
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