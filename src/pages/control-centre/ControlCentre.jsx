// Dependencies
import { Outlet } from "react-router-dom"

// Components
import { ControlCentreHeader } from "/components/headers/ControlCentreHeader";

// Styles and extras
import './control-centre.styles.css'

export const ControlCentre = () => {

    return (
        <section className="control-centre">
            <ControlCentreHeader />
            <main className="main">
                <Outlet />
            </main>
        </section>
    )
}