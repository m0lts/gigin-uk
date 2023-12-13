import { useState, useEffect } from "react";
import { GiginLogo } from "../../../../components/Global/Logo/GiginLogo"
import { DefaultEmailInput } from "../../../../components/Global/Inputs/Email/EmailInputs"
import { NextButtonForgotPassword, SubmitFormButton } from "../../../../components/Global/Buttons/Buttons"
import { Link, useNavigate } from "react-router-dom";
import { OneTimePasswordInput, DefaultPasswordInput, VerifyPasswordInput } from "../../../../components/Global/Inputs/Password/PasswordInputs";
import { InfoBox } from "../InfoBox/InfoBox";
import '../accounts.styles.css'

export const ForgotPassword = () => {

    // States for forgot password form
    const [emailData, setEmailData] = useState('');
    const [emailError, setEmailError] = useState('');
    const [emailSentMessage, setEmailSentMessage] = useState('If there is an account associated with that email address, you will recieve an email with a 6-digit one time passcode. Please enter the passcode below.')
    const [showPasswordSection, setShowPasswordSection] = useState(false);
    const [oneTimePasswordData, setOneTimePasswordData] = useState('');
    const [oneTimePasswordError, setOneTimePasswordError] = useState('');
    // States for reset password form
    const [passwordData, setPasswordData] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [verifyPasswordStatus, setVerifyPasswordStatus] = useState();
    const [forgotPasswordFormData, setForgotPasswordFormData] = useState({
        userEmail: emailData,
        userOTP: oneTimePasswordData,
        userPassword: passwordData,
    });
    // States for forgot password response
    const [apiRoute, setApiRoute] = useState('/api/Accounts/UserForgotPassword.js');
    const [forgotPasswordResponse, setForgotPasswordResponse] = useState();
    const [showResetPasswordSection, setShowResetPasswordSection] = useState(false);
    // States for reset password response
    const [resetPasswordResponse, setResetPasswordResponse] = useState();
    const navigate = useNavigate();


    useEffect(() => {
        setForgotPasswordFormData({
            userEmail: emailData,
            userOTP: oneTimePasswordData,
            userPassword: passwordData,
        })
    }, [emailData, oneTimePasswordData, passwordData])

    useEffect(() => {
        if (showPasswordSection) {
            setApiRoute('/api/Accounts/VerifyUserOTP.js');
        }
    }, [showPasswordSection])

    useEffect(() => {
        if (forgotPasswordResponse) {
            if (forgotPasswordResponse.status === 201) {
                setShowResetPasswordSection(true);
                setApiRoute('/api/Accounts/ResetUserPassword.js');
            }
        }
    }, [forgotPasswordResponse])

    useEffect(() => {
        if (resetPasswordResponse) {
            if (resetPasswordResponse.status === 201) {
                navigate('/login');
            } else {
                console.log(resetPasswordResponse);
            }
        }
    }, [resetPasswordResponse])



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
                        <NextButtonForgotPassword 
                            emailData={emailData}
                            setEmailError={setEmailError}
                            setShowPasswordSection={setShowPasswordSection}
                            dataPayload={forgotPasswordFormData}
                            apiRoute={apiRoute}
                        />
                    )}
                    {showPasswordSection && (
                        <>  
                            <p>{emailSentMessage}</p>
                            <OneTimePasswordInput 
                                oneTimePasswordData={oneTimePasswordData}
                                setOneTimePasswordData={setOneTimePasswordData}
                                passwordError={oneTimePasswordError}
                                setPasswordError={setOneTimePasswordError}
                            />
                            {!showResetPasswordSection && (
                                <SubmitFormButton 
                                    passwordData={oneTimePasswordData}
                                    passwordError={oneTimePasswordError}
                                    apiRoute={apiRoute}
                                    dataPayload={forgotPasswordFormData}
                                    setResponse={setForgotPasswordResponse}
                                />
                            )}
                        </>
                    )}
                    {showResetPasswordSection && (
                        <>
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
                                dataPayload={forgotPasswordFormData}
                                setResponse={setResetPasswordResponse}
                                passwordError={passwordError}
                                verifyPasswordStatus={verifyPasswordStatus}
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
                <InfoBox />
            </section>
        </main>
    )
}