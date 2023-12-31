// EMAIL INPUTS
// /////////////////////////////////////////////////////////////////////////////
export const DefaultEmailInput = ({ emailData, setEmailData, emailError, setEmailError, disableInput, setDisableInput, setPasswordData }) => {

    const handleEmailChange = (event) => {
        setEmailData(event.target.value);
        setEmailError('');
    }

    const handleEditEmail = () => {
        setDisableInput(false);
        setEmailData('');
        setPasswordData('');
    }

    return (
        <div className={`input-cont ${disableInput && 'disabled'}`}>
            <label htmlFor='email' className={`input-label ${emailData && 'active'}`}>Email Address</label>
            <input
                type='text' 
                className={`input ${emailError && 'error'}`} 
                id='email' 
                name='email' 
                required
                value={emailData}
                onChange={handleEmailChange}
            />
        </div>
    )
}

// PASSWORD INPUTS
// /////////////////////////////////////////////////////////////////////////////
export const DefaultPasswordInput = ({ passwordData, setPasswordData, passwordError, setPasswordError, setVerifyPasswordStatus }) => {

    const handlePasswordChange = (event) => {
        setPasswordData(event.target.value);
        setPasswordError('');
        if (setVerifyPasswordStatus) {
            setVerifyPasswordStatus(false);
        }
    }

    return (
        <div className='input-cont'>
            <label htmlFor="password" className={`input-label ${passwordData && 'active'}`}>Password</label>
            <input
                type='password' 
                className={`input ${passwordError && 'error'}`} 
                id='password' 
                name='password' 
                required
                onChange={handlePasswordChange}
            />
        </div>
    )
}

export const VerifyPasswordInput = ({ passwordData, verifyPasswordStatus, setVerifyPasswordStatus }) => {

    const handlePasswordChange = (event) => {
        if (event.target.value !== passwordData) {
            setVerifyPasswordStatus(false);
        } else {
            setVerifyPasswordStatus(true);
        }
    }

    return (
        <div className='input-cont'>
            <label htmlFor="verify-password" className={`input-label ${passwordData && 'active'}`}>Verify Password</label>
            <input
                type='password' 
                className='input'
                id='verify-password' 
                name='verify-password' 
                required
                onChange={handlePasswordChange}
            />
        </div>
    )
}

export const OneTimePasswordInput = ({ oneTimePasswordData, setOneTimePasswordData, passwordError, setPasswordError }) => {
    const handlePasswordChange = (event) => {
        setOneTimePasswordData(event.target.value);
        setPasswordError('');
    }

    return (
        <div className='input-cont'>
            <label htmlFor="one-time-password" className={`input-label ${oneTimePasswordData && 'active'}`}>One-Time Password</label>
            <input
                type='text' 
                className='input' 
                id='one-time-password' 
                name='one-time-password' 
                required
                onChange={handlePasswordChange}
            />
        </div>
    )
}
