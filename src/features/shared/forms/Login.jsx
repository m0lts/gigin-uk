// Dependencies
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '@lib/firebase';
// Components
import { SeeIcon, ErrorIcon } from '@features/shared/ui/extras/Icons';
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading';
import { NoTextLogo } from '@features/shared/ui/logos/Logos';
// Styles
import '@styles/forms/forms.styles.css'
import { GoogleIcon } from '../ui/extras/Icons';
import { LoadingSpinner } from '../ui/loading/Loading';
import { Link } from 'react-router-dom';



export const LoginForm = ({ credentials, setCredentials, error, setError, clearCredentials, clearError, setAuthType, login, setAuthModal, loading, setLoading, authClosable, setAuthClosable, continueWithGoogle, noProfileModal, setNoProfileModal, user, justLoggedInRef }) => {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [justLoggedIn, setJustLoggedIn] = useState(false);

  // Handle redirect after successful login based on user profile type
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
          navigate('/artist-profile');
          setJustLoggedIn(false);
        } else if (user.venueProfiles && user.venueProfiles.length > 0) {
          navigate('/venues/dashboard/gigs');
          setJustLoggedIn(false);
        } else {
          // User logged in but no profiles - stay on landing page
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

    if (!validateEmail(credentials.email)) {
      setError({ status: true, input: 'email', message: '* Please enter a valid email address' });
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
        navigate('/artist-profile');
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
          setError({ status: true, input: '', message: '*There is no user record corresponding with this identifier. The user may have been deleted.' });
          break;
        case 'auth/user-disabled':
          setError({ status: true, input: '', message: '*The user account has been disabled by an administrator.' });
          break;
        case 'auth/account-exists-with-different-credential':
          setError({ status: true, input: '', message: '*An account already exists with the same email address but different sign-in credentials. Sign in using a different associated email address.' });
          break;
        case 'auth/invalid-credential':
          setError({ status: true, input: '', message: '*Invalid Credentials.' });
          break;
        case 'auth/too-many-requests':
          setError({ status: true, input: '', message: '*Too many unsuccessful login attempts. Please reset your password or try again later.' });
          break;
        default:
          setError({ status: true, input: '', message: err.message });
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
    <div className='modal-padding auth' onClick={(e) => e.stopPropagation()}>
    <div className='modal-content auth scrollable'>
      <div className='head'>
        <NoTextLogo />
        <h1>Welcome Back</h1>
      </div>
        <form className='auth-form' onSubmit={handleLogin}>
          {!loading && (
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
                      navigate('/artist-profile');
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
            </>
          )}
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
          <div className='input-group'>
            <label htmlFor='password'>
              Password <button type='button' className='fp-link btn text' onClick={() => setAuthType('forgot-password')} tabIndex='-1'>Forgot password?</button>
            </label>
            <div className={`password ${passwordFocused ? 'focused' : ''}`}>
              <input
                type={showPassword ? 'text' : 'password'}
                name='password'
                id='password'
                value={credentials.password}
                onChange={(e) => { handleChange(e); clearError(); }}
                placeholder='Password'
                required
                className={`${error.input === 'password' && 'error'}`}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
              <button type='button' className='btn tertiary' onClick={toggleShowPassword}>
                <SeeIcon />
              </button>
            </div>
          </div>
          {error.status && (
            <div className='error-box'>
              <p className='error-msg'>{error.message}</p>
            </div>
          )}
          {loading ? (
            <LoadingSpinner marginTop={'1.2rem'} />
          ) : (
            <>
              <button
                type='submit'
                className='btn primary'
                disabled={error.status || !credentials.email || !credentials.password}
              >
                Sign In
              </button>
            </>
          )}
        </form>
      {(!loading && authClosable) && (
        <button className='btn close tertiary' onClick={() => {if (!authClosable) return; setAuthModal(false)}}>
          Close
        </button>
      )}
    </div>
    <div className="change-auth-type">
        <h4 className='change-auth-type-text'>Don't have an account? </h4>
        <button className='btn text' type='button' disabled={loading} onClick={() => { setAuthType('signup'); clearCredentials(); clearError(); }}>Sign Up</button>
      </div>
    </div>
  );
};
