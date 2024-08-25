import { useEffect } from "react";
import { Header } from "../components/venue-components/Header"
import { useAuth } from "../hooks/useAuth"
import '/styles/common/dashboard.styles.css'

export const VenueDashboardLayout = ({ children, setAuthModal, setAuthType, user, setAuthClosable }) => {

    const { loading } = useAuth();

    useEffect(() => {
        if (!loading && !user) {
            setAuthModal(true);
            setAuthClosable(false);
        }
    }, [user])

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