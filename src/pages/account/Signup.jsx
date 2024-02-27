// Dependencies
import { Link, useNavigate } from "react-router-dom"
import { useState } from "react"

// Components
import { PrimaryLogo } from '/components/logos/PrimaryLogo'
import { LoadingDots } from '/components/loading/LoadingEffects';



export function SignUp() {

    // SET UP NAVIGATE
    const navigate = useNavigate();

    // SET STATES
    // For data to be sent to database
    const [formValues, setFormValues] = useState({
        forename: '',
        surname: '',
        email: '',
        phoneNumber: '',
        password: '',
        verify_password: '',
        emailConsent: true,
    });

    // For validation errors
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [verifyPasswordError, setVerifyPasswordError] = useState('');

    // For submission modal
    const [formSubmitted, setFormSubmitted] = useState(false);

    
    // SET FORM VALUES TO ENTERED VALUES
    const handleInputChange = async (event) => {
        const { name, value } = event.target;
        setFormValues({
            ...formValues,
            [name]: value,
        });
    };

    // SET EMAIL CONSENT
    const handleCheckboxChange = (event) => {
        const { checked } = event.target;
        setFormValues({ ...formValues, emailConsent: !checked });
    };
    

    // HANDLE FORM SUBMISSION
    const handleSubmit = async (event) => {
        event.preventDefault();
        setFormSubmitted(true);
        // Input validation
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const passwordPattern = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!emailPattern.test(formValues.email)) {
            setEmailError('* Please enter a valid email address');
            setFormSubmitted(false);
            return;
        }
        if (!passwordPattern.test(formValues.password)) {
            setPasswordError('* Password must be at least 8 characters long, contain a capital letter, and a number');
            setFormSubmitted(false);
            return;
        }
        if (formValues.verify_password !== formValues.password) {
            setVerifyPasswordError('* Passwords do not match');
            setFormSubmitted(false);
            return;
        }


        // Send data to server
        try {
            const response = await fetch('/api/accounts/handleSignup.js', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(formValues),
            });
      
            if (response.ok) {
                formValues.verified = false;
                formValues.email = formValues.email.toLowerCase();
                delete formValues.password;
                delete formValues.verify_password;
                sessionStorage.setItem('user', JSON.stringify(formValues));
                navigate('/');
              } else if (response.status === 400) {
                setEmailError('* Email already in use.');
                setFormSubmitted(false);
              } else if (response.status === 401) {
                setPhoneNumberError('* Phone number already in use.');
                setFormSubmitted(false);
              } else if (response.status === 500) {
                setEmailError('* Email address not recognised, please enter a valid email address.');
                setFormSubmitted(false);
              } else {
                alert('Account creation failed, please try again later.');
                setFormSubmitted(false);
              }
          } catch (error) {
            console.error('Error submitting form:', error);
          }
        
    };


    return (
        <section className="body"> 
            <div className="header">
                <PrimaryLogo />
                <Link to='/' className="link">
                    Back
                </Link>
            </div>
            <h2>Sign up</h2>
            {formSubmitted ? (
                <LoadingDots />
            ) : (
                <form onSubmit={handleSubmit}>
                    <div className="two-inputs">
                        <div className="input-group">
                            <label htmlFor="forename">First Name</label>
                            <input 
                                type="text" 
                                id="forename" 
                                name="forename" 
                                required={true}
                                value={formValues.forename}
                                onChange={handleInputChange}
                                />
                        </div>
                        <div className="input-group">
                            <label htmlFor="surname">Second Name</label>
                            <input 
                                type="text" 
                                id="surname" 
                                name="surname" 
                                required={true}
                                value={formValues.surname}
                                onChange={handleInputChange}
                                />
                        </div>
                    </div>
                    <div className={`input-group ${emailError && 'error'}`}>
                        <label htmlFor="email">Email Address</label>
                        <input 
                            type="text" 
                            id="email" 
                            name="email" 
                            required={true}
                            value={formValues.email}
                            onChange={(e) => {handleInputChange(e); setEmailError('')}}
                        />
                        {emailError && <p className="error-message">{emailError}</p>}
                    </div>
                    <div className="input-group">
                        <label htmlFor="phoneNumber">Phone Number</label>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <select
                                id="areaCode"
                                name="areaCode"
                                style={{ marginRight: '0.5rem' }}
                            >
                                <option value="44">+44</option>
                                {/* Add more options for other area codes */}
                            </select>
                            <input 
                                type="text" 
                                id="phoneNumber" 
                                name="phoneNumber" 
                                required={false}
                                value={formValues.phoneNumber}
                                onChange={handleInputChange}
                            />
                        </div>
                    </div>
                    <div className={`input-group ${passwordError && 'error'}`}>
                    <label htmlFor="password">Password</label>
                        <input 
                            type="password" 
                            id="password" 
                            name="password" 
                            required={true}
                            value={formValues.password}
                            onChange={(e) => {handleInputChange(e); setPasswordError('')}}
                        />
                        {passwordError && <p className="error-message">{passwordError}</p>}
                    </div>
                    <div className={`input-group ${verifyPasswordError && 'error'}`}>
                        <label htmlFor="verify_password">Repeat Password</label>
                        <input 
                            type="password" 
                            id="verify_password" 
                            name="verify_password" 
                            required={true}
                            value={formValues.verify_password}
                            onChange={(e) => {handleInputChange(e); setVerifyPasswordError('')}}
                        />
                        {verifyPasswordError && <p className="error-message">{verifyPasswordError}</p>}
                    </div>
                    <div className="legal-box">
                        <p>By signing up, you agree to our <Link to='#' className="link">Terms of Service</Link> and <Link to='#' className="link">Privacy Policy</Link>.</p>
                        <label htmlFor="email-consent">
                            <input type="checkbox" name="email-consent" id="email-consent" checked={!formValues.emailConsent} onChange={handleCheckboxChange} />
                            Check this box to unsubscribe from non-essential emails.
                        </label>
                    </div>
                    <button 
                        type="submit" 
                        className={`btn btn-border ${emailError || passwordError || verifyPasswordError ? 'disabled' : ''}`}
                        disabled={emailError || passwordError || verifyPasswordError}
                    >
                        Sign up
                    </button>
                    <div className="foot-links">
                        <Link to='/accounts' className="link">
                            Already have an account? Log in here.
                        </Link>
                    </div>
                </form>
            )}
        </section>

    )
}