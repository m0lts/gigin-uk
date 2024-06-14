import { useEffect, useRef } from "react"

export const GigBudget = ({ formData, handleInputChange }) => {

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

    const formatSubText = (kind) => {
        if (kind === 'Wedding') {
            return 'Typically, a musician/band for a wedding costs more than £250 an hour.'
        } else if (kind === 'Background Music') {
            return 'Typically, a musician/band or DJ for background music costs more than £50 an hour.'
        } else if (kind === 'Live Music') {
            return 'Typically, live music whether a DJ or musician or band costs more than £100 an hour.'
        } else if (kind === 'Ticketed Gig') {
            return 'For ticketed gigs, the musician/band or DJ costs more than £300 an hour'
        } else if (kind === 'House Party') {
            return 'Typically, a musician/band or DJ for a house party costs more than £50 an hour.'
        } else if (kind === 'Open Mic') {
            return 'Typically, for an open mic night, musicians are not paid. In this case, set the budget to £0.'
        }
    }

    return (
        <>
            <div className="head">
                <h1 className="title">What's your budget?</h1>
                <p className="text">This is not a fixed price, you can negotiate a price with the musician.</p>
            </div>
            <div className="body budget">
                <div className="input-group">
                    <input 
                        type="text" 
                        name="budget" 
                        id="budget"
                        ref={budgetInputRef}
                        onChange={handleBudgetChange}
                        value={formData.budget}
                        />
                </div>
                <p className="sub-text">{formatSubText(formData.kind)}</p>
            </div>
        </>
    )
}