import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingDots } from '/components/Loading/LoadingEffects';
import { queryDatabase } from '/utils/queryDatabase';
import { GetInfoFromLocalStorage } from '/utils/updateLocalStorage';

export const SaveTemplateButton = () => {
    return (
        <button className="btn white-button">
            Save Template
        </button>
    )
}

export const PostGigButton = ({ gigInformation, postButtonAvailable, setPostButtonAvailable, error, setError }) => {

    const [isLoading, setIsLoading] = useState(false);
    const userInfo = GetInfoFromLocalStorage();
    const userID = userInfo.userID;
    const navigate = useNavigate();
    
    const handleSaveClick = async (event) => {
        if (postButtonAvailable) {
            event.preventDefault();
            setIsLoading(true);
            const dataPayload = {
                userID,
                gigInformation,
            }
            try {
                const response = await queryDatabase('/api/GigBuilder/PostGig.js', dataPayload); 
                const responseData = await response.json();
                if (response.ok) {
                    setIsLoading(false);
                    console.log(responseData);
                    navigate('/control-centre');
                } else {
                    setIsLoading(false);
                    console.log('error');
                }
            } catch (error) {
                console.error('Error:', error);
                setIsLoading(false);
            }
        } else {
            setError('Please fill all fields marked with an asterisk (*).');
            setTimeout(() => {
                setError('');
            }, 5000);
        }
    }

    return (
        <button
            className={`btn black-button ${isLoading && 'loading'} ${!postButtonAvailable ? 'disabled' : ''}`}
            onClick={handleSaveClick}
        >
            {isLoading ? (
                <LoadingDots />
            ) : (
                <p>Post Gig</p>
            )}
        </button>
    )
}