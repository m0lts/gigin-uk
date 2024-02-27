// Dependencies
import { useEffect, useState } from "react"
import { useLocation } from "react-router-dom";
import { useNavigate } from 'react-router-dom'


export function ResetPassword() {

    const navigate = useNavigate();

    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const token = searchParams.get('token');
    const userId = searchParams.get('user');

    const [formSubmitted, setFormSubmitted] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [verifyPasswordError, setVerifyPasswordError] = useState('');
    const [formValues, setFormValues] = useState({
        password: '',
        verify_password: '',
        token: token,
        userId: userId,
    })

    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setFormValues({
            ...formValues,
            [name]: value,
            });
        
        // Password validation
        if (name === 'password') {
            const passwordPattern = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
            setPasswordError(passwordPattern.test(value) ? '' : '* Password must be at least 8 characters long, contain a capital letter, and a number');
        }
        // Verify password validation
        if (name === 'verify_password' || name === 'password') {
            setVerifyPasswordError(value === formValues.password ? '' : '* Passwords do not match');
        }

    }

    const handleSubmit = async (event) => {
        event.preventDefault();

        // Check for errors
        if (passwordError || verifyPasswordError) {
            // If there are errors, do not submit the form
            alert('Please ensure all fields are filled out correctly.');
            return;
        } else {
            setFormSubmitted(true);
        }

        try {
            const response = await fetch('/api/accounts/handleResetPassword.js', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(formValues),
            });
      
            if (response.ok) {
                setFormSubmitted(false);
                navigate('/login');
            } else {
                alert('There was an error submitting the form. Please ensure you followed the correct link and try again.');
                setFormSubmitted(false);
            }
          } catch (error) {
            console.error('An error occurred during password reset:', error);
          }


    }



    return (
        <section className="gateway-page page-padding bckgrd-white">
            <div className="body">
                <h1 className="title">Reset Password</h1>
                {formSubmitted ? (
                    <p>Resetting your password...</p>
                ) : (
                    <form className="account-form" onSubmit={handleSubmit}>
                        <div className="input-group">
                            <label htmlFor="password">New Password:</label>
                            <input 
                                type="password" 
                                id="password" 
                                name="password" 
                                required={true}
                                value={formValues.password}
                                onChange={handleInputChange}
                            />
                            {passwordError && <div className="error-message">{passwordError}</div>}
                        </div>
                        <div className="input-group">
                            <label htmlFor="verify_password">Repeat New Password:</label>
                            <input 
                                type="password" 
                                id="verify_password" 
                                name="verify_password" 
                                required={true}
                                value={formValues.verify_password}
                                onChange={handleInputChange}
                            />
                            {verifyPasswordError && <div className="error-message">{verifyPasswordError}</div>}
                        </div>
                        <button 
                            type="submit" 
                            className={`btn btn-purple ${passwordError || verifyPasswordError ? 'disabled' : ''}`}
                            disabled={passwordError || verifyPasswordError}    
                        >
                            Submit
                        </button>
                        </form>
                )}
            </div>
        </section>
    )
}