import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { decideVenueApproval, getVenueApproval } from '@services/api/venues';
import './venue-approval.css';

export function VenueApprovalPage() {
  const { token } = useParams();
  const [details, setDetails] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    getVenueApproval(token)
      .then((data) => { if (!cancelled) setDetails(data); })
      .catch((err) => { if (!cancelled) setError(err.message || 'This approval link is not valid.'); });
    return () => { cancelled = true; };
  }, [token]);

  const decide = async (decision) => {
    setBusy(true);
    setError('');
    try {
      const result = await decideVenueApproval(token, decision);
      setDone(result.approvalStatus === 'approved' ? 'Approved. The owner has been emailed.' : 'Rejected. The owner has been emailed.');
      setDetails((prev) => ({ ...(prev || {}), approvalStatus: result.approvalStatus, state: 'used' }));
    } catch (err) {
      setError(err.message || 'That decision could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const pending = details?.approvalStatus === 'pending' && details?.state === 'ok' && !done;

  return (
    <main className="venue-approval">
      <p className="venue-approval__mark">gigin.</p>
      <h1>Venue approval</h1>
      {error ? <p className="venue-approval__error">{error}</p> : null}
      {!details && !error ? <p>Loading the venue…</p> : null}
      {details ? (
        <>
          <dl>
            <div><dt>Venue</dt><dd>{details.venueName || 'Untitled venue'}</dd></div>
            <div><dt>City</dt><dd>{details.city || '—'}</dd></div>
            <div><dt>Owner</dt><dd>{details.ownerEmail || '—'}</dd></div>
            <div><dt>Status</dt><dd>{done ? (details.approvalStatus || 'decided') : (details.state === 'expired' ? 'Link expired' : details.state === 'used' ? 'Link already used' : details.approvalStatus || 'pending')}</dd></div>
          </dl>
          {done ? <p>{done}</p> : null}
          {details.state === 'expired' ? <p>This link has expired. Approve the venue from the command line if it should still go live.</p> : null}
          {pending ? (
            <div className="venue-approval__actions">
              <button type="button" className="venue-approval__approve" disabled={busy} onClick={() => decide('approve')}>Approve</button>
              <button type="button" className="venue-approval__reject" disabled={busy} onClick={() => decide('reject')}>Reject</button>
            </div>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
