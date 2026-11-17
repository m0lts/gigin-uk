import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { updateGigDocument } from '@services/api/gigs';
import { sendGigPhotosEmail } from '@services/client-side/emails';
import { uploadFileToStorage } from '@services/storage';
import { hasVenuePerm } from '../../../services/utils/permissions';
import { groupUpcomingNights, longDate } from '../home/nights';
import { assignPhotos, movePhoto, photosForSet, setWindow } from './gigPhotos';
import '../desk/venue-desk.css';

export function GigPhotosPage({ gigs, venues, refreshGigs }) {
  const { gigId } = useParams();
  const navigate = useNavigate();
  const night = useMemo(() => groupUpcomingNights(gigs || []).find((item) => item.gigId === gigId || item.gigIds?.includes(gigId)), [gigs, gigId]);
  const sets = (night?.slots || []).map(setWindow);
  const [photos, setPhotos] = useState([]);
  const [credit, setCredit] = useState('');
  const [instagram, setInstagram] = useState('');
  const [sending, setSending] = useState(false);
  const venue = (venues || []).find((item) => item.venueId === night?.venueId);
  const canSend = night && hasVenuePerm(venues, night.venueId, 'gigs.update');

  const addFiles = (list) => {
    const next = [];
    for (const file of list || []) {
      if (!file.type?.startsWith('image/')) continue;
      next.push({
        id: `${file.name}-${file.lastModified}-${file.size}`,
        name: file.name,
        takenAt: new Date(file.lastModified),
        preview: URL.createObjectURL(file),
        file,
      });
    }
    setPhotos((prev) => assignPhotos([...prev, ...next], night?.slots || []));
  };

  const send = async () => {
    if (!canSend) {
      toast.error('You do not have permission to send these photos.');
      return;
    }
    setSending(true);
    try {
      const stored = [];
      for (const photo of photos) {
        const path = `venues/${night.venueId}/gig-photos/${photo.id.replace(/[^\w.-]+/g, '-')}`;
        const url = photo.file ? await uploadFileToStorage(photo.file, path) : photo.url;
        stored.push({ id: photo.id, url, setId: photo.setId, takenAt: photo.takenAt?.toISOString?.() || '' });
      }
      await Promise.all((night.slots || []).map((slot) => updateGigDocument({
        gigId: slot.gigId,
        action: 'gigs.update',
        updates: {
          setPhotos: stored.filter((photo) => photo.setId === slot.gigId),
          photoCredit: credit,
          photoInstagram: instagram,
        },
      })));
      await sendGigPhotosEmail({ gigId: night.gigId, when: longDate(night.date) });
      toast.success('Photos sent to the booked acts.');
      refreshGigs?.();
    } catch (error) {
      console.error(error);
      toast.error('Could not send the photos.');
    } finally {
      setSending(false);
    }
  };

  if (!night) return <p className="p-empty">This gig is not on the list.</p>;

  return (
    <div className="p-desk">
      <button type="button" className="p-text" onClick={() => navigate('/venues/dashboard/gigs')}>Gigs</button>
      <h1>{night.name}</h1>
      <p className="p-muted">{longDate(night.date)}{venue?.name ? ` · ${venue.name}` : ''}</p>
      <p>{photos.length} photos, sorted by set using the time each was taken. Check them, then send.</p>
      <section className="p-card">
        <label className="is-wide">
          Add more photos
          <input type="file" accept="image/*" multiple onChange={(event) => addFiles(event.target.files)} />
        </label>
      </section>
      {sets.map((set) => {
        const rows = photosForSet(photos, set.id);
        return (
          <section className="p-card" key={set.id}>
            <header className="p-card__row">
              <h2>Set · {set.startLabel} · {set.label}</h2>
              <span className="p-muted">{rows.length} photos</span>
            </header>
            <div className="p-kit__photos">
              {rows.map((photo) => (
                <figure key={photo.id}>
                  <img src={photo.preview || photo.url} alt="" />
                  <select value={photo.setId} onChange={(event) => setPhotos(movePhoto(photos, photo.id, event.target.value))}>
                    {sets.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                </figure>
              ))}
            </div>
          </section>
        );
      })}
      <section className="p-card">
        <label>Photos by<input value={credit} onChange={(event) => setCredit(event.target.value)} /></label>
        <label>Instagram (optional)<input value={instagram} onChange={(event) => setInstagram(event.target.value)} /></label>
        <p className="p-muted">Each act gets their own set’s photos. Your venue is credited on every one.</p>
        <button type="button" className="p-btn p-btn--dark" disabled={!photos.length || sending} onClick={send}>{sending ? 'Sending' : 'Send to the acts'}</button>
      </section>
    </div>
  );
}

export function ArtistSetPhotos({ gig, venueName, onSave }) {
  const photos = Array.isArray(gig?.setPhotos) ? gig.setPhotos : [];
  const [picked, setPicked] = useState([]);
  const toggle = (id) => setPicked((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  return (
    <div className="p-desk">
      <p className="p-muted">{venueName} via Gigin</p>
      <h1>Photos from your set</h1>
      <p>{photos.length} photos{gig?.photoCredit ? `. Photos by ${gig.photoCredit}.` : ''}</p>
      <div className="p-kit__photos">
        {photos.map((photo) => (
          <button type="button" key={photo.id || photo.url} className={picked.includes(photo.id) ? 'p-btn--dark' : ''} onClick={() => toggle(photo.id)}>
            <img src={photo.url} alt="" />
          </button>
        ))}
      </div>
      <p>Tap to pick the ones for your profile. {picked.length} picked.</p>
      <button type="button" className="p-btn p-btn--dark" disabled={!picked.length} onClick={() => onSave(photos.filter((photo) => picked.includes(photo.id)))}>
        Add {picked.length} to my profile
      </button>
      <p>{photos.map((photo) => <a key={photo.url} href={photo.url}>Download</a>)}</p>
      <Link to={`/gig/${gig?.gigId || ''}`}>Back to the gig</Link>
    </div>
  );
}
