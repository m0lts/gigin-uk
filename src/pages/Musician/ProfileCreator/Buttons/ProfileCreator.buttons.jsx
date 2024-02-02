// Dependencies
    import { useEffect, useState } from 'react'
    import { useNavigate } from 'react-router-dom'

// Utils
    import { handleMediaUpload } from '/utils/uploadMedia'
    import { queryDatabase } from '/utils/queryDatabase'
    import { AddProfileCreatedToLocalStorage, AddProfileDataToLocalStorage, GetInfoFromLocalStorage } from '/utils/updateLocalStorage'

// Icons and effects
    import { LoadingDots } from '/components/Loading/LoadingEffects'

    
// Back and next footer buttons
export const BackFooterButton = ({ stageNumber, setStageNumber, setSaveButtonAvailable, setNextButtonAvailable, setBackButtonAvailable, editingProfile, backButtonAvailable }) => {

    const handleBackClick = () => {
        setStageNumber(stageNumber - 1);
        setSaveButtonAvailable(false);
        setNextButtonAvailable(false);
    }

    // Prevent user from accessing stage 1 if they are editing their profile
    useEffect(() => {
        if (editingProfile && stageNumber === 2) {
            setBackButtonAvailable(false);
        } else {
            setBackButtonAvailable(true);
        }
    }, [editingProfile, stageNumber])

    return (
        <button
            className={`btn white-button ${!backButtonAvailable ? 'disabled' : ''}`}
            onClick={!backButtonAvailable ? undefined : handleBackClick}
            disabled={!backButtonAvailable}
        >
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

        if (userProfile.profileImages) {
            if (Array.isArray(userProfile.profileImages)) {
                // If profileImages is an array, process each image
                const userImages = userProfile.profileImages;
                const updatedProfileImages = [];
    
                await Promise.all(userImages.map(async (image) => {
                    if (typeof image === 'string') {
                        // If the item is already a URL, no need to reprocess
                        updatedProfileImages.push(image);
                    } else {
                        // Convert raw image to S3 URL
                        const s3Url = await handleMediaUpload(image);
                        updatedProfileImages.push(s3Url);
                    }
                }));
                userProfile.profileImages = updatedProfileImages;
            } else if (typeof userProfile.profileImages === 'object') {
                // If profileImages is an object, process profileImage and coverImage
                const userProfileImage = userProfile.profileImages.profileImage;
                const userCoverImage = userProfile.profileImages.coverImage;
    
                if (userProfileImage && typeof userProfileImage === 'string') {
                    // If profileImage is already a URL, no need to reprocess
                    userProfile.profileImages.profileImage = userProfileImage;
                } else if (userProfileImage) {
                    // Convert raw profileImage to S3 URL
                    const updatedProfileImage = await handleMediaUpload(userProfileImage);
                    userProfile.profileImages.profileImage = updatedProfileImage;
                }
    
                if (userCoverImage && typeof userCoverImage === 'string') {
                    // If coverImage is already a URL, no need to reprocess
                    userProfile.profileImages.coverImage = userCoverImage;
                } else if (userCoverImage) {
                    // Convert raw coverImage to S3 URL
                    const updatedCoverImage = await handleMediaUpload(userCoverImage);
                    userProfile.profileImages.coverImage = updatedCoverImage;
                }
            }
        }

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