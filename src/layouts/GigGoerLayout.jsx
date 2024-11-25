import { Footer } from "../components/common/Footer"
import { Header } from "../components/common/Header"

export const GigGoerLayout = ({ children }) => {
    return (
        <>
            <Header />
            <main>{children}</main>
            <Footer />
        </>
    )
}