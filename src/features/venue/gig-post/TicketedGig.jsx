import { useEffect, useRef } from 'react'

export const TicketedGig = ({ formData, handleInputChange, setStage }) => {

    return (
        <>
            <div className='head'>
                <h1 className='title'>Ticketed Gigs Work Differently</h1>
                <h4 className='text' style={{ marginTop: '1rem', fontSize: '1.1rem', width: '75%' }}>Musicians that play at a ticketed gig won't be paid by you, but will take home 100% of the ticket revenue. Decide between yourself and the musician who should organise the ticket sales.</h4>
            </div>
            <div className='body open-mic'>
                <div className='input-group'>
                    <h6>Confirm that you understand how a ticketed gig works.</h6>
                    <div className="selections">
                        <button
                        type="button"
                        className={`card small ${formData.ticketedGigUnderstood === true ? 'selected' : ''}`}
                        onClick={() => {handleInputChange({ ticketedGigUnderstood: true }); setStage(prevStage => prevStage + 1)}}
                        >
                        Yes, I understand
                        </button>
                        <button
                        type="button"
                        className={`card small`}
                        onClick={() => setStage(4)}
                        >
                        No, change gig type
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}