// Styles
import './profile-name.buttons.styles.css'

export const SelectExistingNameButton = ({ userName, setProfileName }) => {

    const handleButtonClick = () => {
        setProfileName(userName);
    }

    return (
        <button 
            className="btn white-button"
            onClick={handleButtonClick}
        >
            Use Account Name
        </button>
    )
}