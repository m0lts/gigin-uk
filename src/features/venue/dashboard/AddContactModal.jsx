import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import Portal from '../../shared/components/Portal';
import { CloseIcon } from '../../shared/ui/extras/Icons';
import { fetchArtistsPaginated } from '@services/client-side/artists';
import {
  createArtistCRMEntry,
  isArtistSavedInCRM,
} from '@services/client-side/artistCRM';
import {
  buildGenreFormatLocation,
  getAvatarBackgroundColor,
  getContactFieldPrefillFromGiginArtist,
  getContactInitials,
} from './contactUtils';
import './contacts-page.css';

function typeButtonClass(type, current) {
  if (type !== current) return '';
  if (type === 'artist') return 'add-contact-type--artist-active';
  if (type === 'promoter') return 'add-contact-type--promoter-active';
  if (type === 'soundEngineer') return 'add-contact-type--sound-engineer-active';
  return 'add-contact-type--other-active';
}

/**
 * @param {{ userId: string; onClose: () => void; onCreated: () => Promise<void> | void }} props
 */
export function AddContactModal({ userId, onClose, onCreated }) {
  const [contactType, setContactType] = useState(
    /** @type {'artist' | 'promoter' | 'other' | 'soundEngineer'} */ ('artist')
  );
  const [otherTypeLabel, setOtherTypeLabel] = useState('');
  const [nameQuery, setNameQuery] = useState('');
  const [giginLoading, setGiginLoading] = useState(false);
  const [giginResults, setGiginResults] = useState([]);
  /** When set, user picked a Gigin profile — contact fields are prefilled from their public profile where available. */
  const [selectedGiginArtist, setSelectedGiginArtist] = useState(null);
  const [saving, setSaving] = useState(false);

  const [genre, setGenre] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [instagram, setInstagram] = useState('');
  const [notes, setNotes] = useState('');

  const debounceRef = useRef(null);

  const runSearch = useCallback(async (term) => {
    const q = term.trim();
    if (!q) {
      setGiginResults([]);
      setGiginLoading(false);
      return;
    }
    setGiginLoading(true);
    try {
      const { artists } = await fetchArtistsPaginated({
        lastDocId: null,
        limitCount: 120,
        genres: [],
        search: q,
        type: '',
      });
      const filtered = (artists || []).filter((a) => a?.isComplete && a?.id);
      const t = q.toLowerCase();
      const ranked = filtered.filter((a) => (a.name || '').toLowerCase().includes(t));
      setGiginResults(ranked.slice(0, 12));
    } catch (e) {
      console.error(e);
      setGiginResults([]);
    } finally {
      setGiginLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = nameQuery.trim();
    if (!q) {
      setGiginResults([]);
      setGiginLoading(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      runSearch(q);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [nameQuery, runSearch]);

  const clearGiginSelection = () => {
    setSelectedGiginArtist(null);
    setGenre('');
    setEmail('');
    setPhone('');
    setInstagram('');
  };

  const onNameChange = (e) => {
    const v = e.target.value;
    if (selectedGiginArtist) {
      setSelectedGiginArtist(null);
    }
    setNameQuery(v);
  };

  const selectGiginArtist = (artist) => {
    setSelectedGiginArtist(artist);
    setNameQuery(artist.name || '');
    const pre = getContactFieldPrefillFromGiginArtist(artist);
    setGenre(pre.genre);
    setEmail(pre.email);
    setPhone(pre.phone);
    setInstagram(pre.instagram);
  };

  const saveGiginContact = async () => {
    if (!userId || !selectedGiginArtist?.id) return;
    if (contactType === 'other' && !otherTypeLabel.trim()) {
      toast.error('Describe this contact type first.');
      return;
    }
    setSaving(true);
    try {
      const exists = await isArtistSavedInCRM(userId, selectedGiginArtist.id);
      if (exists) {
        toast.info(`${selectedGiginArtist.name || 'This act'} is already in your contacts.`);
        return;
      }
      await createArtistCRMEntry(userId, {
        artistId: selectedGiginArtist.id,
        name: selectedGiginArtist.name || 'Unknown',
        notes: notes.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        instagram: instagram.trim() || null,
        genre: genre.trim() || null,
        contactType,
        otherTypeLabel: contactType === 'other' ? otherTypeLabel.trim() : undefined,
      });
      toast.success('Contact saved');
      await onCreated?.();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Could not save contact.');
    } finally {
      setSaving(false);
    }
  };

  const saveManualContact = async () => {
    const name = nameQuery.trim();
    if (!name) {
      toast.error('Enter a name.');
      return;
    }
    if (contactType === 'other' && !otherTypeLabel.trim()) {
      toast.error('Describe this contact type.');
      return;
    }
    if (!userId) return;
    setSaving(true);
    try {
      await createArtistCRMEntry(userId, {
        name,
        notes: notes.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        instagram: instagram.trim() || null,
        contactType,
        otherTypeLabel: contactType === 'other' ? otherTypeLabel.trim() : undefined,
        genre: genre.trim() || null,
      });
      toast.success('Contact saved');
      await onCreated?.();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Could not save contact.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveContact = () => {
    if (selectedGiginArtist) {
      return saveGiginContact();
    }
    return saveManualContact();
  };

  const showGiginDropdown = nameQuery.trim().length >= 1 && !selectedGiginArtist;
  const canSave =
    selectedGiginArtist ||
    (nameQuery.trim() && (contactType !== 'other' || otherTypeLabel.trim()));

  return (
    <Portal>
      <div className="modal add-contact-modal" onClick={onClose}>
        <div className="modal-content scrollable" onClick={(e) => e.stopPropagation()}>
          <div className="add-contact-modal-header">
            <h2>Add contact</h2>
            <button type="button" className="btn icon" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>

          <p className="add-contact-section-label">What type of contact?</p>
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
              <label className="add-contact-field-label" htmlFor="add-contact-other-type">
                Describe this contact
              </label>
              <input
                id="add-contact-other-type"
                type="text"
                className="input"
                placeholder="e.g. Venue manager, agent…"
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
              placeholder="Name or Stage name"
              value={nameQuery}
              onChange={onNameChange}
              disabled={!!selectedGiginArtist}
              autoComplete="off"
            />
          </div>

          {selectedGiginArtist ? (
            <div className="add-contact-gigin-selected">
              <div>
                <div className="add-contact-gigin-selected-label">From Gigin</div>
                <div className="add-contact-gigin-selected-name">{selectedGiginArtist.name}</div>
              </div>
              <button
                type="button"
                className="btn tertiary add-contact-gigin-selected-change"
                onClick={clearGiginSelection}
              >
                Change
              </button>
            </div>
          ) : null}

          {showGiginDropdown && (
            <div className="add-contact-gigin-dropdown">
              <div className="add-contact-gigin-dropdown-label">On Gigin</div>
              {giginLoading ? (
                <div style={{ padding: '1rem', fontSize: '0.85rem', color: '#666' }}>
                  Searching…
                </div>
              ) : giginResults.length === 0 ? (
                <div style={{ padding: '0.65rem', fontSize: '0.85rem', color: '#666' }}>
                  No matches yet. Continue with the form below or try another spelling.
                </div>
              ) : (
                giginResults.map((artist) => (
                  <div key={artist.id} className="add-contact-gigin-row">
                    <div
                      className="add-contact-gigin-row-avatar"
                      style={{
                        backgroundColor: getAvatarBackgroundColor(artist.name || ''),
                      }}
                    >
                      {getContactInitials(artist.name)}
                    </div>
                    <div className="add-contact-gigin-row-text">
                      <div className="add-contact-gigin-row-name">{artist.name}</div>
                      <div className="add-contact-gigin-row-meta">
                        {buildGenreFormatLocation({}, artist)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="add-contact-gigin-add"
                      onClick={() => selectGiginArtist(artist)}
                    >
                      Select
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          <div className="add-contact-manual-fields">
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
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="add-contact-field add-contact-two-col">
              <div>
                <label className="add-contact-field-label">Phone</label>
                <input
                  type="tel"
                  className="input"
                  placeholder="+44…"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div>
                <label className="add-contact-field-label">Instagram</label>
                <input
                  type="text"
                  className="input"
                  placeholder="@handle or profile URL"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                />
              </div>
            </div>
            <div className="add-contact-field">
              <label className="add-contact-field-label">Notes</label>
              <textarea
                className="input add-contact-notes-textarea"
                placeholder="Anything worth remembering…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="add-contact-footer">
            <button type="button" className="btn add-contact-footer-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={handleSaveContact}
              disabled={saving || !canSave}
            >
              {saving ? 'Saving…' : 'Save contact'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
