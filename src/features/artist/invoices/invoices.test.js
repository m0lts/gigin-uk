import test from 'node:test';
import assert from 'node:assert/strict';
import { invoiceMailto, invoiceText, nextInvoiceNumber } from './invoices.js';

test('an invoice is the next number and opens in the venue email app', () => {
  assert.equal(nextInvoiceNumber([]), 'INV-001');
  assert.equal(nextInvoiceNumber([{ number: 'INV-003' }]), 'INV-004');
  const invoice = { number: 'INV-004', venueName: 'Hot Numbers', venueEmail: 'booker@venue.test', gigName: 'Discovery Sessions', amount: 80, issuedOn: '2026-12-10' };
  assert.equal(invoiceText(invoice, 'Maya Reid').includes('Gigin does not take payment'), true);
  assert.equal(invoiceMailto(invoice, 'Maya Reid').startsWith('mailto:booker@venue.test'), true);
});
