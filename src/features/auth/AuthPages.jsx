import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import '@styles/forms/auth-card.css';
import { AuthCard, EyeButton, isGmail } from '../shared/forms/AuthCard';
import { auth } from '@lib/firebase';
import {
  confirmPasswordReset,
  isSignInWithEmailLink,
  signInWithEmailAndPassword,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  verifyPasswordResetCode,
} from 'firebase/auth';
import { passwordSubmitError } from '../keep-profile/passwordStrength';
import { httpClient } from '@services/http/client';

function Shell({ children }) {
  return (
    <div className="auth-page">
      <Link className="auth-page__mark" to="/">gigin<b>.</b></Link>
      {children}
    </div>
  );
}

function PasswordField({ value, onChange, label = 'New password', placeholder = 'At least 8 characters' }) {
  const [shown, setShown] = useState(false);
  return (
    <div>
      <label htmlFor="new-password">{label}</label>
      <div className="auth-card__password">
        <input id="new-password" type={shown ? 'text' : 'password'} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} autoComplete="new-password" />
        <EyeButton shown={shown} onClick={() => setShown((current) => !current)} />
      </div>
    </div>
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

  if (phase === 'checking') return <Shell><AuthCard title="Opening your link…" closable={false} /></Shell>;
  if (phase === 'sent') {
    const address = resend || email;
    return (
      <Shell>
        <AuthCard title="Check your email" icon="mail" closable={false} lede={<>We sent a link to reset your password to <strong>{address}</strong>. It works once, for 1 hour.</>}>
          {isGmail(address) ? <a className="auth-card__primary" href="https://mail.google.com" target="_blank" rel="noreferrer">Open Gmail</a> : null}
        </AuthCard>
      </Shell>
    );
  }
  if (phase === 'changed') {
    return (
      <Shell>
        <AuthCard title="Password saved" icon="good" closable={false} lede="You're signed in. Next time, use your email and new password.">
          <Link className="auth-card__primary" to="/home">Go to my Gigin home</Link>
        </AuthCard>
      </Shell>
    );
  }
  if (phase === 'expired') {
    return (
      <Shell>
        <AuthCard title="This link has expired" icon="error" closable={false} lede="Links work once, for 1 hour, to keep your account safe.">
          <form onSubmit={sendAgain}>
            <label htmlFor="resend-email">Email</label>
            <input id="resend-email" type="email" value={resend || email} onChange={(event) => setResend(event.target.value)} />
            <button type="submit" className="auth-card__primary">Email me a new link</button>
          </form>
          <Link className="auth-card__text" to="/">Back to sign in</Link>
        </AuthCard>
      </Shell>
    );
  }
  return (
    <Shell>
      <AuthCard title="Choose a new password" closable={false} lede={email ? `For ${email}.` : ''}>
        <form onSubmit={save}>
          <PasswordField value={password} onChange={setPassword} />
          <p className="auth-card__note">Use 8 or more characters. A short phrase is easier to remember.</p>
          {error ? <p className="auth-card__error">{error}</p> : null}
          <button type="submit" className="auth-card__primary" disabled={busy}>{busy ? 'Saving…' : 'Save and sign in'}</button>
        </form>
      </AuthCard>
    </Shell>
  );
}

export function EmailLinkPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState(() => window.localStorage.getItem('emailForSignIn') || '');
  const [needEmail, setNeedEmail] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

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

  const sendNew = async (event) => {
    event.preventDefault();
    const address = email.trim();
    if (!address) return;
    try {
      await sendSignInLinkToEmail(auth, address, {
        url: `${window.location.origin}/auth/email-link`,
        handleCodeInApp: true,
      });
      window.localStorage.setItem('emailForSignIn', address);
      setSent(true);
    } catch { /* same answer either way */ }
  };

  if (sent) {
    return (
      <Shell>
        <AuthCard title="Check your email" icon="mail" closable={false} lede={<>We sent a sign-in link to <strong>{email}</strong>. It works once, for 1 hour.</>} />
      </Shell>
    );
  }
  if (error) {
    return (
      <Shell>
        <AuthCard title="This link has expired" icon="error" closable={false} lede="Links work once, for 1 hour, to keep your account safe.">
          <form onSubmit={sendNew}>
            <label htmlFor="link-email">Email</label>
            <input id="link-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            <button type="submit" className="auth-card__primary">Email me a new link</button>
          </form>
          <Link className="auth-card__text" to="/">Back to sign in</Link>
        </AuthCard>
      </Shell>
    );
  }
  return (
    <Shell>
      <AuthCard title="Sign in" closable={false} lede={needEmail ? 'Open the link on this device, or enter the email we sent it to.' : 'Signing in…'}>
        {needEmail ? (
          <form onSubmit={finish}>
            <label htmlFor="link-email">Email</label>
            <input id="link-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            <button type="submit" className="auth-card__primary">Sign in</button>
          </form>
        ) : null}
      </AuthCard>
    </Shell>
  );
}
