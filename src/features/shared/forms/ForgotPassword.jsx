// Dependencies
import { useState, useEffect } from 'react';
// Components
import { CloseIcon, ErrorIcon } from '@features/shared/ui/extras/Icons';
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading';
import { NoTextLogo } from '@features/shared/ui/logos/Logos';
// Styles
import '@styles/forms/forms.styles.css';


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
    <div className="modal-padding auth" onClick={(e) => e.stopPropagation()}>
    <div className='modal-content auth'>
      {showSuccessMsg ? (
        <>
          <div className='head'>
            <NoTextLogo />
            <h1>Forgot Password</h1>
          </div>
          <div className='auth-form'>
            <p style={{ textAlign: 'center' }}>We have sent an email to {credentials.email} with instructions on how to reset your password.</p>
            <p style={{ textAlign: 'center', marginBottom: '1rem' }}>If you haven't received an email, click the button below to send another link.</p>
            <button className='btn text' onClick={handleResendPasswordReset} disabled={timer > 0}>
              {timer > 0 ? `Re-send forgot password link (${timer}s)` : 'Re-send forgot password link.'}
            </button>
          </div>
          {(!loading && authClosable) && (
            <button className='btn close tertiary' onClick={() => {if (!authClosable) return; setAuthModal(false); setShowSuccessMessage(false); setAuthType('login')}}>
              Close
            </button>
          )}
        </>
      ) : (
        <>
          <div className='head'>
            <NoTextLogo />
            <h1>Forgot Password</h1>
          </div>
          <form className='auth-form' onSubmit={handlePasswordReset}>
            <div className='input-group'>
              <label htmlFor='email'>Email</label>
              <input
                type='text'
                name='email'
                value={credentials.email}
                onChange={(e) => { handleChange(e); clearError(); }}
                placeholder='e.g. johnsmith@gigin.com'
                required
                className={`${error.input === 'email' && 'error'}`}
              />
            </div>
            {error.status && (
              <div className='error-box'>
                <p className='error-msg'>{error.message}</p>
              </div>
            )}
            {loading ? (
              <LoadingThreeDots />
            ) : (
              <>
                <button
                  type='submit'
                  className='btn primary'
                  disabled={error.status || !credentials.email}
                >
                  Reset Password
                </button>
              </>
            )}
          </form>
          {(!loading && authClosable) && (
            <button className='btn close tertiary' onClick={() => {if (!authClosable) return; setAuthModal(false); setShowSuccessMessage(false); setAuthType('login')}}>
              Close
            </button>
          )}
        </>
      )}
    </div>
    <div className="change-auth-type">
        <h4 className='change-auth-type-text'>Back to </h4>
        <button className='btn text' type='button' onClick={() => { setAuthType('login'); clearCredentials(); clearError(); setShowSuccessMessage(false) }}>Sign In</button>
      </div>
    </div>
  );
};