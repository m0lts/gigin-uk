// Dependencies
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
// Components
import { AuthCard, EyeButton, GoogleMark } from './AuthCard';
// Styles
import '@styles/forms/forms.styles.css';
import '@styles/shared/modals.styles.css';
import { isBlockedEmail } from '../../../services/utils/validation';
import { FEATURES } from '../../../config/features';
import { artistDestination } from '../../../config/artistDestination';

/**
 * SignupForm - a React component for signing up to Gigin.
 *
 * This component expects the following props:
 * - credentials: an object containing the user's name, email, phone number, and password.
 * - setCredentials: a function to update the credentials object.
 * - error: an object containing an error status and message.
 * - setError: a function to update the error object.
 * - clearCredentials: a function to clear the credentials object.
 * - clearError: a function to clear the error object.
 * - setAuthType: a function to update the auth type (either 'signup' or 'login').
 * - setAuthModal: a function to update the auth modal state.
 * - loading: a boolean indicating whether the component is loading or not.
 * - setLoading: a function to update the loading state.
 * - authClosable: a boolean indicating whether the auth modal can be closed or not.
 * - setAuthClosable: a function to update the authClosable state.
 * - noProfileModal: a boolean indicating whether the no profile modal should be shown or not.
 * - setNoProfileModal: a function to update the noProfileModal state.
 *
 * This component renders a form for signing up to Gigin, with fields for name, email, phone number, password, and terms and conditions acceptance.
 * It also renders a button for signing up with Google, and a link to the terms and conditions page.
 * If the user has already signed up, it renders a button to login instead.
 */
