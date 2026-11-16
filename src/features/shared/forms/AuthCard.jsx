export function AuthCard({ title, lede, onClose, closable = true, icon, children }) {
  return (
    <div className="auth-card" onClick={(event) => event.stopPropagation()}>
      <span className="auth-card__handle" aria-hidden="true" />
      {closable ? (
        <button type="button" className="auth-card__close" aria-label="Close" onClick={onClose}>×</button>
      ) : null}
      {icon ? <div className={`auth-card__icon${icon === 'good' ? ' is-good' : ''}${icon === 'error' ? ' is-error' : ''}`} aria-hidden="true">{icon === 'good' ? '✓' : icon === 'error' ? '⏱' : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" /><path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>}</div> : null}
      {title ? <h1>{title}</h1> : null}
      {lede ? <p className="auth-card__lede">{lede}</p> : null}
      {children}
    </div>
  );
}

export function isGmail(email) {
  return /@g(oogle)?mail\.com$/i.test(String(email || '').trim());
}

export function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.98 10.72A5.4 5.4 0 0 1 3.7 9c0-.6.1-1.18.28-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.02-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}

export function EyeButton({ shown, onClick }) {
  return (
    <button type="button" className="auth-card__eye" aria-label={shown ? 'Hide password' : 'Show password'} aria-pressed={shown} onClick={onClick}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    </button>
  );
}
