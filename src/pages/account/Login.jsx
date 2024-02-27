// Dependencies
import { Link } from "react-router-dom"
import { useState } from "react"
import { useNavigate } from "react-router-dom";

// Components
import { PrimaryLogo } from '/components/logos/PrimaryLogo'
import { LoadingDots } from '/components/loading/LoadingEffects'

// Styles and extras
import './account.styles.css';

export function LogIn() {

    // SET NAVIGATE
    const navigate = useNavigate();

    // SET STATES
    // For data packet to be sent to database
    const [loginFormValues, setLoginFormValues] = useState({
        email: '',
        password: ''
    });
    // For validation errors
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    // For submission modal
    const [formSubmitted, setFormSubmitted] = useState(false);

    // SET FORM VALUES TO ENTERED VALUES
    const handleInputChange = async (event) => {
        const { name, value } = event.target;
        setLoginFormValues({
            ...loginFormValues,
            [name]: value,
        });
    };

    // HANDLE FORM SUBMISSION
    const handleSubmit = async (event) => {
        event.preventDefault();
        setFormSubmitted(true);

        // Input validation
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(loginFormValues.email)) {
            setEmailError('* Please enter a valid email address');
            setFormSubmitted(false);
            return;
        }

        try {
            const response = await fetch('/api/accounts/handleLogin.js', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(loginFormValues),
            });
      
            // Handle relative responses and edit modal message.
            if (response.ok) {
                const responseData = await response.json();
                delete responseData.userRecord.password;
                sessionStorage.setItem('user', JSON.stringify(responseData.userRecord));
                navigate('/');
              } else if (response.status === 400) {
                setFormSubmitted(false);
                setEmailError('* Email address not recognised.');
              } else if (response.status === 401) {
                setFormSubmitted(false);
                setPasswordError('* Incorrect password.');
              } else {
                alert('Login failed, please try again later.');
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
            <h2>Log in</h2>
            {formSubmitted ? (
                <LoadingDots />
            ) : (
            <form className="account-form" onSubmit={handleSubmit}>
                <div className={`input-group ${emailError && 'error'}`}>
                    <label htmlFor="email">Email Address</label>
                    <input 
                        type="text" 
                        id="email" 
                        name="email" 
                        required 
                        onChange={(event) => {handleInputChange(event); setEmailError('')}}
                        />
                    {emailError && <p className="error-message">{emailError}</p>}
                </div>
                <div className={`input-group ${passwordError && 'error'}`}>
                    <label htmlFor="password">Password</label>
                    <input 
                        type="password" 
                        id="password" 
                        name="password" 
                        required 
                        onChange={(event) => {handleInputChange(event); setPasswordError('')}}
                        />
                    {passwordError && <p className="error-message">{passwordError}</p>}
                </div>
                <button 
                    type="submit" 
                    className={`btn btn-border ${passwordError || emailError ? 'disabled' : ''}`}
                    disabled={passwordError || emailError}
                >
                    Log in
                </button>
                <div className="foot-links">
                    <Link to='/accounts/forgotpassword' className="link">
                        Forgot Password?
                    </Link>
                    <Link to='/accounts/signup' className="link">
                        New to Gigin? Sign up here.
                    </Link>
                </div>
            </form>
            )}
        </section>

    )
}