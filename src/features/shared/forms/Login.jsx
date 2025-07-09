// Dependencies
import { useState } from 'react';
// Components
import { SeeIcon, ErrorIcon } from '@features/shared/ui/extras/Icons';
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading';
import { NoTextLogo } from '@features/shared/ui/logos/Logos';
// Styles
import '@styles/forms/forms.styles.css'



export const LoginForm = ({ credentials, setCredentials, error, setError, clearCredentials, clearError, setAuthType, login, setAuthModal, loading, setLoading, authClosable, setAuthClosable }) => {

  const [showPassword, setShowPassword] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpId, setOtpId] = useState(null);
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

  const handleOtpChange = (e) => setOtp(e.target.value);

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

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await verifyOtp(otpId, otp);
      await login(credentials);
      setAuthModal(false);
      window.location.reload();
    } catch (err) {
      setError({ status: true, input: '', message: '* Incorrect verification code. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleResendOtp = async () => {
    setResendingOtp(true);
    setError({ status: false, input: '', message: '' });

    try {
      const newOtpId = await requestOtp(credentials.email);
      setOtpId(newOtpId);
    } catch (err) {
      setError({ status: true, input: '', message: '* Failed to resend verification code. Please try again.' });
    } finally {
      setResendingOtp(false);
    }
  };

  return (
    <div className='modal-padding auth' onClick={(e) => e.stopPropagation()}>
    <div className='modal-content auth'>
      <div className='head'>
        <NoTextLogo />
        <h1>{!otpId ? 'Sign In' : 'Two-Factor Authentication (2FA)'}</h1>
        {otpId && (
          <div className='text'>
            <p>For your security, we have a 2FA process.</p>
            <p>Enter the 6-digit verification code sent to {credentials.email} below.</p>
            <p><strong>Please check your spam/junk folder.</strong></p>
          </div>
        )}
      </div>
      {!otpId ? (
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
            </>
          )}
        </form>
      ) : (
        <form className='auth-form' onSubmit={handleVerifyOtp}>
          <div className='input-group'>
            <input
              type='text'
              id='otp'
              name='otp'
              value={otp}
              onChange={handleOtpChange}
              placeholder='6-digit code'
              required
              maxLength={6}
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
                disabled={loading || error.status || otp.length !== 6}
              >
                Submit
              </button>
              <button
                type='button'
                className='btn text re-send'
                onClick={handleResendOtp}
                disabled={resendingOtp}
              >
                {resendingOtp ? 'Resending...' : "Haven't received a code? Resend verification code"}
              </button>
            </>
          )}
        </form>
      )}
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
