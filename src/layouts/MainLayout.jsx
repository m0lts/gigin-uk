import { Footer } from "../components/common/Footer"
import { Header } from "../components/common/Header"
import '/styles/common/layouts.styles.css'

export const MainLayout = ({ children, setAuthModal }) => {
    return (
        <section className="layout-main">
            <Header
                setAuthModal={setAuthModal}
            />
            <main className="body">{children}</main>
            <Footer />
        </section>
    )
}