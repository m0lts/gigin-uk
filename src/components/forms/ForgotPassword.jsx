// Dependencies
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
// Components
import { NoTextLogoLink } from "/ui/logos/Logos";
import { SeeIcon, CloseIcon } from "/components/ui/Extras/Icons";
import { LoadingThreeDots } from '../ui/loading/Loading';
// Styles
import '/styles/forms/forms.styles.css'
import { ErrorIcon } from '../ui/Extras/Icons';
import { TextLogo } from '../ui/logos/Logos';



export const ForgotPasswordForm = ({ credentials, setCredentials, error, setError, clearCredentials, clearError, setAuthType, resetPassword, setAuthModal, loading, setLoading, authClosable }) => {

  const [showSuccessMsg, setShowSuccessMessage] = useState(false);
  const [timer, setTimer] = useState(0);

  const handleChange = (e) => {
    if (loading) return;
    const { name, value } = e.target;
    setCredentials((prev) => ({ ...prev, [name]: value }));
  };

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!validateEmail(credentials.email)) {
      setError({ status: true, input: 'email', message: '* Please enter a valid email address' });
      return;
    }

    setError({ status: false, input: '', message: '' });
    setLoading(true);

    try {
      await resetPassword(credentials.email);
      setShowSuccessMessage(true);
      setTimer(60);
    } catch (err) {
      setError({ status: true, input: 'email', message: '* No accounts associated with that email address.' });
    } finally {
      setLoading(false);
    }
  };

  const handleResendPasswordReset = async () => {
    if (loading || timer > 0) return;
    setLoading(true);

    try {
      await resetPassword(credentials.email);
      setTimer(60);
    } catch (err) {
      console.error('Failed to resend password reset email:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (timer > 0) {
      const intervalId = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);

      return () => clearInterval(intervalId);
    }
  }, [timer]);

  return (
    <div className="modal-content auth" onClick={(e) => e.stopPropagation()}>
      {showSuccessMsg ? (
        <>
          <div className="head">
            <TextLogo />
            <h1>Forgot Password</h1>
          </div>
          <div className="auth-form">
            <p style={{ textAlign: 'center' }}>We have sent you an email to {credentials.email} with instructions on how to reset your password.</p>
            <p style={{ textAlign: 'center', marginBottom: '1rem' }}>If you haven't received an email, click the button below to send another link.</p>
            <button className="btn text" onClick={handleResendPasswordReset} disabled={timer > 0}>
              {timer > 0 ? `Re-send forgot password link (${timer}s).` : 'Re-send forgot password link.'}
            </button>
            <div className="change-auth-type">
              <p>Back to <button className="btn text" type='button' onClick={() => { setAuthType('login'); clearCredentials(); clearError(); setShowSuccessMessage(false) }}>Login</button></p>
            </div>
          </div>
          {(!loading && authClosable) && (
            <button className="btn close tertiary" onClick={() => {if (!authClosable) return; setAuthModal(false); setShowSuccessMessage(false); setAuthType('login')}}>
              <CloseIcon />
            </button>
          )}
        </>
      ) : (
        <>
          <div className="head">
            <TextLogo />
            <h1>Forgot Password</h1>
          </div>
          <form className="auth-form" onSubmit={handlePasswordReset}>
            <div className="input-group">
              <label htmlFor="email">Email</label>
              <input
                type="text"
                name="email"
                value={credentials.email}
                onChange={(e) => { handleChange(e); clearError(); }}
                placeholder="e.g. johnsmith@gigin.com"
                required
                className={`${error.input === 'email' && 'error'}`}
              />
            </div>
            {error.status && (
              <div className="error-box">
                <p className="error-msg">{error.message}</p>
              </div>
            )}
            {loading ? (
              <LoadingThreeDots />
            ) : (
              <>
                <button
                  type="submit"
                  className="btn primary"
                  disabled={error.status || !credentials.email}
                >
                  Send Link
                </button>
                <div className="change-auth-type">
                  <p>Back to <button className="btn text" type='button' onClick={() => { setAuthType('login'); clearCredentials(); clearError(); setShowSuccessMessage(false) }}>Login</button></p>
                </div>
              </>
            )}
          </form>
          {(!loading && authClosable) && (
            <button className="btn close tertiary" onClick={() => {if (!authClosable) return; setAuthModal(false); setShowSuccessMessage(false); setAuthType('login')}}>
              <ErrorIcon />
            </button>
          )}
        </>
      )}
    </div>
  );
};