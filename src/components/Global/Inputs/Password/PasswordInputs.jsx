
export const DefaultPasswordInput = ({ passwordData, setPasswordData, passwordError, setPasswordError, setVerifyPasswordStatus }) => {

    const handlePasswordChange = (event) => {
        setPasswordData(event.target.value);
        setPasswordError('');
        if (setVerifyPasswordStatus) {
            
            setVerifyPasswordStatus(false);
        }
    }

    return (
        <div className='password-cont'>
            <label htmlFor="password">Password:</label>
            <input
                type='password' 
                className='password-input' 
                id='password' 
                name='password' 
                required
                onChange={handlePasswordChange}
            />
            {passwordError && (
                <p>{passwordError}</p>
            )}
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
        <div className='password-cont'>
            <label htmlFor="verify-password">Verify Password:</label>
            <input
                type='password' 
                className={`password-input ${!verifyPasswordStatus && 'error'}`} 
                id='verify-password' 
                name='verify-password' 
                required
                onChange={handlePasswordChange}
            />
            {verifyPasswordStatus === false && (
                <p>* Passwords do not match.</p>
            )}
        </div>
    )
}

export const OneTimePasswordInput = ({ oneTimePasswordData, setOneTimePasswordData, passwordError, setPasswordError }) => {
    const handlePasswordChange = (event) => {
        setOneTimePasswordData(event.target.value);
        setPasswordError('');
    }

    return (
        <div className='password-cont'>
            <label htmlFor="one-time-password">One Time Password:</label>
            <input
                type='password' 
                className={`password-input`} 
                id='one-time-password' 
                name='one-time-password' 
                required
                onChange={handlePasswordChange}
            />
        </div>
    )
}