import { faBars, faBookmark, faX, faList, faMap, faSearch } from "@fortawesome/free-solid-svg-icons"
import { faAddressCard, faApartment, faGuitars, faHouse, faMartiniGlassCitrus, faPeopleRoof, faSpeakers, faUtensils, faCompactDisc, faHouseFlag, faPlaceOfWorship, faSchool, faPeopleGroup, faHouseCircleExclamation, faImage, faSquareCaretLeft, faSquareCaretRight, faChevronRight, faChevronLeft, faPianoKeyboard, faWaveformLines, faMicrophone, faAmpGuitar, faTurntable } from "@fortawesome/pro-light-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import './icons.styles.css'

export const MenuIcon = () => {
    return (
        <FontAwesomeIcon icon={faBars} className='menu-icon' />
    )
}

export const MapIcon = () => {
    return (
        <FontAwesomeIcon icon={faMap} className='map-icon icon' />
    )
}

export const ListIcon = () => {
    return (
        <FontAwesomeIcon icon={faList} className='list-icon' />
    )
}

export const BookmarkIcon = () => {
    return (
        <FontAwesomeIcon icon={faBookmark} className='bookmark-icon' />
    )
}

export const SearchIcon = () => {
    return (
        <FontAwesomeIcon icon={faSearch} className='search-icon' />
    )
}

export const XIcon = () => {
    return (
        <FontAwesomeIcon icon={faX} className='x-icon icon'/>
    )
}

export const InsertImageIcon = () => {
    return (
        <FontAwesomeIcon icon={faImage} className='insert-image-icon icon'/>
    )
}

export const BackIcon = ({ setStageNumber, stageNumber }) => {

    const handlePrevImage = () => {
        if (stageNumber > 0) {
            setStageNumber(stageNumber - 1);
        }
    }

    return (
        <FontAwesomeIcon icon={faChevronLeft} className={`back-icon icon ${stageNumber === 0 && 'disabled'}`} onClick={handlePrevImage}/>
    )
}

export const NextIcon = ({ setStageNumber, stageNumber, maxNumber }) => {
    const handleNextImage = () => {
        if (stageNumber < maxNumber - 1) {
            setStageNumber(stageNumber + 1);
        }
    }
    return (
        <FontAwesomeIcon icon={faChevronRight} className={`next-icon icon ${stageNumber === 4 && 'disabled'}`} onClick={handleNextImage}/>
    )
}


// PROFILE ICONS
export const ProfileIcon = () => {
    return (
        <FontAwesomeIcon icon={faAddressCard} className='profile-icon'/>
    )
}

export const MusicianIcon = () => {
    return (
        <FontAwesomeIcon icon={faGuitars} className="musician-icon icon" />
    )
}

export const HostIcon = () => {
    return (
        <FontAwesomeIcon icon={faHouse} className="host-icon icon" />
    )
}

export const GigGoerIcon = () => {
    return (
        <FontAwesomeIcon icon={faPeopleRoof} className="gig-goer-icon icon" />
    )
}

// Establishment type icons
export const PubIcon = () => {
    return (
        <FontAwesomeIcon icon={faMartiniGlassCitrus} className="pub-icon icon" />
    )
}

export const MusicVenueIcon = () => {
    return (
        <FontAwesomeIcon icon={faSpeakers} className="music-venue-icon icon" />
    )
}

export const RestaurantIcon = () => {
    return (
        <FontAwesomeIcon icon={faUtensils} className="restaurant-icon icon" />
    )
}

export const ClubIcon = () => {
    return (
        <FontAwesomeIcon icon={faCompactDisc} className="club-icon icon" />
    )
}

export const ApartmentIcon = () => {
    return (
        <FontAwesomeIcon icon={faApartment} className="apartment-icon icon" />
    )
}

export const HouseIcon = () => {
    return (
        <FontAwesomeIcon icon={faHouse} className="house-icon icon" />
    )
}

export const VillageHallIcon = () => {
    return (
        <FontAwesomeIcon icon={faHouseFlag} className="village-hall-icon icon" />
    )
}

export const HouseOfWorshipIcon = () => {
    return (
        <FontAwesomeIcon icon={faPlaceOfWorship} className="house-of-worship-icon icon" />
    )
}

export const SchoolIcon = () => {
    return (
        <FontAwesomeIcon icon={faSchool} className="school-icon icon" />
    )
}

export const PublicSpaceIcon = () => {
    return (
        <FontAwesomeIcon icon={faPeopleGroup} className="public-space-icon icon" />
    )
}

export const OtherIcon = () => {
    return (
        <FontAwesomeIcon icon={faHouseCircleExclamation} className="other-icon icon" />
    )
}

// In house equipment icons
export const PianoIcon = () => {
    return (
        <FontAwesomeIcon icon={faPianoKeyboard} className="piano-icon icon" />
    )
}
export const SoundSystemIcon = () => {
    return (
        <FontAwesomeIcon icon={faWaveformLines} className="sound-system-icon icon" />
    )
}
export const MicrophoneIcon = () => {
    return (
        <FontAwesomeIcon icon={faMicrophone} className="microphone-icon icon" />
    )
}
export const AmpIcon = () => {
    return (
        <FontAwesomeIcon icon={faAmpGuitar} className="microphone-icon icon" />
    )
}
export const MixingDeckIcon = () => {
    return (
        <FontAwesomeIcon icon={faTurntable} className="microphone-icon icon" />
    )
}