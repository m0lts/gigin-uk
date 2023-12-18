import { useState, useEffect } from "react"
import { GiginLogo } from "../../../../components/Global/Logo/GiginLogo"
import { DefaultEmailInput } from "../../../../components/Global/AccountInputs/Email/EmailInputs"
import { DefaultPasswordInput } from "../../../../components/Global/AccountInputs/Password/PasswordInputs";
import { SubmitFormButton } from "../../../../components/Global/Buttons/Buttons";
import { Link, useNavigate } from "react-router-dom";
import { AddUserDataToLocalStorage } from "../../../../utils/updateLocalStorage";
// import { InfoBox } from "../InfoBox/InfoBox";
import '../accounts.styles.css'
import './login.styles.css'

export const Login = () => {

    // States for form
    const [emailData, setEmailData] = useState('');
    const [emailError, setEmailError] = useState('');
    const [showPasswordSection, setShowPasswordSection] = useState(false);
    const [passwordData, setPasswordData] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [loginFormData, setLoginFormData] = useState({
        userEmail: emailData,
        userPassword: passwordData,
    });

    // States for response
    const [apiRoute, setApiRoute] = useState('/api/Accounts/LoginUser.js');
    const [loginResponse, setLoginResponse] = useState();
    const navigate = useNavigate();

    useEffect(() => {
        setLoginFormData({
            userEmail: emailData,
            userPassword: passwordData,
        })
    }, [emailData, passwordData])

    useEffect(() => {
        if (loginResponse) {
            if (loginResponse.status === 201) {
                AddUserDataToLocalStorage(loginResponse.data.userAccount);
                navigate('/');
            } else {
                console.log(`Error code: ${loginResponse.status} + Error reason: ${loginResponse.message}`);
            }
        }
    }, [loginResponse])


    return (
        <main className='accounts'>
            <section className='accounts-left'>
                <div className='accounts-logo'>
                    <GiginLogo />
                </div>
                <div className='accounts-box'>
                    <h1 className='title'>Log in</h1>
                    {loginResponse && loginResponse.status !== 200 && (
                        <div className='error-box'>
                            <p className='message'>* {loginResponse.message}</p>
                        </div>
                    )}
                    {passwordError && (
                        <div className='error-box'>
                            <p className='message'>* {passwordError}</p>
                        </div>
                    )}
                    <form className='accounts-form'>
                        <DefaultEmailInput 
                            emailData={emailData}
                            setEmailData={setEmailData}
                            emailError={emailError}
                            setEmailError={setEmailError}
                            disableInput={showPasswordSection}
                            setDisableInput={setShowPasswordSection}
                            setPasswordData={setPasswordData}
                        />
                        <DefaultPasswordInput 
                            passwordData={passwordData}
                            setPasswordData={setPasswordData}
                            passwordError={passwordError}
                            setPasswordError={setPasswordError}
                        />
                        <SubmitFormButton 
                            passwordData={passwordData}
                            passwordError={passwordError}
                            apiRoute={apiRoute}
                            dataPayload={loginFormData}
                            setResponse={setLoginResponse}
                            setPasswordError={setPasswordError}
                        />
                    </form>
                    <div className='external-link'>
                        <Link to={'/forgotpassword'} className='link'>
                            Forgotten your password?
                        </Link>
                    </div>
                    <div className='external-link'>
                        <Link to={'/signup'} className='link'>
                            New to Gigin? Create an account here.
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