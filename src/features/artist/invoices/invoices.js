export function nextInvoiceNumber(invoices) {
  const numbers = (invoices || []).map((invoice) => Number(String(invoice.number || '').replace(/\D/g, ''))).filter((value) => Number.isFinite(value));
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
  return `INV-${String(next).padStart(3, '0')}`;
}

export function invoiceDraft(input, number) {
  const total = Number(input.amount);
  return {
    number,
    venueName: String(input.venueName || '').trim(),
    venueEmail: String(input.venueEmail || '').trim(),
    gigName: String(input.gigName || '').trim(),
    amount: Number.isFinite(total) ? total : 0,
    issuedOn: input.issuedOn || new Date().toISOString().slice(0, 10),
  };
}

export function invoiceText(invoice, artistName) {
  return [
    `Invoice ${invoice.number}`,
    `From ${artistName || 'the artist'}`,
    `To ${invoice.venueName}`,
    invoice.gigName,
    `Amount £${invoice.amount}`,
    `Issued ${invoice.issuedOn}`,
    'This is a document only. Gigin does not take payment.',
  ].filter(Boolean).join('\n');
}

export function invoiceMailto(invoice, artistName) {
  const subject = encodeURIComponent(`Invoice ${invoice.number}`);
  const body = encodeURIComponent(invoiceText(invoice, artistName));
  return `mailto:${invoice.venueEmail}?subject=${subject}&body=${body}`;
}
