import { Header } from "../components/common/Header"
import '/styles/common/dashboard.styles.css'

export const DashboardLayout = ({ children, setAuthModal, setAuthType }) => {
    return (
        <section className="dashboard">
            <Header 
                setAuthType={setAuthType}
                setAuthModal={setAuthModal}
            />
            <main className="main">
                { children }
            </main>
        </section>
    )
}