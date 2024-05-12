import { Link } from "react-router-dom";

export const LandingPage = ({ user, setUser }) => {

    const handleSignOut = async () => {
        try {
            const response = await fetch('/api/auth/SignOut', {
                method: 'POST',
            });
            if (response.status === 200) {
                window.location.reload();
                setUser(null)
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (error) {
            console.error('Sign out failed:', error);
            return null;
        }
    }

    return (
        <div>
            {user && (
                <h1>Welcome, {user.name}</h1>
            )}
            <div className="options" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <Link to={'/musicians'} className="link">
                    Musicians
                </Link>
                <Link to={'/hosts'} className="link">
                    Hosts
                </Link>
                <Link to={'/gig-goers'} className="link">
                    Gig-goers
                </Link>
            </div>
            <button onClick={handleSignOut}>
                sign out
            </button>
        </div>
    )
}