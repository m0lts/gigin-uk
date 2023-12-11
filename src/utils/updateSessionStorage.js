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