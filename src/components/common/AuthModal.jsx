// Dependencies
import { useState } from "react";
// Components
import { LoginForm } from "/forms/Login";
import { SignupForm } from "/forms/Signup";
// Styles
import '/styles/common/modals.styles.css'


export const AuthModal = ({ setAuthModal, login, signup, authType, setAuthType }) => {

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
    if (e.target.className === 'modal') {
      setAuthModal(false);
    }
  };

  return (
    <div className="modal" onClick={handleModalClick}>
      {authType === 'login' ? (
        <LoginForm
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
        />
      ) : (
        <SignupForm
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
        />
      )}
    </div>
  );
};