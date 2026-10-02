// Dependencies
import { useState, useEffect } from 'react';
// Components
import { CloseIcon, ErrorIcon } from '@features/shared/ui/extras/Icons';
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading';
import { NoTextLogo } from '@features/shared/ui/logos/Logos';
// Styles
import '@styles/forms/forms.styles.css';
import { toast } from 'sonner';
import { LoadingSpinner } from '../ui/loading/Loading';


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

    if (!String(credentials.email || '').trim()) {
      setError({ status: true, input: 'email', message: 'Enter your email address.' });
      return;
    }
    if (!validateEmail(credentials.email)) {
      setError({ status: true, input: 'email', message: 'Enter an email address like name@example.com.' });
      return;
    }

    setError({ status: false, input: '', message: '' });
    setLoading(true);

    try {
      await resetPassword(credentials.email);
      setShowSuccessMessage(true);
      setTimer(30);
    } catch (err) {
      setError({ status: true, input: '', message: err?.message || 'Check your signal and try again.', title: err?.message?.includes('connection') ? 'No connection.' : '' });
    } finally {
      setLoading(false);
    }
  };

  const handleResendPasswordReset = async () => {
    if (loading || timer > 0) return;
    setLoading(true);
    try {
      await resetPassword(credentials.email);
      setTimer(30);
      toast('Sent again.');
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
            <h1>Check your email</h1>
          </div>
          <div className='auth-form'>
            <p>If {credentials.email} has a Gigin account, we&apos;ve sent a link to choose a new password. It works once, for 1 hour.</p>
            <p>Nothing there? Check your spam folder.</p>
            <button className='btn text' onClick={handleResendPasswordReset} disabled={timer > 0}>
              {timer > 0 ? `Send again in ${timer}s` : 'Send it again'}
            </button>
            <button type='button' className='btn text' onClick={() => { setShowSuccessMessage(false); clearCredentials(); }}>Use a different email</button>
            <button type='button' className='btn text' onClick={() => setAuthType('login')}>Back to log in</button>
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
            <h1>Reset your password</h1>
            <p>Enter the email you log in with and we&apos;ll send a link to choose a new password.</p>
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
                className={`${error.input === 'email' && 'error'}`}
              />
            </div>
            {error.status && (
              <div className='error-box'>
                <p className='error-msg'>{error.message}</p>
              </div>
            )}
            {loading ? (
              <LoadingSpinner marginTop={'1.25rem'} />
            ) : (
              <>
                <button
                  type='submit'
                  className='btn primary'
                >
                  Email me a reset link
                </button>
                <button type='button' className='btn text' onClick={() => setAuthType('login')}>Back to log in</button>
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
    </div>
  );
};