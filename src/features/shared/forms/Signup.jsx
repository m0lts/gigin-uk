// Dependencies
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import { toast } from 'sonner';
import { getPhoneExistsBoolean } from '@services/api/users';
// Components
import { AuthCard } from './AuthCard';
import { GoogleIcon, SeeIcon, QuestionCircleIcon } from '@icons';
import { LoadingSpinner } from '../ui/loading/Loading';
import { PhoneField, isValidE164 } from './PhoneField';
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
  const [showPasswordInfo, setShowPasswordInfo] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [role, setRole] = useState('');

  const handleFocus = () => {
    setPasswordFocused(true);
  };

  const handleBlur = () => {
    setPasswordFocused(false);
  };

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
          setShowPasswordInfo(true);
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

  const togglePasswordInfo = () => {
    setShowPasswordInfo(!showPasswordInfo);
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

  return (
    <div className={`modal-padding auth ${loading ? 'loading' : ''}`} onClick={(e) => e.stopPropagation()}>
      <div className='modal-content auth scrollable'>
        {!loading && (
        <div className='head'>
          <h1>{role === 'artist' ? 'Your artist account' : 'Your venue account'}</h1>
          <p>Create the account, then we&apos;ll take you through the rest.</p>
        </div>
        )}
        <form className='auth-form' onSubmit={handleSignup}>
          {!loading && (
            <>
              <button
                type="button"
                className="btn secondary google"
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
                <GoogleIcon />
                Continue With Google
              </button>
              <div className="disclaimer">
                <p>By signing up with Google, you agree to our <Link className='tc-link' to={'/terms-and-conditions'}>terms and conditions.</Link></p>
              </div>
              <div className="oauth-divider">
                <span className="line" />
                <h6>OR</h6>
                <span className="line" />
              </div>
              <div className='input-group'>
                <label htmlFor='name'>Name</label>
                <input
                  type='text'
                  id='name'
                  name='name'
                  value={credentials.name}
                  onChange={(e) => { handleChange(e); clearError(); }}
                  placeholder='Your Name'
                  className={`input ${loading ? 'disabled' : ''}`}
                  required
                  disabled={loading}
                />
              </div>
              <div className='input-group'>
                <label htmlFor='email'>Email</label>
                <input
                  type='text'
                  id='email'
                  name='email'
                  value={credentials.email}
                  onChange={(e) => { handleChange(e); clearError(); }}
                  placeholder='e.g. johnsmith@gigin.com'
                  required
                  className={`${error.input.includes('email') && 'error'} ${loading ? 'disabled' : ''}`}
                  disabled={loading}
                />
              </div>
              {/* <div className="input-group">
                <PhoneField
                  initialCountry="GB"
                  value={credentials.phoneNumber}
                  disabled={loading}
                  onChange={(e164) => {
                    setCredentials(prev => ({ ...prev, phoneNumber: e164 }));
                    if (error.input === 'phoneNumber') clearError();
                  }}
                  error={error}
                  loading={loading}
                />
                {(error.input.includes('phoneNumber') && error.message !== '*Phone number already in use.') && (
                  <p className="error-msg">* Please enter a valid phone number</p>
                )}
              </div> */}
              <div className='input-group'>
                <label htmlFor='password'>
                  Password
                  <button className='btn text' type='button' onClick={togglePasswordInfo}>
                    <QuestionCircleIcon />
                  </button>
                </label>
                <div className={`password ${passwordFocused ? 'focused' : ''} ${loading ? 'disabled' : ''}`}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name='password'
                      id='password'
                      value={credentials.password}
                      onChange={(e) => { handleChange(e); clearError(); setShowPasswordInfo(false) }}
                      placeholder='Password'
                      required
                      className={`${error.input === 'password' && 'error'} ${loading ? 'disabled' : ''}`}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      disabled={loading}
                    />
                    <button type='button' className='btn tertiary' onClick={toggleShowPassword}>
                      <SeeIcon />
                    </button>
                  </div>
                {showPasswordInfo && <p className='password-info'>
                  Password must be at least 6 characters long, include an uppercase character, a lowercase character, a number, and a special character.
                </p>}
              </div>
            </>
          )}
          {error.status && (
            <div className='error-box'>
              <p className='error-msg'>{error.message}</p>
            </div>
          )}
          {!loading && (
          <div className='tick-boxes'>
            <div className='input-group'>
              <label>
                <input
                  type='checkbox'
                  name='terms'
                  style={{ marginRight: 5 }}
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  required
                  disabled={loading}
                />
                <span>
                  I accept Gigin's{' '}
                  <Link className="tc-link" to="/terms-and-conditions" onClick={(e) => e.stopPropagation()}>
                    terms and conditions
                  </Link>.
                </span>
              </label>
            </div>
            <div className='input-group'>
              <label>
                <input
                  type='checkbox'
                  name='marketingConsent'
                  style={{ marginRight: 5 }}
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  disabled={loading}
                />
                <span>I consent to receive marketing communications from Gigin.</span>
              </label>
            </div>
          </div>
          )}
          {loading ? (
            <LoadingSpinner />
          ) : (
              <button
                type='submit'
                className='btn primary'
                disabled={error.status || !credentials.name || !credentials.email || !credentials.password || !termsAccepted}
              >
                Sign Up
              </button>
          )}
        </form>
        {(!loading && authClosable) && (
          <button className='btn close tertiary' onClick={() => {if (!authClosable) return; setAuthModal(false)}}>
            Close
          </button>
        )}
      </div>
      {!loading && (
      <div className="change-auth-type">
        <h4 className='change-auth-type-text'>Already have an account? </h4>
        <button className='btn text' type='button' disabled={loading} onClick={() => { setAuthType('login'); clearCredentials(); clearError(); }}>Sign in</button>
      </div>
      )}
    </div>
  );
};
