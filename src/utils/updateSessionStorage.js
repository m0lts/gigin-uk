export const AddUserDataToSessionStorage = (payload) => {
    sessionStorage.setItem('userID', payload._id);
    sessionStorage.setItem('userFirstName', payload.userName.firstName);
    sessionStorage.setItem('userSecondName', payload.userName.secondName);
    sessionStorage.setItem('userEmail', payload.userEmail);

    const userLoggedIn = true;
    return userLoggedIn;
}

export const GetInfoFromSessionStorage = () => {
    const userID = sessionStorage.getItem('userID');
    const userFirstName = sessionStorage.getItem('userFirstName');
    const userSecondName = sessionStorage.getItem('userSecondName');
    const userEmail = sessionStorage.getItem('userEmail');

    return {
        userID,
        userFirstName,
        userSecondName,
        userEmail,
    }
}

export const RemoveInfoFromSessionStorage = () => {
    sessionStorage.removeItem('userID');
    sessionStorage.removeItem('userFirstName');
    sessionStorage.removeItem('userSecondName');
    sessionStorage.removeItem('userEmail');
    window.location.reload();
}