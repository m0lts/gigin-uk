import './profile-name.buttons.styles.css'

export const SelectExistingNameButton = ({ userName, setProfileName }) => {

    const handleButtonClick = () => {
        setProfileName(userName);
    }

    return (
        <button 
            className="btn existing-name-button"
            onClick={handleButtonClick}
        >
            Use Account Name
        </button>
    )
}