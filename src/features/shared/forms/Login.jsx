// Dependencies
import { useState, useEffect } from 'react';
import { auth } from '@lib/firebase';
import { sendSignInLinkToEmail } from 'firebase/auth';
// Components
import { AuthCard, EyeButton, GoogleMark, isGmail } from './AuthCard';
import { toast } from 'sonner';



export const LoginForm = ({ credentials, setCredentials, error, setError, clearCredentials, clearError, setAuthType, login, setAuthModal, loading, setLoading, authClosable, setAuthClosable, continueWithGoogle, noProfileModal, setNoProfileModal, user, justLoggedInRef }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [linkPhase, setLinkPhase] = useState('');
  const [linkWait, setLinkWait] = useState(0);
  const [passwordFocused, setPasswordFocused] = useState(false);

  useEffect(() => {
    if (!linkWait) return undefined;
    const timer = setTimeout(() => setLinkWait((current) => Math.max(0, current - 1)), 1000);
    return () => clearTimeout(timer);
  }, [linkWait]);

  const handleFocus = () => {
    setPasswordFocused(true);
  };

  const handleBlur = () => {
    setPasswordFocused(false);
  };

  const handleChange = (e) => {
    if (loading) return;
    const { name, value } = e.target;
    setCredentials((prev) => ({ ...prev, [name]: value }));
  };

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleLogin = async (e) => {
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
    if (!String(credentials.password || '').trim()) {
      setError({ status: true, input: 'password', message: 'Enter your password.' });
      return;
    }

    setError({ status: false, input: '', message: '' });
    setLoading(true);

    try {
      const loginResponse = await login(credentials);
      if (loginResponse && loginResponse.needsEmailVerify) {
        setAuthClosable(true);
        setAuthType('verify-email');
        return;
      }
      if (justLoggedInRef) justLoggedInRef.current = true;
      setAuthModal(false);
    } catch (err) {
      switch (err.error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          setError({ status: true, input: 'password', message: "That email and password don't match." });
          break;
        case 'auth/too-many-requests':
          setError({ status: true, input: '', message: 'Wait a few minutes, or reset your password.', title: 'Too many attempts.' });
          break;
        default:
          setError({ status: true, input: '', message: 'Check your signal and try again.', title: 'No connection.' });
          break;
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const close = () => {
    if (!authClosable) return;
    setAuthModal(false);
  };

  if (linkPhase === 'sent') {
    return (
      <AuthCard
        title="Check your email"
        icon="mail"
        closable={authClosable}
        onClose={close}
        lede={<>We sent a sign-in link to <strong>{credentials.email}</strong>. It works once, for 1 hour.</>}
      >
        {isGmail(credentials.email) ? <a className="auth-card__primary" href="https://mail.google.com" target="_blank" rel="noreferrer">Open Gmail</a> : null}
        <div className="auth-card__actions">
          <button
            type="button"
            className="auth-card__link"
            disabled={linkWait > 0}
            onClick={async () => {
              if (linkWait > 0) return;
              try {
                await sendSignInLinkToEmail(auth, credentials.email, {
                  url: `${window.location.origin}/auth/email-link`,
                  handleCodeInApp: true,
                });
              } catch { /* same answer either way */ }
              setLinkWait(30);
              toast('Sent again.');
            }}
          >
            {linkWait > 0 ? `Send it again (${linkWait}s)` : 'Send it again'}
          </button>
          <button type="button" className="auth-card__link" onClick={() => { setLinkPhase(''); clearCredentials(); }}>Use a different email</button>
        </div>
        <p className="auth-card__note">Nothing there after a minute? Check your spam or promotions folder.</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Welcome back"
      lede="Sign in to run your gigs or update your artist page."
      closable={authClosable && !loading}
      onClose={close}
    >
      <button
        type="button"
        className="auth-card__google"
        disabled={loading}
        onClick={async () => {
          try {
            setLoading(true);
            const loginResponse = await continueWithGoogle();
            if (loginResponse && loginResponse.needsEmailVerify) {
              setAuthClosable(true);
              setAuthType('verify-email');
            } else {
              if (justLoggedInRef) justLoggedInRef.current = true;
              setAuthModal(false);
            }
          } catch (err) {
            setError({ status: true, input: '', message: err?.error?.message || 'Google sign in failed' });
          } finally {
            setLoading(false);
          }
        }}
      >
        <GoogleMark />
        Continue with Google
      </button>
      <div className="auth-card__or" aria-hidden="true"><span /><em>or</em><span /></div>
      <form onSubmit={handleLogin} noValidate>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          name="email"
          value={credentials.email}
          onChange={(e) => { handleChange(e); clearError(); }}
          autoComplete="email"
          className={error.input === 'email' ? 'is-error' : ''}
        />
        <div className="auth-card__label-row">
          <label htmlFor="password">Password</label>
          <button type="button" className="auth-card__link" onClick={() => { clearError(); setAuthType('forgot-password'); }}>Forgot password?</button>
        </div>
        <div className="auth-card__password">
          <input
            type={showPassword ? 'text' : 'password'}
            name="password"
            id="password"
            value={credentials.password}
            onChange={(e) => { handleChange(e); clearError(); }}
            disabled={loading}
            autoComplete="current-password"
            className={error.input === 'password' ? 'is-error' : ''}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
          <EyeButton shown={showPassword} onClick={toggleShowPassword} />
        </div>
        {error.status ? (
          <p className="auth-card__error" role="alert">
            {error.input === 'password' ? <>That email and password don&apos;t match. Try again, or <button type="button" className="auth-card__link" onClick={() => { clearError(); setAuthType('forgot-password'); }}>reset your password</button>.</> : error.message}
          </p>
        ) : null}
        <button type="submit" className="auth-card__primary" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <button
        type="button"
        className="auth-card__text"
        onClick={async () => {
          const address = String(credentials.email || '').trim();
          if (!address) {
            setError({ status: true, input: 'email', message: 'Enter your email first, and we will send the link there.' });
            return;
          }
          if (!validateEmail(address)) {
            setError({ status: true, input: 'email', message: 'Enter an email address like name@example.com.' });
            return;
          }
          try {
            await sendSignInLinkToEmail(auth, address, {
              url: `${window.location.origin}/auth/email-link`,
              handleCodeInApp: true,
            });
          } catch { /* same answer either way */ }
          window.localStorage.setItem('emailForSignIn', address);
          setLinkPhase('sent');
          setLinkWait(30);
        }}
      >
        Email me a sign-in link instead
      </button>
      <p className="auth-card__foot">New to Gigin? <button type="button" className="auth-card__link" onClick={() => { setAuthType('signup'); clearCredentials(); clearError(); }}>Create an account</button></p>
    </AuthCard>
  );
};
