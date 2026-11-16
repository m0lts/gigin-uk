// Dependencies
import { useState, useEffect } from 'react';
// Components
import { toast } from 'sonner';
import { AuthCard, isGmail } from './AuthCard';


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

  const close = () => {
    if (!authClosable) return;
    setAuthModal(false);
    setShowSuccessMessage(false);
    setAuthType('login');
  };

  if (showSuccessMsg) {
    return (
      <AuthCard
        title="Check your email"
        icon="mail"
        closable={authClosable}
        onClose={close}
        lede={<>We sent a link to reset your password to <strong>{credentials.email}</strong>. It works once, for 1 hour.</>}
      >
        {isGmail(credentials.email) ? <a className="auth-card__primary" href="https://mail.google.com" target="_blank" rel="noreferrer">Open Gmail</a> : null}
        <div className="auth-card__actions">
          <button type="button" className="auth-card__link" onClick={handleResendPasswordReset} disabled={timer > 0}>
            {timer > 0 ? `Send it again (${timer}s)` : 'Send it again'}
          </button>
          <button type="button" className="auth-card__link" onClick={() => { setShowSuccessMessage(false); clearCredentials(); }}>Use a different email</button>
        </div>
        <p className="auth-card__note">Nothing there after a minute? Check your spam or promotions folder.</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      lede="Enter your email and we'll send you a link to choose a new one."
      closable={authClosable && !loading}
      onClose={close}
    >
      <form onSubmit={handlePasswordReset}>
        <label htmlFor="reset-email">Email</label>
        <input
          id="reset-email"
          type="email"
          name="email"
          value={credentials.email}
          onChange={(e) => { handleChange(e); clearError(); }}
          className={error.input === 'email' ? 'is-error' : ''}
        />
        {error.status ? <p className="auth-card__error" role="alert">{error.message}</p> : null}
        <button type="submit" className="auth-card__primary" disabled={loading}>{loading ? 'Sending…' : 'Send reset link'}</button>
      </form>
      <button type="button" className="auth-card__text" onClick={() => setAuthType('login')}>Back to sign in</button>
    </AuthCard>
  );
};