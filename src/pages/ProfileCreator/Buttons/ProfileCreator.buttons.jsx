import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { queryDatabase } from '/utils/queryDatabase'
import { AddProfileCreatedToLocalStorage, AddProfileDataToLocalStorage, GetInfoFromLocalStorage } from '/utils/updateLocalStorage'
import { LoadingDots } from '/components/Loading/LoadingEffects'

// Back and next footer buttons
export const BackFooterButton = ({ stageNumber, setStageNumber, setSaveButtonAvailable, setNextButtonAvailable }) => {

    const handleBackClick = () => {
        setStageNumber(stageNumber - 1);
        setSaveButtonAvailable(false);
        setNextButtonAvailable(false);
    }

    return (
        <button className='btn white-button' onClick={handleBackClick}>
            Back
        </button>
    )
}
export const NextFooterButton = ({ stageNumber, setStageNumber, setNextButtonAvailable, nextButtonAvailable, saveButtonAvailable, userProfile }) => {

    const handleNextClick = () => {
        setStageNumber(stageNumber + 1);
        setNextButtonAvailable(false);
    }

    return (
        <button
            className={`btn black-button ${!nextButtonAvailable ? 'disabled' : ''}`}
            style={{ display: !saveButtonAvailable ? 'block' : 'none' }}
            onClick={!nextButtonAvailable ? undefined : handleNextClick}
            disabled={!nextButtonAvailable}
        >
            Next
        </button>
    )
}
export const SaveFooterButton = ({ setSaveButtonAvailable, saveButtonAvailable, userProfile }) => {
    
    const [isLoading, setIsLoading] = useState(false);
    const userInfo = GetInfoFromLocalStorage();
    const userID = userInfo.userID;

    const navigate = useNavigate();

    const handleSaveClick = async (event) => {
        event.preventDefault();
        setIsLoading(true);
        const dataPayload = {
            userID,
            userProfile,
        }
        try {
            const response = await queryDatabase('/api/Profile/SaveProfileEntry.js', dataPayload); 
            const responseData = await response.json();
            if (response.ok) {
                setIsLoading(false);
                AddProfileCreatedToLocalStorage(true);
                AddProfileDataToLocalStorage(responseData.updatedProfileDocument.profiles);
                navigate('/control-centre');
            } else {
                setIsLoading(false);
                console.log('error');
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    return (
        <button 
            className={`btn black-button ${isLoading && 'loading'}`}
            style={{ display: saveButtonAvailable ? 'block' : 'none' }}
            onClick={handleSaveClick}
        >
            {isLoading ? (
                <LoadingDots />
            ) : (
                <p>Save Profile</p>
            )}
        </button>
    )

}