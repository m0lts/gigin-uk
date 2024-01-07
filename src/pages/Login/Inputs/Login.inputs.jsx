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