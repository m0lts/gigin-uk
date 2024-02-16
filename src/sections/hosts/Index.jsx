import { Outlet } from "react-router-dom";
import './styles/host.styles.css'

export const HostIndex = () => {
    return (
        <section className="host">
            <Outlet />
        </section>
    );
}