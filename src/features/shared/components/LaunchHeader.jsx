import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import { AccountChip, SignedInHomeButton } from './AccountChip';
import '@assets/styles/shared/launch-header.css';

export function LaunchHeader({ setAuthModal, setAuthType, setAuthClosable }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const onHome = pathname === '/';
  const open = (type) => {
    setAuthType?.(type);
    setAuthClosable?.(true);
    setAuthModal?.(true);
  };

  return (
    <header className="launch-header">
      <Link to="/" className="launch-header__mark" aria-label="Gigin">gigin<b>.</b></Link>
      <nav className="launch-header__nav" aria-label="Site">
        <a href={onHome ? '#how' : '/#how'}>For venues</a>
        <a href={onHome ? '#artists' : '/#artists'}>For musicians</a>
        {user ? (
          <>
            <AccountChip user={user} logout={logout} />
            <SignedInHomeButton
              user={user}
              className="launch-header__go"
              setAuthType={setAuthType}
              setAuthModal={setAuthModal}
              setAuthClosable={setAuthClosable}
            />
          </>
        ) : (
          <>
            <button type="button" className="launch-header__text" onClick={() => open('login')}>Sign in</button>
            <button type="button" className="launch-header__go" onClick={() => open('signup')}>Get started</button>
          </>
        )}
      </nav>
    </header>
  );
}
