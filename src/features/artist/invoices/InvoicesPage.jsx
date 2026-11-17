import { useState } from 'react';
import { useAuth } from '@hooks/useAuth';
import { useOwnedDesk } from '../../shared/useOwnedDesk';
import { invoiceDraft, invoiceMailto, invoiceText, nextInvoiceNumber } from './invoices';
import { useArtistHome } from '../home/ArtistShell';
import '../../venue/desk/venue-desk.css';

const KEY = 'gigin.invoices';

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

function write(next) {
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* keep the Firestore copy */ }
}

export function InvoicesPage() {
  const data = useArtistHome();
  const { user } = useAuth();
  const [invoices, setInvoices] = useOwnedDesk({
    scope: 'user',
    id: user?.uid,
    kind: 'invoices',
    empty: [],
    readLocal: read,
    writeLocal: write,
  });
  const [draft, setDraft] = useState({ venueName: '', venueEmail: '', gigName: '', amount: '' });
  const set = (key) => (event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }));
  const save = () => {
    const invoice = invoiceDraft(draft, nextInvoiceNumber(invoices));
    const next = [invoice, ...invoices];
    setInvoices(next);
    window.location.href = invoiceMailto(invoice, data?.profile?.name);
  };
  return (
    <div className="p-desk">
      <h1>Invoices</h1>
      <p className="p-muted">A document you email to the venue. Gigin does not take payment.</p>
      <section className="p-card">
        <label>Venue<input value={draft.venueName} onChange={set('venueName')} /></label>
        <label>Venue email<input value={draft.venueEmail} onChange={set('venueEmail')} /></label>
        <label>Gig<input value={draft.gigName} onChange={set('gigName')} /></label>
        <label>Amount<input value={draft.amount} onChange={set('amount')} /></label>
        <button type="button" className="p-btn p-btn--dark" onClick={save}>Create and email</button>
      </section>
      <ul>
        {invoices.map((invoice) => (
          <li key={invoice.number}>
            <strong>{invoice.number}</strong>
            <span>{invoice.venueName} · £{invoice.amount}</span>
            <button type="button" className="p-text" onClick={() => {
              const popup = window.open('', '_blank', 'noopener,noreferrer');
              if (!popup) return;
              popup.document.write(`<pre>${invoiceText(invoice, data?.profile?.name)}</pre><script>onload=()=>print()<\/script>`);
              popup.document.close();
            }}>Download PDF</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
