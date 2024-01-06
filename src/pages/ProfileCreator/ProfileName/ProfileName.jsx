import { useEffect } from "react";
import { GetInfoFromLocalStorage } from "/utils/updateLocalStorage";
import { SelectExistingNameButton } from "/components/Buttons/Buttons";

export const ProfileName = ({ profileName, setProfileName, establishmentType, setNextButtonAvailable }) => {

    // Set profileName to userName if button clicked
    // Get user name
    const userData = GetInfoFromLocalStorage();
    const userName = userData.userFirstName + ' ' + userData.userSecondName;

    const handleInputChange = (event) => {
        setProfileName(event.target.value);
    }

    useEffect(() => {
        if (profileName) {
            setNextButtonAvailable(true);
        } else {
            setNextButtonAvailable(false);
        }
    }, [profileName]);

    return (
        <div className='establishment-name profile-creator-stage'>
            <h1 className='title'>{establishmentType ? `What's the name of this ${establishmentType}?` : `What's your stage name?`}</h1>
            {!establishmentType && (
                <p className="text">Click the button below if your stage name is the same as your real name: {userName}.</p>
            )}
            <div className="input-cont">
                <input 
                    type="text"
                    id="profileName"
                    name="profileName"
                    className="text-input"
                    value={profileName}
                    onChange={handleInputChange}
                />
            </div>
            {!establishmentType && (
                <SelectExistingNameButton 
                    setProfileName={setProfileName}
                    userName={userName}
                />
            )}
        </div>
    )
}