import '../inputs.styles.css'

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