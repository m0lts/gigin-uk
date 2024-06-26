// Dependencies
import { useState } from 'react';
import { Link } from 'react-router-dom';
// Components
import { NoTextLogo } from "/ui/logos/Logos";
import { SeeIcon, CloseIcon } from "/components/ui/Extras/Icons";
import { LoadingThreeDots } from '../ui/loading/Loading';
// Styles
import '/styles/forms/forms.styles.css'



export const LoginForm = ({ credentials, setCredentials, error, setError, clearCredentials, clearError, setAuthType, login, setAuthModal, loading, setLoading, requestOtp, verifyOtp, checkCredentials }) => {

  const [showPassword, setShowPassword] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpId, setOtpId] = useState(null);

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
      const response = await checkCredentials(credentials);
      const otpId = await requestOtp(response.email, response.name);
      setOtpId(otpId);
    } catch (err) {
      setError({ status: true, input: '', message: '* Invalid credentials. Please try again.' });
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
    <div className="modal-content auth" onClick={(e) => e.stopPropagation()}>
      <div className="head">
        <NoTextLogo />
        <h2>{!otpId ? 'Login' : 'Two-Factor Authentication (2FA)'}</h2>
        {otpId && (
          <div className="text">
            <p>For your security, we have a 2FA process.</p>
            <p>Enter the 6-digit verification code sent to {credentials.email} below.</p>
            <p><strong>Please check your spam/junk folder.</strong></p>
          </div>
        )}
      </div>
      {!otpId ? (
        <form className="auth-form" onSubmit={handleLogin}>
          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input
              type="text"
              name="email"
              value={credentials.email}
              onChange={(e) => { handleChange(e); clearError(); }}
              placeholder="e.g. johnsmith@gigin.com"
              required
              className={`${error.input === 'email' && 'error'}`}
            />
          </div>
          <div className="input-group">
            <label htmlFor="password">
              Password <Link className="fp-link" to={'/'}>Forgot password?</Link>
            </label>
            <div className="password">
              <input
                type={showPassword ? "text" : "password"}
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
          </div>
          {error.status && (
            <div className="error-box">
              <p className="error-msg">{error.message}</p>
            </div>
          )}
          {loading ? (
            <LoadingThreeDots />
          ) : (
            <>
              <button
                type="submit"
                className="btn primary"
                disabled={error.status || !credentials.email || !credentials.password}
              >
                Login
              </button>
              <div className="change-auth-type">
                <p>Want to join the movement? <button className="btn text" type='button' onClick={() => { setAuthType('signup'); clearCredentials(); clearError(); }}>Sign up here</button></p>
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
              onChange={handleOtpChange}
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
            <>
              <button
                type="submit"
                className="btn primary"
                disabled={loading || error.status || otp.length !== 6}
              >
                Submit
              </button>
              <button
                type="button"
                className="btn text re-send"
                onClick={handleResendOtp}
                disabled={resendingOtp}
              >
                {resendingOtp ? 'Resending...' : "Haven't received a code? Resend verification code"}
              </button>
            </>
          )}
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
