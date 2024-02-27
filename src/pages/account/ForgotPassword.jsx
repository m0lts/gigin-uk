// Dependencies
import { Link } from "react-router-dom"
import { useState } from "react"
import { useNavigate } from "react-router-dom";

export function ForgotPassword() {

    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        email: '',
    });
    const [emailError, setEmailError] = useState('');
    const [formSubmitted, setFormSubmitted] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleInputChange = (event) => {
        const emailInput = event.target.value;

        if (emailInput) {
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            setEmailError(emailPattern.test(emailInput) ? '' : '* Must be a valid email address');
        }
        setFormData({
            email: emailInput
        })
    }

    const handleSubmit = async (event) => {
        event.preventDefault();

        // Check for errors
        if (emailError) {
            // If there are errors, do not submit the form
            alert('Please ensure all fields are filled out correctly.');
            return;
        } else {
            setFormSubmitted(true);
        }

        try {
            const response = await fetch('/api/accounts/handleForgotPassword.js', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(formData),
            });
      
            // Handle relative responses and edit modal message.
            if (response.ok) {
                setSuccess(true);
            } else if (response.status === 400) {
                setSuccess(true);
            } else {
                setFormSubmitted(false);
                setSuccess(false);
                alert('There was an error submitting the form. Please try again.');
              }
          } catch (error) {
            console.error('Error submitting form:', error);
          }

    }



    return (
        <section className="gateway-page page-padding bckgrd-white">
            <div className="body">
                <h1 className="title">Forgot Password</h1>
                {!success && (
                    <p className="message">
                        Please enter the email address associated with your account below.
                    </p>
                    )}
                {success ? (
                    <>
                    <p className="message">If there is an account associated with that email address, you will receive an email with instructions on how to reset your password.</p>
                    <div className="forgot-password-message">
                        <Link to='/' className="forgot-password-link">
                            Return home here.
                        </Link>
                    </div>
                    </>
                ) : formSubmitted ? (
                    <p>Sending an email to {formData.email}...</p>
                ) : (
                    <form className="account-form" onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label htmlFor="email">Email Address:</label>
                        <input
                            type="text"
                            id="email"
                            name="email"
                            required
                            onChange={handleInputChange}
                        />
                        {emailError && <div className="error-message">{emailError}</div>}
                    </div>
                    <button type="submit" className="btn btn-purple">Submit</button>
                    </form>
                )}
            </div>
        </section>
    )
}