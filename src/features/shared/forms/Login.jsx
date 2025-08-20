// Dependencies
import { useState } from 'react';
// Components
import { SeeIcon, ErrorIcon } from '@features/shared/ui/extras/Icons';
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading';
import { NoTextLogo } from '@features/shared/ui/logos/Logos';
// Styles
import '@styles/forms/forms.styles.css'
import { GoogleIcon } from '../ui/extras/Icons';



export const LoginForm = ({ credentials, setCredentials, error, setError, clearCredentials, clearError, setAuthType, login, setAuthModal, loading, setLoading, authClosable, setAuthClosable, loginWithGoogle }) => {

  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

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
      await login(credentials);
      setAuthModal(false);
      setAuthClosable(true);
    } catch (err) {
      switch (err.error.code) {
        case 'auth/invalid-credential':
          setError({ status: true, input: '', message: '* Invalid Credentials.' });
          break;
        case 'auth/too-many-requests':
          setError({ status: true, input: '', message: '* Too many unsuccessful login attempts. Please reset your password or try again later.' });
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
    <div className='modal-content auth'>
      <div className='head'>
        <NoTextLogo />
        <h1>Sign In</h1>
      </div>
        <form className='auth-form' onSubmit={handleLogin}>
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
            <LoadingThreeDots />
          ) : (
            <>
              <button
                type='submit'
                className='btn primary'
                disabled={error.status || !credentials.email || !credentials.password}
              >
                Sign In
              </button>
              <div className="oauth-divider">
                <span className="line" />
                <h6>OR</h6>
                <span className="line" />
              </div>
              <button
                type="button"
                className="btn secondary google"
                disabled={loading}
                onClick={async () => {
                  try {
                    setLoading(true);
                    await loginWithGoogle();
                    setAuthModal(false);
                    setAuthClosable(true);
                  } catch (err) {
                    setError({ status: true, input: '', message: err?.error?.message || 'Google sign in failed' });
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <GoogleIcon />
                Sign In with Google
              </button>
            </>
          )}
        </form>
      {(!loading && authClosable) && (
        <button className='btn close tertiary' onClick={() => {if (!authClosable) return; setAuthModal(false)}}>
          <ErrorIcon />
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
