import { useState, useEffect } from "react"
import { GiginLogo } from "../../../../components/Global/Logo/GiginLogo"
import { DefaultEmailInput } from "../../../../components/Global/Inputs/Email/EmailInputs"
import { DefaultPasswordInput } from "../../../../components/Global/Inputs/Password/PasswordInputs";
import { NextButtonLogin, SubmitFormButton } from "../../../../components/Global/Buttons/Buttons";

export const Login = () => {

    const [emailData, setEmailData] = useState();
    const [emailError, setEmailError] = useState('');
    const [showPasswordSection, setShowPasswordSection] = useState(false);
    const [passwordData, setPasswordData] = useState();
    const [passwordError, setPasswordError] = useState();
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
                                setPasswordError={setPasswordError}
                                setSubmitForm={setSubmitForm}
                            />
                        </>
                    )}
                </form>
            </section>
            <section className='accounts-right'>

            </section>
        </main>
    )
}