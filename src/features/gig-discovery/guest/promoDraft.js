import { isAudioAsset } from './guestAssetFiles.js';

export function promoDraftFromApplication(application) {
  const saved = application?.promo;
  if (saved?.submittedAt) {
    return {
      bio: saved.bio || '',
      photos: Array.isArray(saved.photos) ? saved.photos : [],
      trackFile: saved.track?.path ? saved.track : null,
      trackUrl: saved.track?.path ? '' : (saved.track?.url || ''),
      videoUrl: saved.videoUrl || '',
      played: saved.played || '',
      permission: true,
    };
  }
  const photos = [];
  if (application?.photo?.path || application?.photo?.url) photos.push(application.photo);
  const audio = (application?.assets || []).find((asset) => isAudioAsset(asset));
  const link = application?.links?.spotify || application?.links?.youtube || '';
  return {
    bio: application?.note || '',
    photos,
    trackFile: audio || null,
    trackUrl: audio ? '' : link,
    videoUrl: '',
    played: '',
    permission: false,
  };
}
