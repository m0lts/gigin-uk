// Dependencies
    import { useState } from 'react';
    import { useNavigate } from 'react-router-dom';

// Icons and effects
    import { LoadingDots } from '/components/Loading/LoadingEffects';

// Utils
    import { queryDatabase } from '/utils/queryDatabase';
    import { GetInfoFromLocalStorage } from '/utils/updateLocalStorage';


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

export const SaveTemplateButton = ({ setNameTemplateModalOpen, nameTemplateModalOpen, gigInformation, style, templateName, setTemplateName, error, setError, setTemplates }) => {

    const [isLoading, setIsLoading] = useState(false);
    const userInfo = GetInfoFromLocalStorage();
    const userID = userInfo.userID;

    const handleSaveTemplate = async () => {
        if (nameTemplateModalOpen) {
            setIsLoading(true);
            const templateInformation = {
                ...gigInformation,
                templateName: templateName,
            }
            const dataPayload = {
                userID,
                templateInformation,
            }
            try {
                const response = await queryDatabase('/api/GigBuilder/SaveTemplate.js', dataPayload); 
                const responseData = await response.json();
                if (response.ok) {
                    setIsLoading(false);
                    setTemplates(responseData.updatedTemplateDocument.templates);
                    setNameTemplateModalOpen(false);
                    setTemplateName('');
                } else {
                    setIsLoading(false);
                    setError(responseData.message);
                    console.log('error');
                }
            } catch (error) {
                console.error('Error:', error);
                setIsLoading(false);
            }
        } else {
            setNameTemplateModalOpen(true);
        }
    }

    return (
        <button 
            className={`btn ${style} ${isLoading && 'loading'}`}
            onClick={handleSaveTemplate}
        >
            {isLoading ? (
                <LoadingDots />
            ) : (
                <p>Save Template</p>
            )}
        </button>
    )
}

export const DeleteTemplateButton = ({ setTemplates, setError, userID, template }) => {

    const [isLoading, setIsLoading] = useState(false);

    const handleDeleteTemplate = async () => {

        setIsLoading(true);
        const dataPayload = {
            userID,
            template,
        }
        try {
            const response = await queryDatabase('/api/GigBuilder/DeleteTemplate.js', dataPayload); 
            const responseData = await response.json();
            if (response.ok) {
                setIsLoading(false);
                setTemplates(responseData.updatedTemplatesDocument.templates);
            } else {
                setIsLoading(false);
                setError(responseData.message);
                console.log('error');
            }
        } catch (error) {
            console.error('Error:', error);
            setIsLoading(false);
        }

    }

    return (
        <button 
            className={`btn white-button ${isLoading && 'loading'}`}
            onClick={handleDeleteTemplate}
        >
            {isLoading ? (
                <LoadingDots />
            ) : (
                <p>Delete</p>
            )}
        </button>
    )
}