export const SignupForm = ({ credentials, setCredentials, error, setError, clearCredentials, clearError, setAuthType, setAuthModal, loading, setLoading, authClosable, setAuthClosable, noProfileModal, setNoProfileModal }) => {
  const navigate = useNavigate();

  const { signup, continueWithGoogle } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [role, setRole] = useState('');

  const handleChange = (e) => {
  if (loading) return;
    const { name, value } = e.target;
    const cleanedValue = name === 'phoneNumber' ? value.replace(/\s+/g, '') : value;
    setCredentials((prev) => ({ ...prev, [name]: cleanedValue }));
  };

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSignup = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!validateEmail(credentials.email)) {
      setError({ status: true, input: 'email', message: '*Please enter a valid email address' });
      return;
    }

    if (isBlockedEmail(credentials.email)) {
      setError({
        status: true,
        input: 'email',
        message: "*We can't deliver to the email address you entered. Please use a personal email (e.g. Gmail/Outlook)."
      });
      return;
    }

    // if (!isValidE164(credentials.phoneNumber)) {
    //   setError({ status: true, input: 'phoneNumber', message: '*Please enter a valid phone number' });
    //   return;
    // }

    if (!termsAccepted) {
      setError({ status: true, input: 'terms', message: '*You must accept the terms and conditions' });
      return;
    }

    setError({ status: false, input: '', message: '' });
    setLoading(true);

    try {
      // const exists = await getPhoneExistsBoolean(credentials.phoneNumber);
      // if (exists) {
      //   setError({ status: true, input: 'phoneNumber', message: '*Phone number already in use.' });
      //   return;
      // }
      const signupResponse = await signup(credentials, marketingConsent);
      if (signupResponse && signupResponse.needsEmailVerify) {
        setAuthClosable(true);
        setAuthType('verify-email');
      }
    } catch (err) {
      switch (err.error.code) {
        case 'auth/email-already-in-use':
          setError({ status: true, input: 'email', message: '*Email already in use.' });
          break;
        case 'auth/invalid-email':
          setError({ status: true, input: 'email', message: '*Invalid email address.' });
          break;
        case 'auth/weak-password':
          setError({ status: true, input: 'password', message: '*Password should be at least 6 characters.' });
          break;
        case 'auth/user-disabled':
          setError({ status: true, input: '', message: '*This account has been disabled.' });
          break;
        case 'auth/user-not-found':
          setError({ status: true, input: 'email', message: '*User not found.' });
          break;
        case 'auth/too-many-requests':
          setError({ status: true, input: '', message: '*Too many requests. Please try again later.' });
          break;
        case 'auth/operation-not-allowed':
          setError({ status: true, input: '', message: '*Operation not allowed.' });
          break;
        case 'auth/password-does-not-meet-requirements':
          setError({ status: true, input: 'password', message: 'Use at least 6 characters, with a capital letter, a lowercase letter, a number and a symbol.' });
          break;
        default:
          setError({ status: true, input: '', message: '*An error occurred. Please try again.' });
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

  if (!role) {
    return (
      <AuthCard title="Join Gigin" lede="Free to start. Which one are you?" closable={authClosable} onClose={close}>
        <button
          type="button"
          className="auth-card__choice"
          onClick={() => {
            setCredentials((current) => ({ ...current, signupAs: '' }));
            setRole('venue');
          }}
        >
          <i aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" strokeWidth="1.6" /></svg></i>
          <span><strong>I book live music</strong>Post gigs, pick your line-up and get promo in one place.</span>
        </button>
        <button
          type="button"
          className="auth-card__choice"
          onClick={() => {
            setCredentials((current) => ({ ...current, signupAs: 'artist' }));
            setRole('artist');
          }}
        >
          <i aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 18a3 3 0 1 1-2-2.83V6.5l10-2v9.67A3 3 0 1 1 15 17V8.2l-6 1.2v8.8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg></i>
          <span><strong>I&apos;m an artist</strong>Make your page, apply to gigs and get booked.</span>
        </button>
        <p className="auth-card__note">Applied to a gig before? Use the same email and we&apos;ll link it to your account.</p>
        <p className="auth-card__foot">Already on Gigin? <button type="button" className="auth-card__link" onClick={() => { setAuthType('login'); clearCredentials(); clearError(); }}>Sign in</button></p>
      </AuthCard>
    );
  }

  const venueAccount = role !== 'artist';
  const canSubmit = !loading && !error.status && credentials.name && credentials.email && credentials.password && termsAccepted;

  return (
    <AuthCard
      title={venueAccount ? 'Create your venue account' : 'Create your artist account'}
      lede={venueAccount ? "Then we'll set up your venue together." : "Then we'll set up your page together."}
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
            const signupResponse = await continueWithGoogle(marketingConsent);
            if (signupResponse && signupResponse.redirect === 'create-musician-profile') {
              setAuthModal(false);
              setAuthClosable(true);
              navigate(artistDestination(null, FEATURES));
            } else {
              setAuthModal(false);
              setAuthClosable(true);
            }
          } catch (err) {
            setError({ status: true, input: '', message: err?.error?.message || 'Google sign up failed' });
          } finally {
            setLoading(false);
          }
        }}
      >
        <GoogleMark />
        Continue with Google
      </button>
      <p className="auth-card__fine">
        By signing up with Google, you agree to our <Link to="/terms-and-conditions">terms and conditions</Link>.
      </p>
      <div className="auth-card__or" aria-hidden="true"><span /><em>or</em><span /></div>
      <form onSubmit={handleSignup} noValidate>
        <label htmlFor="name">Name</label>
        <input
          type="text"
          id="name"
          name="name"
          value={credentials.name}
          onChange={(e) => { handleChange(e); clearError(); }}
          autoComplete="name"
          required
          disabled={loading}
        />
        <label htmlFor="email">Email</label>
        <input
          type="email"
          id="email"
          name="email"
          value={credentials.email}
          onChange={(e) => { handleChange(e); clearError(); }}
          autoComplete="email"
          required
          disabled={loading}
          className={String(error.input || '').includes('email') ? 'is-error' : ''}
        />
        <label htmlFor="password">Password</label>
        <div className="auth-card__password">
          <input
            type={showPassword ? 'text' : 'password'}
            name="password"
            id="password"
            value={credentials.password}
            onChange={(e) => { handleChange(e); clearError(); }}
            autoComplete="new-password"
            required
            disabled={loading}
            className={error.input === 'password' ? 'is-error' : ''}
          />
          <EyeButton shown={showPassword} onClick={toggleShowPassword} />
        </div>
        <p className="auth-card__hint">At least 6 characters, with a capital letter, a lowercase letter, a number and a symbol.</p>
        {error.status ? <p className="auth-card__error" role="alert">{error.message}</p> : null}
        <label className="auth-card__check">
          <input
            type="checkbox"
            name="terms"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            required
            disabled={loading}
          />
          <span>
            I agree to Gigin&apos;s <Link to="/terms-and-conditions" onClick={(e) => e.stopPropagation()}>terms and conditions</Link>
          </span>
        </label>
        <label className="auth-card__check">
          <input
            type="checkbox"
            name="marketingConsent"
            checked={marketingConsent}
            onChange={(e) => setMarketingConsent(e.target.checked)}
            disabled={loading}
          />
          <span>Send me occasional news from Gigin</span>
        </label>
        <button type="submit" className="auth-card__primary" disabled={!canSubmit}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <button type="button" className="auth-card__text" onClick={() => { setRole(''); clearError(); }}>Back</button>
      <p className="auth-card__foot">Already on Gigin? <button type="button" className="auth-card__link" onClick={() => { setAuthType('login'); clearCredentials(); clearError(); }}>Sign in</button></p>
    </AuthCard>
  );
};
