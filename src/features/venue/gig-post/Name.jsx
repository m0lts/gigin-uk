import { useEffect, useRef } from 'react';

export const GigName = ({ formData, handleInputChange, error }) => {

    const nameInputRef = useRef(null);

    useEffect(() => {
        if (nameInputRef.current) {
            nameInputRef.current.focus();
        }
    }, []);
    
    const handleNameChange = (name) => {
        handleInputChange({
            gigName: name,
        })
    }

    return (
        <>
            <div className='head'>
                <h1 className='title'>What do you want to call this gig?</h1>
                <p className='text'>E.g. Friday Night Lights</p>
            </div>
            <div className='body budget'>
                <div className='input-group'>
                    <input 
                        type='text' 
                        name='budget' 
                        id='name'
                        ref={nameInputRef}
                        onChange={(e) => handleNameChange(e.target.value)}
                        value={formData.gigName}
                        autoComplete='off'
                        />
                </div>
                <button className="btn secondary" onClick={() => handleNameChange(`Gig at ${formData.venue.venueName}`)}>Auto-Fill</button>
                {error && (
                    <div className="error-cont" style={{ width: 'fit-content', margin: '0 auto' }}>
                        <p className="error-message">{error}</p>
                    </div>
                )}
            </div>
        </>
    );
};