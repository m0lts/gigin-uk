// Dependencies
import { Outlet } from "react-router-dom"

export const AccountPage = () => {
    return (
        <section className="account-page">
            <div className="left">
                <Outlet />
            </div>
            <div className="right">
                {/* <h2>Helping Cambridge's venues put live music on the map. For <span className="text-effect">YOU</span> to enjoy!</h2> */}
            </div>
        </section>
    )
}