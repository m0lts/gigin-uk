import { faBars, faBookmark, faX, faList, faMap, faSearch } from "@fortawesome/free-solid-svg-icons"
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