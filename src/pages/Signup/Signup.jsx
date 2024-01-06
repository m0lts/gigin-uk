import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { GiginLogo } from "/components/Global/Logo/GiginLogo"
import { DefaultEmailInput, DefaultNameInput, DefaultPhoneNumberInput, DefaultPasswordInput, VerifyPasswordInput } from "/components/Inputs/Text/text.inputs"
import { SubmitFormButton } from "/components/Global/Buttons/Buttons"
import { AddProfileCreatedToLocalStorage, AddUserDataToLocalStorage } from "/utils/updateLocalStorage"
// import { InfoBox } from "../InfoBox/InfoBox";


export const Signup = () => {

    // States for form
    const [nameData, setNameData] = useState({
        firstName: '',
        secondName: ''
    });
    const [emailData, setEmailData] = useState('');
    const [emailError, setEmailError] = useState('');
    const [phoneNumberData, setPhoneNumberData] = useState('');
    const [passwordData, setPasswordData] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [verifyPasswordStatus, setVerifyPasswordStatus] = useState(true);
    const [signupFormData, setSignupFormData] = useState({
        userName: nameData,
        userEmail: emailData,
        userPhoneNumber: phoneNumberData,
        userPassword: passwordData
    });

    // States for response
    const [apiRoute, setApiRoute] = useState('/api/Accounts/SignUpUser.js');
    const [signupResponse, setSignupResponse] = useState();
    const navigate = useNavigate();

    useEffect(() => {
        setSignupFormData({
            userName: nameData,
            userEmail: emailData,
            userPhoneNumber: phoneNumberData,
            userPassword: passwordData
        })
    }, [nameData, emailData, phoneNumberData, passwordData])

    useEffect(() => {
        if (signupResponse) {
            if (signupResponse.status === 201) {
                AddUserDataToLocalStorage(signupResponse.data.userAccount);
                AddProfileCreatedToLocalStorage(false);
                navigate('/profile-creator');
            } else {
                console.log(`Error code: ${signupResponse.status} + Error reason: ${signupResponse.message}`);
            }
        }
    }, [signupResponse])


    return (
        <main className='accounts'>
            <section className='accounts-left'>
                <GiginLogo />
                <div className='accounts-box'>
                    <h1 className='title'>Sign up</h1>
                    {signupResponse && signupResponse.status !== 200 && (
                        <div className='error-box'>
                            <p className='message'>* {signupResponse.message}</p>
                        </div>
                    )}
                    {passwordError && (
                        <div className='error-box'>
                            <p className='message'>* {passwordError}</p>
                        </div>
                    )}
                    {!verifyPasswordStatus && (
                        <div className='error-box'>
                            <p className='message'>* Passwords do not match.</p>
                        </div>
                    )}
                    <form className='accounts-form'>
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
                            setPasswordError={setPasswordError}
                            verifyPasswordStatus={verifyPasswordStatus}
                        />
                    </form>
                    <div className='external-link'>
                        <Link to={'/login'} className='link'>
                            Already made an account?
                        </Link>
                    </div>
                </div>
            </section>
            {/* <section className='accounts-right'>
                <InfoBox />
            </section> */}
        </main>
    )
}