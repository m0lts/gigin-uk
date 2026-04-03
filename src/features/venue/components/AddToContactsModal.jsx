import React, { useState, useEffect } from 'react';
import Portal from '@features/shared/components/Portal';
import { CloseIcon } from '@features/shared/ui/extras/Icons';
import '@styles/host/add-performers-modal.styles.css';

const initialForm = {
  name: '',
  email: '',
  phone: '',
  instagram: '',
  facebook: '',
  other: '',
};

/**
 * Modal to add a performer to the venue's CRM (contact book).
 * Same fields as the CRM add-contact form: name, email, phone, Instagram, Facebook, other.
 */
export function AddToContactsModal({
  isOpen,
  onClose,
  initialName = '',
  onSave,
  saving,
}) {
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (isOpen) {
      setForm((prev) => ({ ...prev, name: initialName || '' }));
    }
  }, [isOpen, initialName]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const name = (form.name || '').trim();
    if (!name) return;
    onSave({
      name,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      instagram: form.instagram.trim() || null,
      facebook: form.facebook.trim() || null,
      other: form.other.trim() || null,
    });
  };

  if (!isOpen) return null;

  return (
    <Portal>
      <div
        className="modal cancel-gig add-performers-modal"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-to-contacts-title"
      >
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
          <div className="add-performers-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 id="add-to-contacts-title" style={{ margin: 0 }}>Add to contacts</h3>
            <button type="button" className="btn icon" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label className="label" style={{ marginBottom: '0.5rem', display: 'block' }}>Name *</label>
              <input
                type="text"
                className="input add-performers-input"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Artist or performer name"
                required
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label className="label" style={{ marginBottom: '0.5rem', display: 'block' }}>Email</label>
              <input
                type="email"
                className="input add-performers-input"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="artist@example.com"
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label className="label" style={{ marginBottom: '0.5rem', display: 'block' }}>Phone</label>
              <input
                type="tel"
                className="input add-performers-input"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="+44 123 456 7890"
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label className="label" style={{ marginBottom: '0.5rem', display: 'block' }}>Instagram</label>
              <input
                type="text"
                className="input add-performers-input"
                value={form.instagram}
                onChange={(e) => setForm((prev) => ({ ...prev, instagram: e.target.value }))}
                placeholder="@username or URL"
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label className="label" style={{ marginBottom: '0.5rem', display: 'block' }}>Facebook</label>
              <input
                type="text"
                className="input add-performers-input"
                value={form.facebook}
                onChange={(e) => setForm((prev) => ({ ...prev, facebook: e.target.value }))}
                placeholder="URL or username"
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label className="label" style={{ marginBottom: '0.5rem', display: 'block' }}>Other</label>
              <input
                type="text"
                className="input add-performers-input"
                value={form.other}
                onChange={(e) => setForm((prev) => ({ ...prev, other: e.target.value }))}
                placeholder="Other contact method"
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="button" className="btn tertiary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={!form.name.trim() || saving}>
                {saving ? 'Saving…' : 'Add to contacts'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}
