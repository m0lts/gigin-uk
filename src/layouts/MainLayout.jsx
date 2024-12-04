import { Footer } from "../components/common/Footer"
import { Header as MusicianHeader } from "../components/musician-components/Header"
import { Header as VenuesHeader } from "../components/venue-components/Header"
import { Header as CommonHeader} from "../components/common/Header"
import '/styles/common/layouts.styles.css'

export const MainLayout = ({ children, setAuthModal, setAuthType, user, logout }) => {

    return (
        <section className="layout-main">
            {!user ? (
                <CommonHeader
                    setAuthModal={setAuthModal}
                    setAuthType={setAuthType}
                    user={user}
                />
            ) : (user && user.venueProfiles && user.venueProfiles.length > 0) ? (
                <VenuesHeader
                    setAuthModal={setAuthModal}
                    setAuthType={setAuthType}
                    user={user}
                />
            ) : (user && user.musicianProfile) ? (
                <MusicianHeader
                    setAuthModal={setAuthModal}
                    setAuthType={setAuthType}
                    user={user}
                />
            ) : (
                <CommonHeader
                    setAuthModal={setAuthModal}
                    setAuthType={setAuthType}
                    user={user}
                />
            )}
            <main className="body">{children}</main>
            <Footer />
        </section>
    )
}