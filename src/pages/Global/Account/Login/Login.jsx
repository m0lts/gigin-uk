import { useState, useEffect } from "react"
import { GiginLogo } from "../../../../components/Global/Logo/GiginLogo"
import { DefaultEmailInput } from "../../../../components/Global/Inputs/Email/EmailInputs"
import { DefaultPasswordInput } from "../../../../components/Global/Inputs/Password/PasswordInputs";
import { NextButtonLogin, SubmitFormButton } from "../../../../components/Global/Buttons/Buttons";
import { Link } from "react-router-dom";

export const Login = () => {

    const [emailData, setEmailData] = useState('');
    const [emailError, setEmailError] = useState('');
    const [showPasswordSection, setShowPasswordSection] = useState(false);
    const [passwordData, setPasswordData] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [loginFormData, setLoginFormData] = useState({
        userEmail: emailData,
        userPassword: passwordData,
    });
    const [submitForm, setSubmitForm] = useState(false);

    useEffect(() => {
        setLoginFormData({
            userEmail: emailData,
            userPassword: passwordData,
        })
    }, [emailData, passwordData])

    useEffect(() => {
        if (submitForm) {
            console.log(loginFormData)
        }
    }, [submitForm])


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
                                setSubmitForm={setSubmitForm}
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