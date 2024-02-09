import { GiginLogo } from '/components/logos/GiginLogo'
import { MenuButton } from '../buttons/MenuButton'
import { AddEventButton } from '../buttons/AddEventButton'

export const Header = ({ showModal, setShowModal }) => {
    return (
        <div className="header shadow">
            <GiginLogo />
            <div className="buttons">
                <AddEventButton
                    showModal={showModal}
                    setShowModal={setShowModal}
                />
                <MenuButton />
            </div>
        </div>
    )
}