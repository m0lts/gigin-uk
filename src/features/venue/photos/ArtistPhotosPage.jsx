import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { arrayUnion, doc, getDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { firestore } from '@lib/firebase';
import { useAuth } from '@hooks/useAuth';
import { ArtistSetPhotos } from './GigPhotosPage';

export function ArtistPhotosPage() {
  const { gigId } = useParams();
  const { user } = useAuth();
  const [gig, setGig] = useState(null);
  const [venueName, setVenueName] = useState('');

  useEffect(() => {
    if (!gigId) return undefined;
    let live = true;
    getDoc(doc(firestore, 'gigs', gigId)).then(async (snap) => {
      if (!live || !snap.exists()) return;
      const data = { gigId: snap.id, ...snap.data() };
      setGig(data);
      if (data.venueId) {
        const venue = await getDoc(doc(firestore, 'venueProfiles', data.venueId));
        if (live && venue.exists()) setVenueName(venue.data()?.name || '');
      }
    }).catch((error) => console.error(error));
    return () => { live = false; };
  }, [gigId]);

  const save = async (chosen) => {
    const profileId = user?.artistProfiles?.[0]?.id || user?.artistProfiles?.[0] || user?.artistProfileIds?.[0];
    if (!profileId) {
      toast.error('Sign in with the artist account that played this set.');
      return;
    }
    try {
      await updateDoc(doc(firestore, 'artistProfiles', profileId), {
        gigPhotos: arrayUnion(...chosen.map((photo) => photo.url).filter(Boolean)),
      });
      toast.success('Added to your profile.');
    } catch (error) {
      console.error(error);
      toast.error('Could not add these to your profile.');
    }
  };

  if (!gig) return <p className="p-empty">Loading photos.</p>;
  return <ArtistSetPhotos gig={gig} venueName={venueName} onSave={save} />;
}
