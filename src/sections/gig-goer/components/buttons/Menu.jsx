import { MenuIcon } from "/components/Icons/Icons"

export const MenuButton = () => {
    return (
        <button className="btn white menu-btn">
            <span>Menu |</span>
            <MenuIcon />
        </button>
    )
}