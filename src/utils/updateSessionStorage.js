export const AddUserDataToSessionStorage = (payload) => {
    sessionStorage.setItem('userFirstName', payload.userName.firstName);
    sessionStorage.setItem('userSecondName', payload.userName.secondName);
    sessionStorage.setItem('userEmail', payload.userEmail);
    sessionStorage.setItem('userType', payload.userType);
    sessionStorage.setItem('userAddressLine1', payload.userAddress.line1);
    sessionStorage.setItem('userAddressCity', payload.userAddress.city);
    sessionStorage.setItem('userAddressPostCode', payload.userAddress.postCode);
    sessionStorage.setItem('userAddressCountry', payload.userAddress.country);

    const userLoggedIn = true;
    return userLoggedIn;
}

export const GetInfoFromSessionStorage = () => {
    const userFirstName = sessionStorage.getItem('userFirstName');
    const userSecondName = sessionStorage.getItem('userSecondName');
    const userEmail = sessionStorage.getItem('userEmail');
    const userType = sessionStorage.getItem('userType');
    const userAddressLine1 = sessionStorage.getItem('userAddressLine1');
    const userAddressCity = sessionStorage.getItem('userAddressCity');
    const userAddressPostCode = sessionStorage.getItem('userAddressPostCode');
    const userAddressCountry = sessionStorage.getItem('userAddressCountry');

    return {
        userFirstName,
        userSecondName,
        userEmail,
        userType,
        userAddressLine1,
        userAddressCity,
        userAddressPostCode,
        userAddressCountry
    }
}

export const RemoveInfoFromSessionStorage = () => {
    sessionStorage.removeItem('userFirstName');
    sessionStorage.removeItem('userSecondName');
    sessionStorage.removeItem('userEmail');
    sessionStorage.removeItem('userType');
    sessionStorage.removeItem('userAddressLine1');
    sessionStorage.removeItem('userAddressCity');
    sessionStorage.removeItem('userAddressPostCode');
    sessionStorage.removeItem('userAddressCountry');
    window.location.reload();
}