// Utils
    import { GetInfoFromLocalStorage } from "/utils/updateLocalStorage"

// Styles
    import './account-tile.styles.css'

export const AccountTile = () => {

    const accountInfo = GetInfoFromLocalStorage();
    const userName = accountInfo.userFirstName + " " + accountInfo.userSecondName;

    return (
        <div className="account-tile tile">
            <img src="https://via.placeholder.com/150" alt="Placeholder Image" />
            <h1>{userName}</h1>
        </div>
    )
}