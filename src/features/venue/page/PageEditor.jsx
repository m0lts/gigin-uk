import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { firestore } from '@lib/firebase';
import { uploadFileToStorage } from '@services/storage';
import { copyText, displayUrl, venuePageUrl } from '../home/publicLinks';
import { pageDraft, pagePatch } from './venuePublic';
import '../desk/venue-desk.css';

const FIELDS = [
  ['tagline', 'Tagline'],
  ['about', 'About'],
  ['pa', 'PA'],
  ['vocalMics', 'Vocal mics'],
  ['diBoxes', 'DI boxes'],
  ['micStands', 'Mic stands'],
  ['backline', 'Backline'],
  ['soundEngineer', 'Sound engineer'],
  ['capacity', 'Capacity'],
  ['parking', 'Parking'],
  ['address', 'Address'],
  ['website', 'Website'],
  ['instagram', 'Instagram'],
  ['facebook', 'Facebook'],
  ['tiktok', 'TikTok'],
];

export function VenuePageEditor({ venues }) {
  const [searchParams] = useSearchParams();
  const selected = searchParams.get('venue') || '';
  const venue = (venues || []).find((item) => item.venueId === selected) || ((venues || []).length === 1 ? venues[0] : null);
  const initial = useMemo(() => pageDraft(venue), [venue]);
  const [draft, setDraft] = useState(initial);
  const [photos, setPhotos] = useState(venue?.photos || []);
  useEffect(() => {
    setDraft(pageDraft(venue));
    setPhotos(venue?.photos || []);
  }, [venue?.venueId]);
  const url = venuePageUrl(venue?.venueId);
  const save = async () => {
    if (!venue?.venueId) return;
    try {
      await updateDoc(doc(firestore, 'venueProfiles', venue.venueId), { ...pagePatch(draft, venue), photos });
      toast.success('Venue page saved');
    } catch (error) {
      console.error(error);
      toast.error('Could not save the venue page');
    }
  };
  const addPhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !venue?.venueId) return;
    try {
      const uploaded = await uploadFileToStorage(file, `venues/${venue.venueId}/${Date.now()}-${file.name}`);
      setPhotos((prev) => [...prev, uploaded]);
    } catch (error) {
      console.error(error);
      toast.error('Could not add that photo');
    }
  };
  if (!venue) return <p className="p-muted">Choose a venue to edit its page.</p>;
  return (
    <div className="p-desk">
      <header className="p-card__row">
        <h1>Venue page</h1>
        <span>
          <Link className="p-btn" to={`/venues/${venue.venueId}`}>Preview</Link>
          <button type="button" className="p-btn p-btn--dark" onClick={save}>Save changes</button>
        </span>
      </header>
      <div className="p-card">
        <h2>Photos</h2>
        <p className="p-muted">The first one is the cover.</p>
        <label className="p-btn">Add photos<input type="file" accept="image/*" hidden onChange={addPhoto} /></label>
      </div>
      {FIELDS.map(([key, label]) => (
        <label key={key}>{label}{key === 'about' ? <textarea value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /> : <input value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />}</label>
      ))}
      <aside className="p-card">
        <h2>Your venue page</h2>
        <p>{displayUrl(url)} <button type="button" className="p-btn" onClick={() => copyText(url)}>Copy</button></p>
        <Link className="p-btn" to={`/venues/${venue.venueId}/poster`}>Download poster</Link>
        <Link className="p-btn" to={`/venues/${venue.venueId}`}>View your page</Link>
      </aside>
    </div>
  );
}
