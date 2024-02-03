// Dependencies
    import { useState } from "react"

// Components
    import { Header } from "/components/Header/Header"
    import { AccountTile } from "/pages/ControlCentre/Tiles/Account/AccountTile"
    import { NotificationsTile } from "./Tiles/Notifications/NotificationsTile"

// Utils

// Styles
    import './control-centre.styles.css'
import { StatsTile } from "./Tiles/Stats/StatsTile"
import { GigsOverview } from "./Musician/GigsOverview/GigsOverview"
import { ProfilesOverview } from "./Musician/ProfilesOverview/ProfilesOverview"
import { Finances } from "./General/Finances/Finances"
import { AccountDetails } from "./General/AccountDetails/AccountDetails"
import { Settings } from "./General/Settings/Settings"


export const ControlCentre = () => {

    const [controlCentreSelection, setControlCentreSelection] = useState('Musician')

    return (
        <section className='control-centre'>
            <Header />
            <div className="body">
                <div className='banner'>
                    <h1>Control Centre</h1>
                    {/* <div className="buttons">
                        <button className="btn black-button" onClick={() => setControlCentreSelection('Musician')}>Musician</button>
                        <button className="btn white-button" onClick={() => setControlCentreSelection('Host')}>Host</button>
                    </div> */}
                </div>
                <div className="main">
                    <div className="constants">
                        <AccountTile />
                        <NotificationsTile />
                        <StatsTile />
                    </div>
                    <div className="variables">
                        {controlCentreSelection === 'Musician' ? (
                            <>
                                <GigsOverview />
                                <ProfilesOverview />
                            </>
                        ) : (
                            <h1>Host</h1>
                        )}
                    </div>
                    <div className="general tile bckgrd-grey">
                        <h1 className="title">Account</h1>
                        <div className="options">
                            <Finances />
                            <AccountDetails />
                            <Settings />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}