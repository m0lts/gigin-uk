
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
            <button onClick={handleSignOut}>
                sign out
            </button>
        </div>
    )
}