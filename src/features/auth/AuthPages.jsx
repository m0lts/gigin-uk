import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import '@styles/artists/keep-profile.styles.css';
import { auth } from '@lib/firebase';
import {
  confirmPasswordReset,
  isSignInWithEmailLink,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  verifyPasswordResetCode,
} from 'firebase/auth';
import { passwordStrength, passwordSubmitError } from '../keep-profile/passwordStrength';
import { httpClient } from '@services/http/client';

function Shell({ children }) {
  return (
    <div className="kp">
      <header className="kp-top"><Link className="kp-logo" to="/">gigin.</Link></header>
      <div className="kp-wrap">{children}</div>
    </div>
  );
}

function Strength({ value }) {
  const hint = passwordStrength(value);
  return (
    <div className={`kp-strength is-${hint.tone || 'empty'}`}>
      <span>{[0, 1, 2, 3].map((bar) => <i key={bar} className={bar < hint.level ? 'is-on' : ''} />)}</span>
      <p>{hint.title ? <strong>{hint.title} </strong> : null}{hint.body}</p>
    </div>
  );
}

function PasswordField({ value, onChange, label = 'New password' }) {
  const [shown, setShown] = useState(false);
  return (
    <label className="kp-field">
      {label}
      <span className="kp-password">
        <input type={shown ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} autoComplete="new-password" />
        <button type="button" aria-pressed={shown} onClick={() => setShown((current) => !current)}>{shown ? 'Hide' : 'Show'}</button>
      </span>
    </label>
  );
}

export function AuthActionPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  useEffect(() => {
    const mode = params.get('mode');
    const oobCode = params.get('oobCode') || '';
    if (mode === 'resetPassword') navigate(`/auth/reset?oobCode=${encodeURIComponent(oobCode)}`, { replace: true });
    else if (mode === 'signIn') navigate(`/auth/email-link?${params.toString()}`, { replace: true });
    else navigate('/', { replace: true });
  }, [navigate, params]);
  return <Shell><p>Opening your link…</p></Shell>;
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const oobCode = params.get('oobCode') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phase, setPhase] = useState('checking');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resend, setResend] = useState('');

  useEffect(() => {
    if (!oobCode) {
      setPhase('expired');
      return undefined;
    }
    verifyPasswordResetCode(auth, oobCode).then((address) => {
      setEmail(address);
      setPhase('choose');
    }).catch(() => setPhase('expired'));
    return undefined;
  }, [oobCode]);

  const save = async (event) => {
    event.preventDefault();
    const problem = passwordSubmitError(password);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await confirmPasswordReset(auth, oobCode, password);
      await signInWithEmailAndPassword(auth, email, password);
      setPhase('changed');
    } catch (err) {
      const code = err?.code || '';
      if (code === 'auth/expired-action-code' || code === 'auth/invalid-action-code') setPhase('expired');
      else if (code === 'auth/weak-password') setError('Choose a less common password.');
      else setError('Choose a less common password.');
    } finally {
      setBusy(false);
    }
  };

  const sendAgain = async (event) => {
    event.preventDefault();
    await httpClient.post('/auth/password-reset', { auth: false, body: { email: resend || email } });
    setPhase('sent');
  };

  if (phase === 'checking') return <Shell><p>Opening your link…</p></Shell>;
  if (phase === 'sent') {
    return (
      <Shell>
        <h1>Check your email</h1>
        <p>If {resend || email} has a Gigin account, we&apos;ve sent a link to choose a new password. It works once, for 1 hour.</p>
      </Shell>
    );
  }
  if (phase === 'changed') {
    return (
      <Shell>
        <h1>Password changed</h1>
        <p>You&apos;re logged in as {email}. Use your new password next time.</p>
        <Link className="kp-btn" to="/home">Go to my Gigin home</Link>
      </Shell>
    );
  }
  if (phase === 'expired') {
    return (
      <Shell>
        <h1>This reset link has expired</h1>
        <p>Reset links work once, for 1 hour. Send yourself a new one.</p>
        <form onSubmit={sendAgain}>
          <label className="kp-field">Email<input type="email" value={resend || email} onChange={(event) => setResend(event.target.value)} /></label>
          <button type="submit" className="kp-btn">Email me a new link</button>
        </form>
      </Shell>
    );
  }
  return (
    <Shell>
      <h1>Choose a new password</h1>
      <p>For {email}.</p>
      <form onSubmit={save}>
        <PasswordField value={password} onChange={setPassword} />
        <Strength value={password} />
        {error ? <p className="kp-error">{error}</p> : null}
        <button type="submit" className="kp-btn" disabled={busy}>{busy ? 'Saving…' : 'Save and log in'}</button>
      </form>
    </Shell>
  );
}

export function EmailLinkPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState(() => window.localStorage.getItem('emailForSignIn') || '');
  const [needEmail, setNeedEmail] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const href = window.location.href;
    if (!isSignInWithEmailLink(auth, href)) {
      setError('This link has stopped working.');
      return undefined;
    }
    const stored = window.localStorage.getItem('emailForSignIn') || '';
    if (!stored) {
      setNeedEmail(true);
      return undefined;
    }
    signInWithEmailLink(auth, stored, href).then(() => {
      window.localStorage.removeItem('emailForSignIn');
      navigate('/home', { replace: true });
    }).catch(() => setError('This link has stopped working.'));
    return undefined;
  }, [navigate, params]);

  const finish = async (event) => {
    event.preventDefault();
    try {
      await signInWithEmailLink(auth, email.trim(), window.location.href);
      window.localStorage.setItem('emailForSignIn', email.trim());
      window.localStorage.removeItem('emailForSignIn');
      navigate('/home', { replace: true });
    } catch {
      setError('This link has stopped working.');
    }
  };

  return (
    <Shell>
      <h1>Log in</h1>
      {needEmail ? (
        <form onSubmit={finish}>
          <p>Open the link on this device, or enter the email we sent it to.</p>
          <label className="kp-field">Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <button type="submit" className="kp-btn">Log in</button>
        </form>
      ) : <p>{error || 'Logging in…'}</p>}
    </Shell>
  );
}
