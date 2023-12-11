import { useState } from "react"

export const DefaultEmailInput = ({ emailData, setEmailData, emailError, setEmailError, disableInput, setDisableInput }) => {

    const handleEmailChange = (event) => {
        setEmailData(event.target.value);
        setEmailError('')
    }

    const handleEditEmail = () => {
        setDisableInput(false);
    }

    return (
        <div className='email-cont'>
            {disableInput ? (
                <p onClick={handleEditEmail}>{emailData}</p>
            ) : (
                <>
                    <label htmlFor='email'>Email Address:</label>
                    <input
                        type='text' 
                        className='email-input' 
                        id='email' 
                        name='email' 
                        required
                        value={emailData}
                        onChange={handleEmailChange}
                    />
                    {emailError && (
                        <p>{emailError}</p>
                    )}
                </>
            )}
        </div>
    )
}