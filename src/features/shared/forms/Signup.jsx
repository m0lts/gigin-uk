// Dependencies
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
// Components
import { NoTextLogo } from '@features/shared/ui/logos/Logos';
import { SeeIcon, QuestionCircleIcon, ErrorIcon } from '@features/shared/ui/extras/Icons';
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading';
// Styles
import '@styles/forms/forms.styles.css';

export const SignupForm = ({ credentials, setCredentials, error, setError, clearCredentials, clearError, setAuthType, setAuthModal, loading, setLoading, authClosable, setAuthClosable }) => {

  const { signup } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordInfo, setShowPasswordInfo] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
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
    const cleanedValue = name === 'phoneNumber' ? value.replace(/\s+/g, '') : value;
    setCredentials((prev) => ({ ...prev, [name]: cleanedValue }));
  };

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // const validatePhoneNumber = (phoneNumber) => /^[0-9]{10,15}$/.test(phoneNumber);

  const validatePassword = (password) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(password);

  const handleSignup = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!validateEmail(credentials.email)) {
      setError({ status: true, input: 'email', message: '* Please enter a valid email address' });
      return;
    }

    // if (!validatePhoneNumber(credentials.phoneNumber)) {
    //   setError({ status: true, input: 'phoneNumber', message: '* Please enter a valid phone number' });
    //   return;
    // }

    if (!validatePassword(credentials.password)) {
      setShowPasswordInfo(true);
      return;
    }

    if (!termsAccepted) {
      setError({ status: true, input: 'terms', message: '* You must accept the terms and conditions' });
      return;
    }

    setError({ status: false, input: '', message: '' });
    setLoading(true);

    try {
      await signup(credentials, marketingConsent);
      setAuthModal(false);
      setAuthClosable(true);
    } catch (err) {
      switch (err.error.code) {
        case 'auth/email-already-in-use':
          setError({ status: true, input: 'email', message: '* Email already in use.' });
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

  const togglePasswordInfo = () => {
    setShowPasswordInfo(!showPasswordInfo);
  };

  return (
    <div className="modal-padding auth" onClick={(e) => e.stopPropagation()}>
      <div className='modal-content auth'>
        <div className='head'>
          <NoTextLogo />
          <h1>Welcome to Gigin</h1>
          <p>Sign up to create your account. You can then build a venue or musician profile.</p>
        </div>
        <form className='auth-form' onSubmit={handleSignup}>
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
          {/* <div className='input-group'>
            <label htmlFor='phoneNumber'>Phone Number</label>
            <input
              type='text'
              id='phoneNumber'
              name='phoneNumber'
              value={credentials.phoneNumber}
              onChange={(e) => { handleChange(e); clearError(); }}
              placeholder='e.g. 07362 876514'
              required
              className={`${error.input.includes('phoneNumber') && 'error'}`}
            />
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
                  onChange={(e) => { handleChange(e); clearError(); }}
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
              Password must be at least 8 characters long, include an uppercase letter, a lowercase letter, a number, and a special character.
            </p>}
          </div>
          {error.status && (
            <div className='error-box'>
              <p className='error-msg'>{error.message}</p>
            </div>
          )}
          <div className='tick-boxes'>
            <div className='input-group'>
              <input
                type='checkbox'
                id='terms'
                name='terms'
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                required
                disabled={loading}
              />
              <label htmlFor='terms'>I accept Gigin's <Link className='tc-link' to={'/'}>terms and conditions</Link>.</label>
            </div>
            <div className='input-group'>
              <input
                type='checkbox'
                id='marketingConsent'
                name='marketingConsent'
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
                disabled={loading}
              />
              <label htmlFor='marketingConsent'>I consent to receive marketing communications from Gigin.</label>
            </div>
          </div>
          {loading ? (
            <LoadingThreeDots />
          ) : (
            <>
              <button
                type='submit'
                className='btn primary'
                disabled={error.status || !credentials.name || !credentials.email || !credentials.password || !termsAccepted}
              >
                Sign Up
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
        <h4 className='change-auth-type-text'>Already have an account? </h4>
        <button className='btn text' type='button' disabled={loading} onClick={() => { setAuthType('login'); clearCredentials(); clearError(); }}>Login</button>
      </div>
    </div>
  );
};
