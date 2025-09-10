import { useEffect, useRef } from 'react'

export const OpenMicGig = ({ formData, handleInputChange, error }) => {

    return (
        <>
            <div className='head'>
                <h1 className='title'>Open Mic Gigs</h1>
                <p className='text'>We need some information on how you want to run your open mic night.</p>
            </div>
            <div className='body open-mic'>
                <div className='input-group'>
                    <h6>Do you want musicians to apply to play?</h6>
                    <div className="selections">
                        <button
                        type="button"
                        className={`card small ${formData.openMicApplications === true ? 'selected' : ''}`}
                        onClick={() => handleInputChange({ openMicApplications: true })}
                        >
                        Yes, apply to open mic
                        </button>
                        <button
                        type="button"
                        className={`card small ${formData.openMicApplications === false ? 'selected' : ''}`}
                        onClick={() => handleInputChange({ openMicApplications: false })}
                        >
                        No, turn up and play
                        </button>
                    </div>
                </div>

                {formData.openMicApplications && (
                    <div className='input-group'>
                        <h6>Do you want to limit the number of musicians who can play?</h6>
                        <div className="selections">
                            <button
                            type="button"
                            className={`card small ${formData.limitApplications === true ? 'selected' : ''}`}
                            onClick={() => handleInputChange({ limitApplications: true })}
                            >
                            Yes
                            </button>
                            <button
                            type="button"
                            className={`card small ${formData.limitApplications === false ? 'selected' : ''}`}
                            onClick={() => handleInputChange({ limitApplications: false, numberOfApplications: '' })}
                            >
                            No
                            </button>
                        </div>

                        {formData.limitApplications === true && (
                            <>
                                <label htmlFor="numberOfApplications" className="label">Maximum number of applicants (Max 15)</label>
                                <input
                                    className='input'
                                    type='number'
                                    name='numberOfApplications'
                                    id='numberOfApplications'
                                    min={1}
                                    max={15}
                                    value={formData.numberOfApplicants || 1}
                                    onChange={(e) => {
                                        let value = parseInt(e.target.value, 10);
                                
                                        if (isNaN(value)) {
                                          value = 1; // default fallback
                                        }
                                
                                        // enforce hard bounds
                                        if (value < 1) value = 1;
                                        if (value > 15) value = 15;
                                
                                        handleInputChange({ numberOfApplicants: value });
                                      }}
                                />
                            </>
                        )}
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