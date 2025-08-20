// Dependencies
import { useState } from 'react';
import { useAuth } from '@hooks/useAuth';
// Components
import { LoginForm } from '@features/shared/forms/Login';
import { SignupForm } from '@features/shared/forms/Signup';
// Styles
import '@styles/shared/modals.styles.css'
import { ForgotPasswordForm } from '@features/shared/forms/ForgotPassword';


export const AuthModal = ({ setAuthModal, authType, setAuthType, authClosable, setAuthClosable }) => {

  const { login, signup, resetPassword, checkUser, loginWithGoogle } = useAuth();
  const [credentials, setCredentials] = useState({ name: '', phoneNumber: '', email: '', password: '' });
  const [error, setError] = useState({ status: false, input: '', message: '' });
  const [loading, setLoading] = useState(false);

  const clearCredentials = () => {
    setCredentials({ name: '', phoneNumber: '', email: '', password: '' });
  };

  const clearError = () => {
    setError({ status: false, input: '', message: '' });
  };

  const handleModalClick = (e) => {
    if (loading) return;
    if (!authClosable) return;
    if (e.target.className !== 'modal') {
      setAuthModal(false);
    }
  };

  return (
    <div className='modal auth' onClick={handleModalClick}>
      {authType === 'login' ? (
        <LoginForm
          authClosable={authClosable}
          setAuthClosable={setAuthClosable}
          credentials={credentials}
          setCredentials={setCredentials}
          error={error}
          setError={setError}
          clearCredentials={clearCredentials}
          clearError={clearError}
          setAuthType={setAuthType}
          login={login}
          setAuthModal={setAuthModal}
          loading={loading}
          setLoading={setLoading}
          loginWithGoogle={loginWithGoogle}
        />
      ) : authType === 'signup' ? (
        <SignupForm
          authClosable={authClosable}
          setAuthClosable={setAuthClosable}
          credentials={credentials}
          setCredentials={setCredentials}
          error={error}
          setError={setError}
          clearCredentials={clearCredentials}
          clearError={clearError}
          setAuthType={setAuthType}
          signup={signup}
          setAuthModal={setAuthModal}
          loading={loading}
          setLoading={setLoading}
          checkUser={checkUser}
        />
      ) : authType === 'forgot-password' && (
        <ForgotPasswordForm 
          authClosable={authClosable}
          credentials={credentials}
          setCredentials={setCredentials}
          error={error}
          setError={setError}
          clearCredentials={clearCredentials}
          clearError={clearError}
          setAuthType={setAuthType}
          resetPassword={resetPassword}
          setAuthModal={setAuthModal}
          loading={loading}
          setLoading={setLoading}
          checkUser={checkUser}
        />
      )}
    </div>
  );
};