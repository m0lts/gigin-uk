import { useEffect } from 'react'
import { Header as MusicianHeader } from '@features/musician/components/Header'
import { Header as VenuesHeader } from '@features/venue/components/Header'
import { Header as CommonHeader } from '@features/shared/components/Header'
import '@styles/shared/layouts.styles.css'
import { useNavigate } from 'react-router-dom'

export const MessagesLayout = ({ children, setAuthModal, setAuthType, user, logout }) => {

    const navigate = useNavigate();

    useEffect(() => {
        if (!user) {
            navigate('/');
        }
    }, [user])

    return (
        <section className='layout-messages'>
            {(user && user.musicianProfile && user.venueProfiles && user.venueProfiles.length > 0) ? (
                <CommonHeader
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
            ) : (user && user.venueProfiles && user.venueProfiles.length > 0) ? (
                <VenuesHeader
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
            <main className='body'>{children}</main>
        </section>
    )
}