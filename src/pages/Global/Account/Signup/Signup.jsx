import { useEffect, useState } from "react"
import { DefaultUserType } from "../../../../components/Global/Inputs/UserType/UserTypeInputs"
import { GiginLogo } from "../../../../components/Global/Logo/GiginLogo"
import { DefaultEmailInput } from "../../../../components/Global/Inputs/Email/EmailInputs";
import { DefaultAddressInput, DefaultNameInput, DefaultPhoneNumberInput } from "../../../../components/Global/Inputs/UserDetails/UserDetails";
import { DefaultPasswordInput, VerifyPasswordInput } from "../../../../components/Global/Inputs/Password/PasswordInputs";
import { SubmitFormButton } from "../../../../components/Global/Buttons/Buttons";
import { Link } from "react-router-dom";

export const Signup = () => {

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
    const [submitForm, setSubmitForm] = useState(false);

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
        if (submitForm) {
            console.log(signupFormData)
        }
    }, [submitForm])


    return (
        <main className='accounts'>
            <section className='accounts-left'>
                <GiginLogo />
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
                        setSubmitForm={setSubmitForm}
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