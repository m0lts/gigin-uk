import { useEffect, useState } from "react"
import { DefaultUserType } from "../../../../components/Global/Inputs/UserType/UserTypeInputs"
import { GiginLogo } from "../../../../components/Global/Logo/GiginLogo"
import { DefaultEmailInput } from "../../../../components/Global/Inputs/Email/EmailInputs";
import { DefaultAddressInput, DefaultNameInput, DefaultPhoneNumberInput } from "../../../../components/Global/Inputs/UserDetails/UserDetails";
import { DefaultPasswordInput, VerifyPasswordInput } from "../../../../components/Global/Inputs/Password/PasswordInputs";
import { SubmitFormButton } from "../../../../components/Global/Buttons/Buttons";
import { Link, useNavigate } from "react-router-dom";
import { AddUserDataToSessionStorage } from "../../../../utils/updateSessionStorage";

export const Signup = () => {

    // States for form
    const [userType, setUserType] = useState('');
    const [nameData, setNameData] = useState({
        firstName: '',
        secondName: ''
    });
    const [emailData, setEmailData] = useState('');
    const [emailError, setEmailError] = useState('');
    const [phoneNumberData, setPhoneNumberData] = useState('');
    const [addressData, setAddressData] = useState({
        line1: '',
        city: '',
        postCode: '',
        country: ''
    });
    const [passwordData, setPasswordData] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [verifyPasswordStatus, setVerifyPasswordStatus] = useState();
    const [signupFormData, setSignupFormData] = useState({
        userType: userType,
        userName: nameData,
        userEmail: emailData,
        userPhoneNumber: phoneNumberData,
        userAddress: addressData,
        userPassword: passwordData
    });

    // States for response
    const [apiRoute, setApiRoute] = useState('/api/Accounts/SignUpUser.js');
    const [signupResponse, setSignupResponse] = useState();
    const navigate = useNavigate();

    useEffect(() => {
        setSignupFormData({
            userType: userType,
            userName: nameData,
            userEmail: emailData,
            userPhoneNumber: phoneNumberData,
            userAddress: addressData,
            userPassword: passwordData
        })
    }, [userType, nameData, emailData, phoneNumberData, addressData, passwordData])

    useEffect(() => {
        if (signupResponse) {
            if (signupResponse.status === 201) {
                AddUserDataToSessionStorage(signupResponse.data.dataReceived);
                navigate('/');
            } else {
                console.log(signupResponse.status);
            }
        }
    }, [signupResponse])


    return (
        <main className='accounts'>
            <section className='accounts-left'>
                <GiginLogo />
                <h1 className='title'>Signup</h1>
                <form className="signup">
                    <DefaultUserType 
                        userType={userType}
                        setUserType={setUserType}
                    />
                    <DefaultNameInput 
                        nameData={nameData}
                        setNameData={setNameData}
                    />
                    <DefaultEmailInput 
                        emailData={emailData}
                        setEmailData={setEmailData}
                        emailError={emailError}
                        setEmailError={setEmailError}
                    />
                    <DefaultPhoneNumberInput
                        phoneNumberData={phoneNumberData}
                        setPhoneNumberData={setPhoneNumberData}
                    />
                    <DefaultAddressInput
                        addressData={addressData}
                        setAddressData={setAddressData}
                    />
                    <DefaultPasswordInput 
                        passwordData={passwordData}
                        setPasswordData={setPasswordData}
                        passwordError={passwordError}
                        setPasswordError={setPasswordError}
                        setVerifyPasswordStatus={setVerifyPasswordStatus}
                    />
                    <VerifyPasswordInput 
                        passwordData={passwordData}
                        verifyPasswordStatus={verifyPasswordStatus}
                        setVerifyPasswordStatus={setVerifyPasswordStatus}
                    />
                    <SubmitFormButton
                        apiRoute={apiRoute}
                        dataPayload={signupFormData}
                        setResponse={setSignupResponse}
                        passwordError={passwordError}
                        verifyPasswordStatus={verifyPasswordStatus}
                    />
                    <div>
                        <Link to={'/login'}>
                            Already made an account? Login here.
                        </Link>
                    </div>
                </form>
            </section>
            <section className='accounts-right'>

            </section>
        </main>
    )
}