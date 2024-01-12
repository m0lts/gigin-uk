import { ListIcon, MapIcon } from "/components/Icons/Icons"
import { LoadingDots } from "/components/Loading/LoadingEffects"
import './home.buttons.styles.css'

// Map and list view type toggle
export const ChangeViewTypeButton = ({ showMap, setShowMap, isLoading }) => {

    const handleViewChange = () => {
        if (showMap) {
            setShowMap(false);
        } else {
            setShowMap(true);
        }
    }

    return (
        <button 
            className={`btn white-button ${isLoading ? 'loading' : ''}`}
            onClick={handleViewChange}
        >
            {showMap ? (
                isLoading ? (
                    <LoadingDots />
                ) : (
                    <>
                        <ListIcon />
                        <span>List View</span>
                    </>
                )
            ) : (
                isLoading ? (
                    <LoadingDots />
                ) : (
                    <>
                        <MapIcon />
                        <span>Map View</span>
                    </>
                )
            )}
        </button>
    )
}

