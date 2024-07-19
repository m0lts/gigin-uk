import { ProfileCreator } from "./ProfileCreator/ProfileCreator"

export const Profile = ({ musicianProfile }) => {
    return (
        <div className="profile">
            {musicianProfile ? (
                <h1>Profile tab</h1>
            ) : (
                <ProfileCreator />
            )}
        </div>
    )
}