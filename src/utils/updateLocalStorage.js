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
    const profileCreated = localStorage.getItem('profileCreated');

    return {
        userID,
        userFirstName,
        userSecondName,
        userEmail,
        profileCreated
    }
}

export const RemoveInfoFromLocalStorage = () => {
    localStorage.removeItem('userID');
    localStorage.removeItem('userFirstName');
    localStorage.removeItem('userSecondName');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('profileCreated');
    localStorage.removeItem('profiles');
}

export const AddProfileCreatedToLocalStorage = (payload) => {
    localStorage.setItem('profileCreated', payload);
}

export const AddProfileDataToLocalStorage = (payload) => {
    localStorage.setItem('profiles', JSON.stringify(payload));
}

export const GetProfileDataFromLocalStorage = () => {
    const profileData = localStorage.getItem('profiles');
    const parsedProfiles = JSON.parse(profileData);
    return parsedProfiles;
}