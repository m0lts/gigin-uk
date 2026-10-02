import { useEffect, useState } from 'react';

export function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="kp-sheet" role="presentation" onClick={onClose}>
      <article role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ fontSize: 18 }}>{title}</h2>
          <button type="button" className="kp-text" onClick={onClose} aria-label="Close">×</button>
        </header>
        {children}
      </article>
    </div>
  );
}

export function Toggle({ on, disabled, label, onChange }) {
  return (
    <button type="button" className={`kp-switch${on ? ' is-on' : ''}`} role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange?.(!on)}>
      <span />
    </button>
  );
}

export function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" className="kp-inline" onClick={async () => {
      try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }}>{copied ? 'Copied ✓' : label}</button>
  );
}

export function GreyBars() {
  return (
    <div className="kp-bars" aria-hidden="true">
      <span className="kp-bar" style={{ width: '58%' }} />
      <span className="kp-bar" style={{ width: '76%' }} />
      <span className="kp-bar" style={{ width: '44%' }} />
    </div>
  );
}

export function shareProfile(url, actName) {
  const text = `${actName} on Gigin: ${url}`;
  if (navigator.share) {
    navigator.share({ title: actName, text, url }).catch(() => {});
    return 'native';
  }
  return 'sheet';
}

const BRANDS = { Spotify: '#1DB954', YouTube: '#FF0033', Instagram: '#E56969', Website: '#6B7280' };

export function LinkChips({ links }) {
  const rows = [
    links?.spotifyUrl || links?.spotify ? ['Spotify', links.spotifyUrl || links.spotify] : null,
    links?.youtubeUrl || links?.youtube ? ['YouTube', links.youtubeUrl || links.youtube] : null,
    links?.instagramUrl || links?.instagram ? ['Instagram', links.instagramUrl || links.instagram] : null,
    links?.websiteUrl || links?.website ? ['Website', links.websiteUrl || links.website] : null,
  ].filter(Boolean);
  return rows.map(([name, href]) => (
    <a key={name} className="kp-chip" href={href} target="_blank" rel="noreferrer"><i style={{ background: BRANDS[name] }} />{name}</a>
  ));
}
