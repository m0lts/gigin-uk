import { useState, useEffect } from "react"
import { GiginLogo } from "../../../../components/Global/Logo/GiginLogo"
import { DefaultEmailInput } from "../../../../components/Global/Inputs/Email/EmailInputs"
import { DefaultPasswordInput } from "../../../../components/Global/Inputs/Password/PasswordInputs";
import { NextButtonLogin, SubmitFormButton } from "../../../../components/Global/Buttons/Buttons";
import { Link, useNavigate } from "react-router-dom";
import { AddUserDataToSessionStorage } from "../../../../utils/updateSessionStorage";

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
            if (loginResponse.status === 200) {
                AddUserDataToSessionStorage(loginResponse.data.userAccount);
                navigate('/');
            } else {
                console.log(`Error code: ${loginResponse.status} + Error reason: ${loginResponse.message}`);
            }
        }
    }, [loginResponse])


    return (
        <main className='accounts'>
            <section className='accounts-left'>
                <GiginLogo />
                <h1 className='title'>Login</h1>
                <form className="login">
                    <DefaultEmailInput 
                        emailData={emailData}
                        setEmailData={setEmailData}
                        emailError={emailError}
                        setEmailError={setEmailError}
                        disableInput={showPasswordSection}
                        setDisableInput={setShowPasswordSection}
                        setPasswordData={setPasswordData}
                    />
                    {emailData && !showPasswordSection && !emailError && (
                        <NextButtonLogin 
                            emailData={emailData}
                            setEmailError={setEmailError}
                            setShowPasswordSection={setShowPasswordSection}
                        />
                    )}
                    {showPasswordSection && (
                        <>
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
                            />
                        </>
                    )}
                </form>
                <div>
                    <Link to={'/forgotpassword'}>
                        Forgotten your password?
                    </Link>
                </div>
                <div>
                    <Link to={'/signup'}>
                        New to Gigin? Create an account here.
                    </Link>
                </div>
            </section>
            <section className='accounts-right'>

            </section>
        </main>
    )
}