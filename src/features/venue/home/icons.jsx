function Stroke({ size = 16, children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      {children}
    </svg>
  );
}

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function BellIcon({ size = 16 }) {
  return (
    <Stroke size={size}>
      <path d="M8 2.1a2.9 2.9 0 0 0-2.9 2.9v1.6c0 .7-.2 1.3-.6 1.9L3.7 10.2h8.6l-.8-1.7a3.2 3.2 0 0 1-.6-1.9V5A2.9 2.9 0 0 0 8 2.1z" {...stroke} />
      <path d="M6.7 11.3a1.3 1.3 0 0 0 2.6 0" {...stroke} />
    </Stroke>
  );
}

export function QrCodeIcon({ size = 16 }) {
  return (
    <Stroke size={size}>
      <path d="M2.2 2.2h4.2v4.2H2.2zM9.6 2.2h4.2v4.2H9.6zM2.2 9.6h4.2v4.2H2.2z" {...stroke} />
      <path d="M9.6 9.6h1.4v1.4H9.6zM12.4 9.6h1.4v1.4h-1.4zM9.6 12.4h1.4V13.8H9.6zM12.4 12.4h1.4V13.8h-1.4z" {...stroke} />
    </Stroke>
  );
}

export function LinkIcon({ size = 16 }) {
  return (
    <Stroke size={size}>
      <path d="M6.6 9.4 9.4 6.6" {...stroke} />
      <path d="M7.2 4.6 8.4 3.4a2.5 2.5 0 0 1 3.5 3.5L10.7 8" {...stroke} />
      <path d="M8.8 11.4 7.6 12.6a2.5 2.5 0 0 1-3.5-3.5L5.3 8" {...stroke} />
    </Stroke>
  );
}

export function CopyIcon({ size = 16 }) {
  return (
    <Stroke size={size}>
      <rect x="5.2" y="5.2" width="7.6" height="8.2" rx="1.4" {...stroke} />
      <path d="M10.6 5.2V3.8A1.2 1.2 0 0 0 9.4 2.6H3.8A1.2 1.2 0 0 0 2.6 3.8v5.6c0 .7.5 1.2 1.2 1.2h1.4" {...stroke} />
    </Stroke>
  );
}

export function HomeIcon({ size = 16 }) {
  return (
    <Stroke size={size}>
      <rect x="2.2" y="2.2" width="4.8" height="4.8" rx="1" {...stroke} />
      <rect x="9" y="2.2" width="4.8" height="4.8" rx="1" {...stroke} />
      <rect x="2.2" y="9" width="4.8" height="4.8" rx="1" {...stroke} />
      <rect x="9" y="9" width="4.8" height="4.8" rx="1" {...stroke} />
    </Stroke>
  );
}

export function PlusIcon({ size = 16 }) {
  return (
    <Stroke size={size}>
      <path d="M8 3.2v9.6M3.2 8h9.6" {...stroke} />
    </Stroke>
  );
}

export function ContactsIcon({ size = 16 }) {
  return (
    <Stroke size={size}>
      <rect x="3.2" y="2.2" width="9.6" height="11.6" rx="1.4" {...stroke} />
      <path d="M6.2 6.2h3.6M6.2 8.6h3.6" {...stroke} />
    </Stroke>
  );
}

export function MenuIcon({ size = 16 }) {
  return (
    <Stroke size={size}>
      <path d="M2.6 4.2h10.8M2.6 8h10.8M2.6 11.8h10.8" {...stroke} />
    </Stroke>
  );
}

export function CloseIcon({ size = 16 }) {
  return (
    <Stroke size={size}>
      <path d="M3.4 3.4 12.6 12.6M12.6 3.4 3.4 12.6" {...stroke} />
    </Stroke>
  );
}

export function WhatsAppIcon() {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 22,
        height: 22,
        borderRadius: 6,
        background: '#25D366',
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 'none',
      }}
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <path d="M3 3.4h7.1A1.6 1.6 0 0 1 11.7 5v4.1A1.6 1.6 0 0 1 10.1 10.7H6.8L4.6 13v-2.3H3A1.6 1.6 0 0 1 1.4 9.1V5A1.6 1.6 0 0 1 3 3.4z" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
