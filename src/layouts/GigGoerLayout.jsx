import { Footer } from "../components/common/Footer"
import { GigGoerHeader } from "../components/common/Header"

export const GigGoerLayout = ({ children }) => {
    return (
        <>
            <GigGoerHeader />
            <main>{children}</main>
            <Footer />
        </>
    )
}