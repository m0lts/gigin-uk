import { useEffect, useRef } from 'react'

export const GigBudget = ({ formData, handleInputChange, error, extraSlots }) => {

    const budgetInputRef = useRef(null);

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
                {extraSlots.length > 0 ? (
                    <>
                        <h1 className='title'>What's your budget for the night?</h1>
                        <p className='text'>This will be split proportionately between each gig slot.</p>
                    </>

                ) : (
                    <>
                        <h1 className='title'>What's your budget?</h1>
                        <p className='text'>This is not a fixed price, you can negotiate a final price with the musician.</p>
                    </>
                )}
            </div>
            <div className='body budget'>
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
                {error && (
                    <div className="error-cont" style={{ width: 'fit-content', margin: '1rem auto' }}>
                        <p className="error-message">{error}</p>
                    </div>
                )}
            </div>
        </>
    )
}