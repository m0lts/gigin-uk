import { useEffect } from "react"
import { Header as MusicianHeader } from "../components/musician-components/Header"
import { Header as VenuesHeader } from "../components/venue-components/Header"
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
            {user.venueProfiles ? (
                <VenuesHeader
                    setAuthModal={setAuthModal}
                    setAuthType={setAuthType}
                    user={user}
                    logout={logout}
                />

            ) : (
                <MusicianHeader
                    setAuthModal={setAuthModal}
                    setAuthType={setAuthType}
                    user={user}
                    logout={logout}
                />

            )}
            <main className="body">{children}</main>
        </section>
    )
}