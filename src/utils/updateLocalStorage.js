export const AddUserDataToLocalStorage = (payload) => {
    localStorage.setItem('userID', payload._id);
    localStorage.setItem('userFirstName', payload.userName.firstName);
    localStorage.setItem('userSecondName', payload.userName.secondName);
    localStorage.setItem('userEmail', payload.userEmail);

    const userLoggedIn = true;
    return userLoggedIn;
}

export const GetInfoFromLocalStorage = () => {
    const userID = localStorage.getItem('userID');
    const userFirstName = localStorage.getItem('userFirstName');
    const userSecondName = localStorage.getItem('userSecondName');
    const userEmail = localStorage.getItem('userEmail');

    return {
        userID,
        userFirstName,
        userSecondName,
        userEmail,
    }
}

export const RemoveInfoFromLocalStorage = () => {
    localStorage.removeItem('userID');
    localStorage.removeItem('userFirstName');
    localStorage.removeItem('userSecondName');
    localStorage.removeItem('userEmail');
    window.location.reload();
}