import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { getVenueProfileById } from '@services/client-side/venues';
import { venuePageUrl } from '../home/publicLinks';
import { venueNeedsApproval } from '../../../config/venueAccess';
import '../desk/venue-desk.css';

export function VenuePoster() {
  const { venueId } = useParams();
  const [venue, setVenue] = useState(null);
  const [qr, setQr] = useState('');
  useEffect(() => {
    getVenueProfileById(venueId).then(async (next) => {
      if (!next || venueNeedsApproval(next)) return;
      setVenue(next);
      setQr(await QRCode.toDataURL(venuePageUrl(venueId), { margin: 1, width: 480 }));
    }).catch((error) => console.error(error));
  }, [venueId]);
  if (!venue) return <p className="p-empty">This poster is not available.</p>;
  return (
    <div className="p-desk">
      <p className="p-muted">{venue.name}</p>
      <h1>Scan to play at {venue.name}</h1>
      {qr ? <img src={qr} alt="QR code" width="240" height="240" /> : null}
      <p>{venuePageUrl(venueId).replace(/^https?:\/\//, '')}</p>
      <button type="button" className="p-btn p-btn--dark" onClick={() => window.print()}>Download PDF</button>
    </div>
  );
}
