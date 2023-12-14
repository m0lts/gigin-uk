
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
            {passwordError && (
                <p className='form-error'>{passwordError}</p>
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
        <div className='input-cont'>
            <label htmlFor="verify-password" className={`input-label ${passwordData && 'active'}`}>Verify Password</label>
            <input
                type='password' 
                className={`input ${verifyPasswordStatus && 'error'}`} 
                id='verify-password' 
                name='verify-password' 
                required
                onChange={handlePasswordChange}
            />
            {verifyPasswordStatus === false && (
                <p className='form-error'>* Passwords do not match.</p>
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
            <label htmlFor="one-time-password">One Time Password</label>
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