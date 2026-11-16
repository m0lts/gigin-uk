import { auth } from '../../../lib/firebase';

export const AppCrashFallback = () => {
  const signedIn = Boolean(auth.currentUser);
  return (
    <div className="crash-screen">
      <div className="crash-card">
        <h1>Something went wrong</h1>
        <p>Reload the page. If it keeps happening, head back and try again.</p>
        <button type="button" className="crash-card__reload" onClick={() => window.location.reload()}>Reload</button>
        <a href={signedIn ? '/venues/dashboard' : '/'}>{signedIn ? 'Go to dashboard' : 'Back to Gigin'}</a>
      </div>
    </div>
  );
};
