// Dependencies
import { useState } from 'react';
import { Link } from 'react-router-dom';
// Components
import { NoTextLogo } from "/ui/logos/Logos";
import { SeeIcon, CloseIcon } from "/ui/icons/Icons";
import { LoadingThreeDots } from '/ui/loading/Loading';
// Styles
import '/styles/forms/forms.styles.css'



export const LoginForm = ({ credentials, setCredentials, error, setError, clearCredentials, clearError, setAuthType, login, setAuthModal, loading, setLoading }) => {

  const [showPassword, setShowPassword] = useState(false);

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
    } catch (err) {
      setError({ status: true, input: '', message: 'Login failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="modal-content auth" onClick={(e) => e.stopPropagation()}>
      <div className="head">
        <NoTextLogo />
        <h2>Login</h2>
      </div>
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
      {!loading && (
        <button className="btn close tertiary" onClick={() => setAuthModal(false)}>
          <CloseIcon />
        </button>
      )}
    </div>
  );
};
