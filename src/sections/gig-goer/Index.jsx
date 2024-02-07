import { Outlet } from "react-router-dom";
import './styles/gig-goer.styles.css'

export const GigGoerIndex = () => {
    return (
        <section className="gig-goer">
            <Outlet />
        </section>
    );
}