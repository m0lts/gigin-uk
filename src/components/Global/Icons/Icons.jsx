import { faBars, faList, faMap } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

export const MenuIcon = () => {
    return (
        <FontAwesomeIcon icon={faBars} className='menu-icon' />
    )
}

export const MapIcon = () => {
    return (
        <FontAwesomeIcon icon={faMap} className="map-icon" />
    )
}

export const ListIcon = () => {
    return (
        <FontAwesomeIcon icon={faList} className="list-icon" />
    )
}