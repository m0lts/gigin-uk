import { Link } from 'react-router-dom';
import { photoUrl } from './guestFormat';

export function GuestBrandHeader({ venue, note }) {
  const photo = photoUrl(venue);
  const name = venue?.name || '';
  const initials = String(name || 'G').slice(0, 2).toUpperCase();

  return (
    <header className="ga-top ga-brandbar">
      <Link to="/" className="ga-logo" aria-label="Gigin">gigin<b>.</b></Link>
      {venue ? (
        <span className="ga-brandbar__venue">
          {photo
            ? <img src={photo} alt="" />
            : <span className="ga-brand__mark" aria-hidden="true">{initials}</span>}
          {name ? <span>{name}</span> : null}
        </span>
      ) : null}
      {note ? <span className="ga-brandbar__note">{note}</span> : null}
    </header>
  );
}
