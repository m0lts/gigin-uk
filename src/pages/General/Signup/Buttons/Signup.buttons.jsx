// Dependencies
import { useState } from "react"

// Utils
import { queryDatabase } from "/utils/queryDatabase"

// Icons and effects
import { LoadingDots } from "/components/Loading/LoadingEffects"

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
