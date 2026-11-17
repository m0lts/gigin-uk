import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { createArtistProfileDocument, updateArtistProfileDocument } from '@services/client-side/artists';
import { uploadFileToStorage } from '@services/storage';
import { canAdvance, nextStep, profileFromDraft } from './artistJoin';
import '../../venue/desk/venue-desk.css';

export function ArtistJoin({ user }) {
  const navigate = useNavigate();
  const [step, setStep] = useState('start');
  const [draft, setDraft] = useState({ name: user?.name || '', city: '', genres: '', link: '', bio: '' });
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const set = (key) => (event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }));

  const go = async () => {
    if (!canAdvance(step, draft)) return;
    if (step !== 'photo') {
      setStep(nextStep(step));
      return;
    }
    if (!user?.uid) {
      toast.error('Sign in first, then finish your page.');
      return;
    }
    setSaving(true);
    try {
      const profileId = `artist-${user.uid.slice(0, 8)}`;
      await createArtistProfileDocument({
        profileId,
        userId: user.uid,
        initialData: profileFromDraft(draft),
        userData: { name: draft.name, email: user.email },
      });
      if (photoFile) {
        const photoUrl = await uploadFileToStorage(photoFile, `artistProfiles/${profileId}/photo-${Date.now()}`);
        await updateArtistProfileDocument(profileId, { photoUrl });
      }
      setStep('live');
    } catch (error) {
      console.error(error);
      toast.error('Could not create your page.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-desk">
      {step === 'start' ? (
        <section className="p-card">
          <h1>Your artist page</h1>
          <p>Venues book you from one page. It takes a few minutes.</p>
          <label>Your name<input value={draft.name} onChange={set('name')} /></label>
        </section>
      ) : null}
      {step === 'about' ? (
        <section className="p-card">
          <h1>About you</h1>
          <label>City<input value={draft.city} onChange={set('city')} /></label>
          <label>Genres, separated by commas<input value={draft.genres} onChange={set('genres')} /></label>
        </section>
      ) : null}
      {step === 'music' ? (
        <section className="p-card">
          <h1>Your music</h1>
          <label>A link venues can play<input value={draft.link} onChange={set('link')} /></label>
        </section>
      ) : null}
      {step === 'photo' ? (
        <section className="p-card">
          <h1>Photo and bio</h1>
          <label>Photo
            <input type="file" accept="image/*" onChange={(event) => {
              const file = event.target.files?.[0] || null;
              setPhotoFile(file);
              setPhotoPreview(file ? URL.createObjectURL(file) : '');
            }} />
          </label>
          {photoPreview ? <img src={photoPreview} alt="" width="120" height="120" /> : null}
          <label>Bio<textarea value={draft.bio} onChange={set('bio')} /></label>
        </section>
      ) : null}
      {step === 'live' ? (
        <section className="p-card">
          <h1>Your page is live</h1>
          <button type="button" className="p-btn p-btn--dark" onClick={() => navigate('/home')}>Go to your dashboard</button>
        </section>
      ) : (
        <button type="button" className="p-btn p-btn--dark" disabled={!canAdvance(step, draft) || saving} onClick={go}>{saving ? 'Saving' : 'Continue'}</button>
      )}
    </div>
  );
}
