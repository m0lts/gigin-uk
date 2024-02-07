import { AddEventButton } from "../buttons/AddEvent"
import { MenuButton } from "../buttons/Menu"
import { GiginLogo } from "/components/logos/GiginLogo"
import { useState } from "react"

export const Header = () => {

    const [headerHeight, setHeaderHeight] = useState('fit-content')

    return (
        <header className='header' style={{ height: `${headerHeight}` }}>
            <GiginLogo />
            <div className="buttons">
                <AddEventButton 
                    setHeaderHeight={setHeaderHeight}
                />
                <MenuButton />
            </div>
        </header>
    )
}