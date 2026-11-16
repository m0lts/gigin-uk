import { isAudioAsset } from './guestAssetFiles.js';

function lineupOf(application) {
  const members = Array.isArray(application?.members) ? application.members : [];
  return members.length ? members.map((member) => ({
    name: member?.name || '',
    instruments: Array.isArray(member?.instruments) ? member.instruments : [],
  })) : [{ name: '', instruments: [] }];
}

export function promoDraftFromApplication(application) {
  const saved = application?.promo;
  const lineup = {
    members: lineupOf(application),
    soundNote: application?.soundNote || '',
  };
  if (saved?.submittedAt) {
    return {
      ...lineup,
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
    ...lineup,
    bio: application?.note || '',
    photos,
    trackFile: audio || null,
    trackUrl: audio ? '' : link,
    videoUrl: '',
    played: '',
    permission: false,
  };
}
