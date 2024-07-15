import { useEffect } from "react";
import { Header } from "../components/common/Header"
import { useAuth } from "../hooks/useAuth"
import '/styles/common/dashboard.styles.css'

export const DashboardLayout = ({ children, setAuthModal, setAuthType, user }) => {

    const { loading } = useAuth();

    useEffect(() => {
        if (!loading && !user) {
            setAuthModal(true);
        }
    }, [user, loading])

    return (
        <section className="dashboard">
            <Header 
                setAuthType={setAuthType}
                setAuthModal={setAuthModal}
                user={user}
            />
            <main className="main">
                { children }
            </main>
        </section>
    )
}