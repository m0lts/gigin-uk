// Components
    import { Profile } from './Profile/Profile'

// Styles
    import './profiles-overview.styles.css'

export const ProfilesOverview = () => {
    return (
        <div className="profiles-tile tile bckgrd-grey">
            <h1 className="title">Profiles</h1>
            <div className="options">
                <Profile />
                <Profile />
                <Profile />
            </div>
        </div>
    )
}