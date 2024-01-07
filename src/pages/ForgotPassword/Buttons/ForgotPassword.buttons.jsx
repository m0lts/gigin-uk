import { useState } from "react"
import { LoadingDots } from "/components/Loading/LoadingEffects"
import { queryDatabase } from "/utils/queryDatabase"

export const NextButtonResetPassword = ({ dataPayload, apiRoute, setResponse }) => {

    const [isLoading, setIsLoading] = useState(false);

    const handleResetPassword = async (event) => {
        event.preventDefault();
        setIsLoading(true);
        try {
            const response = await queryDatabase(apiRoute, dataPayload);
            const responseData = await response.json();
            if (response.ok) {
                setIsLoading(false);
                setResponse({
                    data: responseData,
                    status: response.status
                })
            } else {
                setIsLoading(false);
                setResponse({
                    status: response.status,
                    message: responseData.error
                })
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    return (
        <button 
            className={`btn black-button ${isLoading && 'loading'}`}
            onClick={handleResetPassword}
        >
            {isLoading ? (
                <LoadingDots />
            ) : (
                <p>Reset Password</p>
            )}
        </button>
    )
}

// Next button forgot password
export const NextButtonForgotPassword = ({ emailData, setEmailError, setShowPasswordSection, dataPayload, apiRoute }) => {

    const [isLoading, setIsLoading] = useState(false);

    const handleNext = async (event) => {
        setIsLoading(true);
        event.preventDefault();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailData)) {
            setEmailError('Please enter a valid email address. Example: johndoe@gmail.com');
        } else {
            try {
                const response = await queryDatabase(apiRoute, dataPayload);
                if (response.ok) {
                    setShowPasswordSection(true);
                    setIsLoading(false);
                }
            } catch (error) {
                console.error('Error:', error);
                setIsLoading(false);
            }
        }
    }

    return (
        <button 
            className={`btn black-button ${isLoading && 'loading'}`}
            onClick={handleNext}
        >
            {isLoading ? (
                <LoadingDots />
            ) : (
                <p>Next</p>
            )}
        </button>
    )
}

export const SubmitFormButton = ({ passwordError, verifyPasswordStatus, dataPayload, apiRoute, setResponse, setPasswordError }) => {

    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setPasswordError('');
        const passwordPattern = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordPattern.test(dataPayload.userPassword)) {
            setPasswordError('Password must contain at least 8 characters, a capital letter and number.');
        } else {
            setIsLoading(true);
            try {
                const response = await queryDatabase(apiRoute, dataPayload);
                const responseData = await response.json();
                if (response.ok) {
                    setIsLoading(false);
                    setResponse({
                        data: responseData,
                        status: response.status
                    })
                } else {
                    setIsLoading(false);
                    setResponse({
                        status: response.status,
                        message: responseData.error
                    })
                }
            } catch (error) {
                console.error('Error:', error);
            }
        }
        
    }

    return (
        <button 
            className={`btn black-button ${isLoading && 'loading'}`}
            onClick={handleSubmit}
        >
            {isLoading ? (
                <LoadingDots />
            ) : (
                <p>Submit</p>
            )}
        </button>
    )
}

