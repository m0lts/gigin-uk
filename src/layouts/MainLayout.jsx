import { Footer } from "../components/common/Footer"
import { Header as MusicianHeader } from "../components/musician-components/Header"
import { Header as VenuesHeader } from "../components/venue-components/Header"
import '/styles/common/layouts.styles.css'

export const MainLayout = ({ children, setAuthModal, setAuthType, user, logout }) => {
    return (
        <section className="layout-main">
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
            <Footer />
        </section>
    )
}