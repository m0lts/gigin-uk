// Styles
    import './signup.inputs.styles.css';

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

// NAME INPUTS
// /////////////////////////////////////////////////////////////////////////////
export const DefaultNameInput = ({ nameData, setNameData }) => {

    const handleNameChange = (event) => {
        const { name, value } = event.target;
        setNameData({
            ...nameData,
            [name]: value
        })
    }

    return (
        <div className='name-cont'>
            <div className='input-cont'>
                <label htmlFor='first-name' className={`input-label ${nameData.firstName && 'active'}`}>First Name</label>
                <input
                    type='text' 
                    className='input' 
                    id='first-name' 
                    name='firstName' 
                    required
                    value={nameData.firstName}
                    onChange={handleNameChange}
                />
            </div>
            <div className='input-cont'>
                <label htmlFor='second-name' className={`input-label ${nameData.secondName && 'active'}`}>Second Name</label>
                <input
                    type='text' 
                    className='input' 
                    id='second-name' 
                    name='secondName' 
                    required
                    value={nameData.secondName}
                    onChange={handleNameChange}
                />
            </div>
        </div>
    )
}

// PHONE NUMBER INPUTS
// /////////////////////////////////////////////////////////////////////////////
export const DefaultPhoneNumberInput = ({ phoneNumberData, setPhoneNumberData }) => {
    const handleNumberChange = (event) => {
        setPhoneNumberData(event.target.value)
    }

    return (
        <div className='input-cont'>
            <label htmlFor='phone-number' className={`input-label ${phoneNumberData && 'active'}`}>Phone Number</label>
            <input
                type='tel' 
                className='input' 
                id='phone-number' 
                name='phone-number' 
                required
                value={phoneNumberData}
                onChange={handleNumberChange}
            />
        </div>
    )
}

// ADDRESS INPUTS
// /////////////////////////////////////////////////////////////////////////////
export const DefaultAddressInput = ({ addressData, setAddressData }) => {

    const handleAddressChange = (event) => {
        const { name, value } = event.target;
        setAddressData({
            ...addressData,
            [name]: value
        })
    }

    return (
        <>
            <div className='input-cont'>
                <label htmlFor='line1' className={`input-label ${addressData.line1 && 'active'}`}>Address Line 1</label>
                <input
                    type='text' 
                    className='input' 
                    id='line1' 
                    name='line1' 
                    required
                    value={addressData.line1}
                    onChange={handleAddressChange}
                />
            </div>
            <div className='input-cont'>
                <label htmlFor='city' className={`input-label ${addressData.city && 'active'}`}>City</label>
                <input
                    type='text' 
                    className='input' 
                    id='city' 
                    name='city' 
                    required
                    value={addressData.city}
                    onChange={handleAddressChange}
                />
            </div>
            <div className='input-cont'>
                <label htmlFor='post-code' className={`input-label ${addressData.postCode && 'active'}`}>Postcode</label>
                <input
                    type='text' 
                    className='input' 
                    id='post-code' 
                    name='postCode' 
                    required
                    value={addressData.postCode}
                    onChange={handleAddressChange}
                />
            </div>
            <div className='input-cont'>
                <label htmlFor='country' className={`input-label ${addressData.country && 'active'}`}>Country</label>
                <input
                    type='text' 
                    className='input' 
                    id='country' 
                    name='country' 
                    required
                    value={addressData.country}
                    onChange={handleAddressChange}
                />
            </div>
        </>
    )
}
