import { ListIcon, MapIcon } from "/components/Icons/Icons"
import './home.buttons.styles.css'

// Map and list view type toggle
export const ChangeViewTypeButton = ({ showMap, setShowMap }) => {

    const handleViewChange = () => {
        if (showMap) {
            setShowMap(false);
        } else {
            setShowMap(true);
        }
    }

    return (
        <button 
            className='btn change-view-btn'
            onClick={handleViewChange}
        >
            {showMap ? (
                <>
                    <ListIcon />
                    <span>List View</span>
                </>
            ) : (
                <>
                    <MapIcon />
                    <span>Map View</span>
                </>
            )}
        </button>
    )
}

