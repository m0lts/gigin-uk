import { Footer } from '@features/shared/components/Footer'
import { Header as MusicianHeader } from '@features/musician/components/Header'
import { Header as VenuesHeader } from '@features/venue/components/Header'
import { Header as CommonHeader} from '@features/shared/components/Header'
import '@styles/shared/layouts.styles.css'

export const MainLayout = ({ children, setAuthModal, setAuthType, user, logout, setNoProfileModal, noProfileModal }) => {

    return (
        <section className='layout-main'>
            {!user ? (
                <CommonHeader
                    setAuthModal={setAuthModal}
                    setAuthType={setAuthType}
                    user={user}
                    setNoProfileModal={setNoProfileModal} noProfileModal={noProfileModal} 
                />
            ) : (user && user.venueProfiles && user.venueProfiles.length > 0) ? (
                <VenuesHeader
                    setAuthModal={setAuthModal}
                    setAuthType={setAuthType}
                    user={user}
                    setNoProfileModal={setNoProfileModal} noProfileModal={noProfileModal}
                />
            ) : (user && user.musicianProfile) ? (
                <MusicianHeader
                    setAuthModal={setAuthModal}
                    setAuthType={setAuthType}
                    user={user}
                    setNoProfileModal={setNoProfileModal} noProfileModal={noProfileModal} 
                />
            ) : (
                <CommonHeader
                    setAuthModal={setAuthModal}
                    setAuthType={setAuthType}
                    user={user}
                    setNoProfileModal={setNoProfileModal}
                    noProfileModal={noProfileModal} 
                />
            )}
            <main className='body'>{children}</main>
            <Footer />
        </section>
    )
}