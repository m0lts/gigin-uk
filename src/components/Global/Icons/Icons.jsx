import { faBars, faBookmark, faX, faList, faMap, faSearch } from "@fortawesome/free-solid-svg-icons"
import { faAddressCard, faApartment, faGuitars, faHouse, faMartiniGlassCitrus, faPeopleRoof, faSpeakers, faUtensils, faCompactDisc, faHouseFlag, faPlaceOfWorship, faSchool, faPeopleGroup, faHouseCircleExclamation } from "@fortawesome/pro-light-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import './icons.styles.css'

export const MenuIcon = () => {
    return (
        <FontAwesomeIcon icon={faBars} className='menu-icon' />
    )
}

export const MapIcon = () => {
    return (
        <FontAwesomeIcon icon={faMap} className='map-icon' />
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
        <FontAwesomeIcon icon={faX} className='x-icon'/>
    )
}

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