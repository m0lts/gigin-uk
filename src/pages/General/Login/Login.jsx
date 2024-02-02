// Dependencies
    import { useState, useEffect } from "react"
    import { Link, useNavigate } from "react-router-dom";

// Components
    import { GiginLogo } from "/components/Logo/GiginLogo"
    import { DefaultEmailInput, DefaultPasswordInput } from "/pages/General/Login/Inputs/Login.inputs.jsx"
    import { SubmitFormButton } from "/pages/General/Login/Buttons/Login.buttons.jsx"

// Utils
    import { AddProfileCreatedToLocalStorage, AddProfileDataToLocalStorage, AddUserDataToLocalStorage } from "/utils/updateLocalStorage";

// Styles
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
                if (loginResponse.data.userProfile) {
                    AddProfileCreatedToLocalStorage(true);
                    AddProfileDataToLocalStorage(loginResponse.data.userProfile.profiles);
                } else {
                    AddProfileCreatedToLocalStorage(false);
                }
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
        </main>
    )
}