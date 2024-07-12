// Dependencies
import { useState } from 'react';
import { Link } from 'react-router-dom';
// Components
import { NoTextLogo } from "/ui/logos/Logos";
import { SeeIcon, CloseIcon } from "/components/ui/Extras/Icons";
import { LoadingThreeDots } from '../ui/loading/Loading';
// Styles
import '/styles/forms/forms.styles.css'



export const ForgotPasswordForm = ({ credentials, setCredentials, error, setError, clearCredentials, clearError, setAuthType, resetPassword, setAuthModal, loading, setLoading, }) => {

  const handleChange = (e) => {
    if (loading) return;
    const { name, value } = e.target;
    setCredentials((prev) => ({ ...prev, [name]: value }));
  };

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!validateEmail(credentials.email)) {
      setError({ status: true, input: 'email', message: '* Please enter a valid email address' });
      return;
    }

    setError({ status: false, input: '', message: '' });
    setLoading(true);

    try {
      await resetPassword(credentials.email);
      setAuthModal(false);
    } catch (err) {
      setError({ status: true, input: 'email', message: '* No accounts associated with that email address.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-content auth" onClick={(e) => e.stopPropagation()}>
      <div className="head">
        <NoTextLogo />
        <h2>Forgot Password</h2>
      </div>
        <form className="auth-form" onSubmit={handlePasswordReset}>
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
                disabled={error.status || !credentials.email}
              >
                Send Link
              </button>
              <div className="change-auth-type">
                <p>Back to <button className="btn text" type='button' onClick={() => { setAuthType('login'); clearCredentials(); clearError(); }}>Login</button></p>
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