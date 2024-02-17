import { useRef, useEffect } from "react"
import { MenuIcon } from "/components/Icons/Icons"
import { useAuth0 } from '@auth0/auth0-react'

export const MenuButton = ({ showMenu, setShowMenu }) => {

    // Show menu when showMenu is truthy and vice versa.
    const handleShowMenu = () => {
        setShowMenu(!showMenu);
    }

    return (
        <button
            className={`btn btn-border ${showMenu ? 'active' : ''}`}
            onClick={handleShowMenu}
        >
            Menu
        </button>
    )
}
