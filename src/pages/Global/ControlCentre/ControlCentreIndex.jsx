import { Outlet } from "react-router-dom"
import './control-centre.styles.css'

export const ControlCentreIndex = () => {
    return (
        <section className='control-centre'>
            <div className='header'>
                <h1>Control Centre</h1>
            </div>
            <div className='body'>
                <Outlet />
            </div>
        </section>
    )
}