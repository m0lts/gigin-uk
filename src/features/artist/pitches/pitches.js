const ORDER = ['sent', 'replied', 'follow-up'];

export function pitchBody({ venueName, artistName, bio, link }) {
  return [`Hi ${venueName || 'there'},`, '', bio || 'I would like to play.', '', link || '', '', artistName || ''].join('\n').trim();
}

export function pitchMailto({ email, venueName, artistName, bio, link }) {
  const subject = encodeURIComponent(`Playing at ${venueName || 'your venue'}`);
  const body = encodeURIComponent(pitchBody({ venueName, artistName, bio, link }));
  return `mailto:${email}?subject=${subject}&body=${body}`;
}

export function cyclePitchStatus(status) {
  const index = ORDER.indexOf(status);
  return ORDER[(index + 1) % ORDER.length] || 'sent';
}
