// Dependencies
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '@lib/firebase';
import { sendSignInLinkToEmail } from 'firebase/auth';
// Components
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading';
import { NoTextLogo } from '@features/shared/ui/logos/Logos';
// Styles
import '@styles/forms/forms.styles.css'
import { GoogleIcon } from '../ui/extras/Icons';
import { LoadingSpinner } from '../ui/loading/Loading';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { FEATURES } from '../../../config/features';
import { artistDestination } from '../../../config/artistDestination';
import { finishSetupPath } from '../../../config/loginDestination';



export const LoginForm = ({ credentials, setCredentials, error, setError, clearCredentials, clearError, setAuthType, login, setAuthModal, loading, setLoading, authClosable, setAuthClosable, continueWithGoogle, noProfileModal, setNoProfileModal, user, justLoggedInRef }) => {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [linkPhase, setLinkPhase] = useState('');
  const [linkWait, setLinkWait] = useState(0);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [justLoggedIn, setJustLoggedIn] = useState(false);

  // Handle redirect after successful login based on user profile type
  useEffect(() => {
    if (!linkWait) return undefined;
    const timer = setTimeout(() => setLinkWait((current) => Math.max(0, current - 1)), 1000);
    return () => clearTimeout(timer);
  }, [linkWait]);

  useEffect(() => {
    if (justLoggedIn && user && !loading) {
      // Close modal immediately if email is verified
      const u = auth.currentUser;
      if (u && u.emailVerified) {
        setAuthModal(false);
      }
      
      // Wait a bit for user data to fully load before redirecting
      const timer = setTimeout(() => {
        if (user.artistProfiles && user.artistProfiles.length > 0) {
          navigate(FEATURES.keepProfile ? '/home' : artistDestination(user, FEATURES));
          setJustLoggedIn(false);
        } else if (user.venueProfiles && user.venueProfiles.length > 0) {
          navigate('/venues/dashboard');
          setJustLoggedIn(false);
        } else {
          navigate(finishSetupPath(user, FEATURES));
          setJustLoggedIn(false);
        }
      }, 500); // Small delay to ensure user data is loaded
      
      return () => clearTimeout(timer);
    }
  }, [user, justLoggedIn, loading, navigate, setAuthModal]);

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
        setAuthClosable(false);
        setAuthType('verify-email');
        return;
      }
      if (loginResponse && loginResponse.redirect === 'create-musician-profile') {
        setAuthModal(false);
        setAuthClosable(true);
        navigate(artistDestination(user, FEATURES));
        return;
      }
      // Set flag to trigger redirect check in useEffect
      setJustLoggedIn(true);
      // Mark that we just logged in to prevent App.jsx from reopening modal
      if (justLoggedInRef) {
        justLoggedInRef.current = true;
      }
      // Don't close modal yet - let useEffect handle redirect and close
    } catch (err) {
      switch (err.error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          setError({ status: true, input: '', message: 'Try again, or reset your password.', title: "That email and password don't match." });
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

  return (
    <div className={`modal-padding auth ${loading ? 'loading' : ''}`} onClick={(e) => e.stopPropagation()}>
    <div className='modal-content auth scrollable'>
      {!loading && linkPhase !== 'sent' && (
        <div className='head'>
          <NoTextLogo />
          <h1>Log in</h1>
          <p>For venues, and artists who&apos;ve kept a Gigin profile.</p>
        </div>
      )}
        {linkPhase === 'sent' && !loading && (
          <div className='auth-form'>
            <h1>Check your email</h1>
            <p>We&apos;ve sent a sign-in link to {credentials.email}. Open it on this device to log in. It works once, for 1 hour.</p>
            <p>Nothing there? Check your spam folder.</p>
            <button
              type='button'
              className='btn text'
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
              {linkWait > 0 ? `Send again in ${linkWait}s` : 'Send it again'}
            </button>
            <button type='button' className='btn text' onClick={() => { setLinkPhase(''); clearCredentials(); }}>Use a different email</button>
            <button type='button' className='btn text' onClick={() => setLinkPhase('')}>Back to log in</button>
          </div>
        )}
        <form className='auth-form' onSubmit={handleLogin} noValidate hidden={linkPhase === 'sent'}>
          {!loading && linkPhase !== 'sent' && (
            <>
              <button
                type="button"
                className="btn secondary google"
                disabled={loading}
                onClick={async () => {
                  try {
                    setLoading(true);
                    const loginResponse = await continueWithGoogle();
                    if (loginResponse && loginResponse.redirect === 'create-musician-profile') {
                      setAuthModal(false);
                      setAuthClosable(true);
                      navigate(artistDestination(user, FEATURES));
                    } else {
                      setJustLoggedIn(true);
                      // Mark that we just logged in to prevent App.jsx from reopening modal
                      if (justLoggedInRef) {
                        justLoggedInRef.current = true;
                      }
                      // Redirect will be handled by useEffect
                    }
                  } catch (err) {
                    setError({ status: true, input: '', message: err?.error?.message || 'Google sign in failed' });
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <GoogleIcon />
                Continue With Google
              </button>
              <div className="disclaimer">
                <p>By continuing with Google, you agree to our <Link className='tc-link' to={'/terms-and-conditions'}>terms and conditions.</Link></p>
              </div>
              <div className="oauth-divider">
                <span className="line" />
                <h6>OR</h6>
                <span className="line" />
              </div>
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
              <div className='input-group'>
                <label htmlFor='password'>
                  Password <button type='button' className='fp-link btn text' onClick={() => { clearError(); setAuthType('forgot-password'); }} tabIndex='-1'>Forgot password?</button>
                </label>
                <div className={`password ${passwordFocused ? 'focused' : ''} ${loading ? 'disabled' : ''}`}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name='password'
                    id='password'
                    value={credentials.password}
                    onChange={(e) => { handleChange(e); clearError(); }}
                    placeholder='Password'
                    disabled={loading}
                    className={`${error.input === 'password' && 'error'}`}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />
                  <button type='button' className='btn tertiary' aria-pressed={showPassword} onClick={toggleShowPassword}>
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            </>
          )}
          {error.status && (
            <div className='error-box' role='alert'>
              <p className='error-msg'>{error.title ? <strong>{error.title} </strong> : null}{error.message}</p>
            </div>
          )}
          {loading ? (
            <LoadingSpinner />
          ) : (
            <>
              <button
                type='submit'
                className='btn primary'
                disabled={loading}
              >
                {loading ? 'Logging in…' : 'Log in'}
              </button>
              <button
                type='button'
                className='btn text'
                onClick={async () => {
                  const address = String(credentials.email || '').trim();
                  if (!address) {
                    setError({ status: true, input: 'email', message: "Enter your email first, and we'll send the link there." });
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
                  } catch (err) {
                    if (err?.code !== 'auth/user-not-found') {
                      /* same answer either way */
                    }
                  }
                  window.localStorage.setItem('emailForSignIn', address);
                  setLinkPhase('sent');
                  setLinkWait(30);
                }}
              >
                Email me a sign-in link instead
              </button>
              <p>Applied to a gig as a guest? You don&apos;t need to log in. Use the private link in your email, or <a href='/#artists'>get a fresh link</a>.</p>
            </>
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
        <h4 className='change-auth-type-text'>Don't have an account? </h4>
        <button className='btn text' type='button' disabled={loading} onClick={() => { setAuthType('signup'); clearCredentials(); clearError(); }}>Sign Up</button>
    </div>
    )}
    </div>
  );
};
