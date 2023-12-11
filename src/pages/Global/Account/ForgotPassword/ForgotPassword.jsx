import { useState, useEffect } from "react";
import { GiginLogo } from "../../../../components/Global/Logo/GiginLogo"
import { DefaultEmailInput } from "../../../../components/Global/Inputs/Email/EmailInputs"
import { NextButtonLogin, SubmitFormButton } from "../../../../components/Global/Buttons/Buttons"
import { Link } from "react-router-dom";
import { OneTimePasswordInput } from "../../../../components/Global/Inputs/Password/PasswordInputs";

export const ForgotPassword = () => {

    const [emailData, setEmailData] = useState('');
    const [emailError, setEmailError] = useState('');
    const [showPasswordSection, setShowPasswordSection] = useState(false);
    const [oneTimePasswordData, setOneTimePasswordData] = useState('');
    const [oneTimePasswordError, setOneTimePasswordError] = useState('');
    const [resetPasswordFormData, setResetPasswordFormData] = useState({
        userEmail: emailData,
    });
    const [submitForm, setSubmitForm] = useState(false);

    useEffect(() => {
        setResetPasswordFormData({
            userEmail: emailData,
        })
    }, [emailData])

    useEffect(() => {
        if (submitForm) {
            console.log(resetPasswordFormData)
        }
    }, [submitForm])

    return (
        <main className='accounts'>
            <section className='accounts-left'>
                <GiginLogo />
                <h1 className='title'>Forgot Password</h1>
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
                            <OneTimePasswordInput 
                                oneTimePasswordData={oneTimePasswordData}
                                setOneTimePasswordData={setOneTimePasswordData}
                                passwordError={oneTimePasswordError}
                                setPasswordError={oneTimePasswordError}
                            />
                            <SubmitFormButton 
                                passwordData={oneTimePasswordData}
                                passwordError={oneTimePasswordError}
                                setSubmitForm={setSubmitForm}
                            />
                        </>
                    )}
                </form>
                <div>
                    <Link to={'/login'}>
                        Remembered your password?
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