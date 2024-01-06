import { Outlet } from "react-router-dom"
import './control-centre.styles.css'
import { Header } from "/components/Header/Header"

export const ControlCentreIndex = () => {
    return (
        <section className='control-centre'>
            <Header />
            <div className='body'>
                <Outlet />
            </div>
        </section>
    )
}