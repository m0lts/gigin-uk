import { Outlet } from "react-router-dom"
import { Footer } from "../components/common/Footer"
import { HostHeader } from "../components/common/Header"

export const HostLayout = () => {
    return (
        <>
            <HostHeader />
            <main><Outlet /></main>
            <Footer />
        </>
    )
}

