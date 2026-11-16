import '@styles/shared/foundation.css';

export function Button({ variant = 'primary', className = '', type = 'button', ...props }) {
  const kind = variant === 'secondary' ? 'gn-btn--secondary' : 'gn-btn--primary';
  return <button type={type} className={`gn-btn ${kind}${className ? ` ${className}` : ''}`} {...props} />;
}

export function TextField({ label, error, id, className = '', ...props }) {
  const fieldId = id || props.name;
  return (
    <label className={`gn-field${error ? ' is-error' : ''}${className ? ` ${className}` : ''}`} htmlFor={fieldId}>
      {label ? <span className="gn-label">{label}</span> : null}
      <input id={fieldId} className="gn-input" {...props} />
      {error ? <span className="gn-error">{error}</span> : null}
    </label>
  );
}

export function Card({ className = '', ...props }) {
  return <section className={`gn-card${className ? ` ${className}` : ''}`} {...props} />;
}

export function Pill({ tone = 'soft', dot = false, className = '', children, ...props }) {
  const kind = tone === 'good' || tone === 'warning' ? `gn-pill--${tone}` : 'gn-pill--soft';
  return (
    <span className={`gn-pill ${kind}${className ? ` ${className}` : ''}`} {...props}>
      {dot ? <span className="gn-dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export function Tabs({ tabs, value, onChange, className = '' }) {
  return (
    <div className={`gn-tabs${className ? ` ${className}` : ''}`} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === value}
          className={`gn-tab${tab.id === value ? ' is-on' : ''}`}
          onClick={() => onChange?.(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="gn-modal" role="presentation" onClick={onClose}>
      <div
        className="gn-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Dialog'}
        onClick={(event) => event.stopPropagation()}
      >
        <span className="gn-modal__handle" aria-hidden="true" />
        {title ? <h2 className="gn-modal__title">{title}</h2> : null}
        {children}
      </div>
    </div>
  );
}
