import { useEffect } from "react"
import { Header } from "../components/common/Header"
import '/styles/common/layouts.styles.css'
import { useNavigate } from "react-router-dom"

export const MessagesLayout = ({ children, setAuthModal, setAuthType, user, logout }) => {

    const navigate = useNavigate();

    useEffect(() => {
        if (!user) {
            navigate('/');
        }
    }, [user])

    return (
        <section className="layout-messages">
            <Header
                setAuthModal={setAuthModal}
                setAuthType={setAuthType}
                user={user}
                logout={logout}
            />
            <main className="body">{children}</main>
        </section>
    )
}