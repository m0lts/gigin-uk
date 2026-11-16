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
