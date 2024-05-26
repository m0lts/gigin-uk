import { Footer } from "../components/common/Footer"
import { Header } from "../components/common/Header"

export const MainLayout = ({ children }) => {
    return (
        <>
            <Header />
            <main>{children}</main>
            <Footer />
        </>
    )
}