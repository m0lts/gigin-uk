import { Outlet } from "react-router-dom"
import { Footer } from "../components/common/Footer"
import { Header } from "../components/common/Header"

export const HostLayout = () => {
    return (
        <>
            <Header />
            <main><Outlet /></main>
            <Footer />
        </>
    )
}

