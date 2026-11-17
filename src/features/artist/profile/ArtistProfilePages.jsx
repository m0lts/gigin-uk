import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { firestore } from '@lib/firebase';
import { updateArtistProfile } from '@services/api/artists';
import { sendBookingEnquiry } from '@services/client-side/emails';
import { bookingPackLines, profilePatch, publicProfile } from './artistPage';
import { useArtistHome } from '../home/ArtistShell';
import '../../venue/desk/venue-desk.css';

export function ArtistProfileEditor() {
  const data = useArtistHome();
  const profile = data?.profile;
  const [draft, setDraft] = useState(null);
  useEffect(() => {
    if (profile && !draft) {
      setDraft({
        name: profile.name || '',
        city: profile.city || '',
        bio: profile.bio || '',
        genres: (profile.genres || []).join(', '),
      });
    }
  }, [profile, draft]);
  if (!profile) return <p className="p-empty">Create your page first.</p>;
  if (!draft) return null;
  const set = (key) => (event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }));
  const save = async () => {
    try {
      await updateArtistProfile({ artistProfileId: profile.id || profile.profileId, updates: profilePatch(draft) });
      toast.success('Profile saved.');
    } catch (error) {
      console.error(error);
      toast.error('Could not save your profile.');
    }
  };
  const page = publicProfile({ ...profile, ...profilePatch(draft) });
  return (
    <div className="p-desk">
      <h1>Profile</h1>
      <section className="p-card">
        <h2>Edit</h2>
        <label>Name<input value={draft.name} onChange={set('name')} /></label>
        <label>City<input value={draft.city} onChange={set('city')} /></label>
        <label>Genres<input value={draft.genres} onChange={set('genres')} /></label>
        <label>Bio<textarea value={draft.bio} onChange={set('bio')} /></label>
        <button type="button" className="p-btn p-btn--dark" onClick={save}>Save</button>
      </section>
      <section className="p-card">
        <h2>What venues see</h2>
        <p>{page.name}</p>
        <p>{page.city}</p>
        <p>{page.bio}</p>
      </section>
      <button type="button" className="p-btn" onClick={() => window.print()}>Download booking pack</button>
      <section className="p-card">
        {bookingPackLines(profile, data?.gigs).map((line) => <p key={line}>{line}</p>)}
      </section>
    </div>
  );
}

export function ArtistEnquiryPage() {
  const { artistId } = useParams();
  const navigate = useNavigate();
  const [artist, setArtist] = useState(null);
  const [draft, setDraft] = useState({ venueName: '', bookerName: '', when: '', fee: '', message: '' });
  const [sent, setSent] = useState(false);
  useEffect(() => {
    getDoc(doc(firestore, 'artistProfiles', artistId)).then((snap) => {
      if (snap.exists()) setArtist({ id: snap.id, ...publicProfile(snap.data()) });
    }).catch((error) => console.error(error));
  }, [artistId]);
  const set = (key) => (event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }));
  const submit = async () => {
    try {
      await sendBookingEnquiry({ profileId: artistId, ...draft });
      setSent(true);
    } catch (error) {
      console.error(error);
      toast.error('Could not send that enquiry.');
    }
  };
  if (sent) {
    return (
      <div className="p-desk">
        <h1>Enquiry sent</h1>
        <p>{artist?.name || 'The artist'} has your message.</p>
        <button type="button" className="p-btn" onClick={() => navigate(-1)}>Back</button>
      </div>
    );
  }
  return (
    <div className="p-desk">
      <h1>Book {artist?.name || 'this act'}</h1>
      <label>Venue<input value={draft.venueName} onChange={set('venueName')} /></label>
      <label>Your name<input value={draft.bookerName} onChange={set('bookerName')} /></label>
      <label>Date<input value={draft.when} onChange={set('when')} /></label>
      <label>Fee<input value={draft.fee} onChange={set('fee')} /></label>
      <label>Message<textarea value={draft.message} onChange={set('message')} /></label>
      <button type="button" className="p-btn p-btn--dark" onClick={submit}>Send enquiry</button>
    </div>
  );
}
