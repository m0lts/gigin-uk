import { useState } from 'react';
import { toast } from 'sonner';
import Portal from '../../shared/components/Portal';
import { CloseIcon } from '../../shared/ui/extras/Icons';
import { updateArtistCRMEntry } from '@services/client-side/artistCRM';
import { normalizeContactType } from './contactUtils';
import './contacts-page.css';

function typeButtonClass(type, current) {
  if (type !== current) return '';
  if (type === 'artist') return 'add-contact-type--artist-active';
  if (type === 'promoter') return 'add-contact-type--promoter-active';
  if (type === 'soundEngineer') return 'add-contact-type--sound-engineer-active';
  return 'add-contact-type--other-active';
}

/**
 * @param {{
 *   userId: string;
 *   entry: Record<string, unknown> & { id: string };
 *   onClose: () => void;
 *   onSaved: (updates: Record<string, unknown>) => void;
 * }} props
 */
export function EditContactModal({ userId, entry, onClose, onSaved }) {
  const initialType = normalizeContactType(entry.contactType);
  const [contactType, setContactType] = useState(
    /** @type {'artist' | 'promoter' | 'other' | 'soundEngineer'} */ (initialType)
  );
  const [otherTypeLabel, setOtherTypeLabel] = useState(
    typeof entry.otherTypeLabel === 'string' ? entry.otherTypeLabel : ''
  );
  const [name, setName] = useState(typeof entry.name === 'string' ? entry.name : '');
  const [genre, setGenre] = useState(typeof entry.genre === 'string' ? entry.genre : '');
  const [email, setEmail] = useState(typeof entry.email === 'string' ? entry.email : '');
  const [phone, setPhone] = useState(typeof entry.phone === 'string' ? entry.phone : '');
  const [instagram, setInstagram] = useState(
    typeof entry.instagram === 'string' ? entry.instagram : ''
  );
  const [notes, setNotes] = useState(typeof entry.notes === 'string' ? entry.notes : '');
  const [saving, setSaving] = useState(false);

  const hasGiginProfile = !!entry.artistId;

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Name is required.');
      return;
    }
    if (contactType === 'other' && !otherTypeLabel.trim()) {
      toast.error('Describe this contact type.');
      return;
    }
    if (!userId) return;
    setSaving(true);
    try {
      const payload = {
        contactType,
        otherTypeLabel:
          contactType === 'other' ? otherTypeLabel.trim() || null : null,
        genre: genre.trim() || null,
        actFormat: null,
        numberOfPeople: null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        instagram: instagram.trim() || null,
        notes: notes.trim(),
      };
      if (!hasGiginProfile) {
        payload.name = name.trim();
      }
      await updateArtistCRMEntry(userId, entry.id, payload);
      toast.success('Contact updated');
      onSaved({
        ...payload,
        name: hasGiginProfile ? entry.name : name.trim(),
      });
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Could not update contact.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Portal>
      <div className="modal add-contact-modal" onClick={onClose}>
        <div className="modal-content scrollable" onClick={(e) => e.stopPropagation()}>
          <div className="add-contact-modal-header">
            <h2>Edit contact</h2>
            <button type="button" className="btn icon" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>

          <p className="add-contact-section-label">Contact type</p>
          <div className="add-contact-type-row">
            <button
              type="button"
              className={typeButtonClass('artist', contactType)}
              onClick={() => setContactType('artist')}
            >
              Artist
            </button>
            <button
              type="button"
              className={typeButtonClass('promoter', contactType)}
              onClick={() => setContactType('promoter')}
            >
              Promoter
            </button>
            <button
              type="button"
              className={typeButtonClass('soundEngineer', contactType)}
              onClick={() => setContactType('soundEngineer')}
            >
              Sound Engineer
            </button>
            <button
              type="button"
              className={typeButtonClass('other', contactType)}
              onClick={() => setContactType('other')}
            >
              Other
            </button>
          </div>

          {contactType === 'other' && (
            <div className="add-contact-field">
              <label className="add-contact-field-label" htmlFor="edit-contact-other-type">
                Describe this contact
              </label>
              <input
                id="edit-contact-other-type"
                type="text"
                className="input"
                value={otherTypeLabel}
                onChange={(e) => setOtherTypeLabel(e.target.value)}
              />
            </div>
          )}

          <div className="add-contact-name-field">
            <label className="add-contact-field-label">Name</label>
            <input
              type="text"
              className="input"
              placeholder={hasGiginProfile ? undefined : 'Name or Stage name'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={hasGiginProfile}
            />
            {hasGiginProfile && (
              <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                Names for Gigin profiles come from their profile.
              </p>
            )}
          </div>

          <div className="add-contact-field">
            <label className="add-contact-field-label">Genre</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Jazz, Indie, Folk…"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
            />
          </div>

          <div className="add-contact-field">
            <label className="add-contact-field-label">Email</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="add-contact-field add-contact-two-col">
            <div>
              <label className="add-contact-field-label">Phone</label>
              <input type="tel" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="add-contact-field-label">Instagram</label>
              <input
                type="text"
                className="input"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
              />
            </div>
          </div>

          <div className="add-contact-field">
            <label className="add-contact-field-label">Notes</label>
            <textarea
              className="input add-contact-notes-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="add-contact-footer">
            <button type="button" className="btn add-contact-footer-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
