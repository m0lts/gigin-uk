import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '@lib/firebase';
import { FEATURES } from '../../../config/features';
import { accountInitials, loginLandingState, signedInHomeAction } from '../../../config/loginDestination';
import '@assets/styles/shared/account-chip.css';

export function AccountChip({ user, logout }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;

  return (
    <div className="account-chip" ref={rootRef}>
      <button
        type="button"
        className="account-chip__button"
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {accountInitials(user)}
      </button>
      {open ? (
        <div className="account-chip__menu" role="menu">
          {user.name ? <p className="account-chip__name">{user.name}</p> : null}
          {user.email ? <p className="account-chip__email">{user.email}</p> : null}
          <Link to="/account" role="menuitem" onClick={() => setOpen(false)}>Account</Link>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); logout?.(); }}>Log out</button>
        </div>
      ) : null}
    </div>
  );
}

export function SignedInHomeButton({ user, className, label, setAuthType, setAuthModal, setAuthClosable, onDone }) {
  const navigate = useNavigate();
  if (!user) return null;
  const action = signedInHomeAction(user, FEATURES, {
    emailVerified: auth.currentUser?.emailVerified !== false,
  });

  const go = () => {
    if (action.verify) {
      setAuthType?.('verify-email');
      setAuthClosable?.(true);
      setAuthModal?.(true);
    } else if (action.chooser) {
      setAuthType?.('signup');
      setAuthClosable?.(true);
      setAuthModal?.(true);
    } else if (action.path) {
      const draft = action.path.startsWith('/venues/add-venue') ? loginLandingState(user) : null;
      navigate(action.path, draft ? { state: draft } : undefined);
    }
    onDone?.();
  };

  return (
    <button type="button" className={className} onClick={go}>
      {label || action.label}
    </button>
  );
}
