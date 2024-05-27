import { Footer } from "../components/common/Footer"
import { Header } from "../components/common/Header"
import '/styles/common/layouts.styles.css'

export const MainLayout = ({ children, setAuthModal, setAuthType }) => {
    return (
        <section className="layout-main">
            <Header
                setAuthModal={setAuthModal}
                setAuthType={setAuthType}
            />
            <main className="body">{children}</main>
            <Footer />
        </section>
    )
}