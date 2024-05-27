// Dependencies
import { useState } from 'react';
import { Link } from 'react-router-dom';
// Components
import { NoTextLogo } from "../ui/logos/Logos";
import { SeeIcon, QuestionCircleIcon, CloseIcon } from "../ui/Icons/Icons";
import { LoadingThreeDots } from '../ui/Loading/Loading';
// Styles
import '/styles/forms/forms.styles.css'


export const SignupForm = ({ credentials, setCredentials, error, setError, clearCredentials, clearError, setAuthType, signup, setAuthModal, loading, setLoading, requestOtp, verifyOtp, checkUser }) => {

  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordInfo, setShowPasswordInfo] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpId, setOtpId] = useState(null);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  const handleChange = (e) => {
    if (loading) return;
    const { name, value } = e.target;
    const cleanedValue = name === 'phoneNumber' ? value.replace(/\s+/g, '') : value;
    setCredentials((prev) => ({ ...prev, [name]: cleanedValue }));
  };

  const handleOtpChange = (e) => setOtp(e.target.value);

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validatePhoneNumber = (phoneNumber) => /^[0-9]{10,15}$/.test(phoneNumber);

  const validatePassword = (password) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(password);

  const handleSignup = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!validateEmail(credentials.email)) {
      setError({ status: true, input: 'email', message: '* Please enter a valid email address' });
      return;
    }

    if (!validatePhoneNumber(credentials.phoneNumber)) {
      setError({ status: true, input: 'phoneNumber', message: '* Please enter a valid phone number' });
      return;
    }

    if (!validatePassword(credentials.password)) {
      setError({ status: true, input: 'password', message: '* Please enter a secure password.' });
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
      await checkUser(credentials.email, credentials.phoneNumber);
      const otpId = await requestOtp(credentials.email, credentials.name);
      setOtpId(otpId);
    } catch (err) {
      setError({ status: true, input: 'email, phoneNumber', message: err.message });
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

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await verifyOtp(otpId, otp);
      await signup({...credentials, marketingConsent });
      setAuthModal(false);
    } catch (err) {
      setError({ status: true, input: '', message: err.message });
    } finally {
      setLoading(false);
    }
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
    <div className="modal-content auth" onClick={(e) => e.stopPropagation()}>
      <div className="head">
        <NoTextLogo />
        <h2>{!otpId ? 'Signup' : 'Two-Factor Authentication (2FA)'}</h2>
        {otpId && (
          <div className="text">
            <p>For your security, we have a 2FA process.</p>
            <p>Enter the 6-digit verification code sent to {credentials.email} below.</p>
            <p><strong>Please check your spam/junk folder.</strong></p>
          </div>
        )}
      </div>
      {!otpId ? (
        <form className="auth-form" onSubmit={handleSignup}>
          <div className="input-group">
            <label htmlFor="name">Name</label>
            <input
              type="text"
              id='name'
              name="name"
              value={credentials.name}
              onChange={(e) => { handleChange(e); clearError(); }}
              placeholder="Your Name"
              required
            />
          </div>
          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input
              type="text"
              id="email"
              name="email"
              value={credentials.email}
              onChange={(e) => { handleChange(e); clearError(); }}
              placeholder="e.g. johnsmith@gigin.com"
              required
              className={`${error.input.includes('email') && 'error'}`}
            />
          </div>
          <div className="input-group">
            <label htmlFor="phoneNumber">Phone Number</label>
            <input
              type="text"
              id="phoneNumber"
              name="phoneNumber"
              value={credentials.phoneNumber}
              onChange={(e) => { handleChange(e); clearError(); }}
              placeholder="e.g. 07362 876514"
              required
              className={`${error.input.includes('phoneNumber') && 'error'}`}
            />
          </div>
          <div className="input-group">
            <label htmlFor="password">
              Password
              <button className="btn text" type="button" onClick={togglePasswordInfo}>
                <QuestionCircleIcon />
              </button>
            </label>
            <div className="password">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={credentials.password}
                onChange={(e) => { handleChange(e); clearError(); }}
                placeholder="Password"
                required
                className={`${error.input === 'password' && 'error'}`}
              />
              <button type="button" className="btn tertiary" onClick={toggleShowPassword}>
                <SeeIcon />
              </button>
            </div>
            {showPasswordInfo && <p className="password-info">
              <QuestionCircleIcon /> Password must be at least 8 characters long, include an uppercase letter, a lowercase letter, a number, and a special character.
            </p>}
          </div>
          {error.status && (
            <div className="error-box">
              <p className="error-msg">{error.message}</p>
            </div>
          )}
          <div className="tick-boxes">
            <div className="input-group">
              <input
                type="checkbox"
                id="terms"
                name="terms"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                required
              />
              <label htmlFor="terms">I accept Gigin's <Link className='tc-link' to={'/'}>terms and conditions</Link>.</label>
            </div>
            <div className="input-group">
              <input
                type="checkbox"
                id="marketingConsent"
                name="marketingConsent"
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
              />
              <label htmlFor="marketingConsent">I consent to receive marketing communications from Gigin.</label>
            </div>
          </div>
          {loading ? (
            <LoadingThreeDots />
          ) : (
            <>
              <button
                type="submit"
                className="btn primary"
                disabled={error.status || !credentials.name || !credentials.email || !credentials.phoneNumber || !credentials.password || !termsAccepted}
              >
                Sign Up
              </button>
              <div className="change-auth-type">
                  <p>Already a member? <button className="btn text" type='button' onClick={() => { setAuthType('login'); clearCredentials(); clearError(); }}>Login</button></p>
              </div>
            </>
          )}
        </form>
      ) : (
        <form className="auth-form" onSubmit={handleVerifyOtp}>
          <div className="input-group">
            <input
              type="text"
              id="otp"
              name="otp"
              value={otp}
              onChange={(e) => {handleOtpChange(e); clearError()}}
              placeholder="6-digit code"
              required
              maxLength={6}
            />
          </div>
          {error.status && (
            <div className="error-box">
              <p className="error-msg">{error.message}</p>
            </div>
          )}
          {loading ? (
            <LoadingThreeDots />
          ) : (
            <button
              type="submit"
              className="btn primary"
              disabled={loading || error.status || otp.length !== 6}
            >
              Submit
            </button>
          )}
          <button
            type="button"
            className="btn text re-send"
            onClick={handleResendOtp}
            disabled={resendingOtp}
          >
            {resendingOtp ? 'Resending...' : "Haven't received a code? Resend verification code"}
          </button>
        </form>
      )}
      {!loading && (
        <button className="btn close tertiary" onClick={() => setAuthModal(false)}>
          <CloseIcon />
        </button>
      )}
    </div>
  );
};
