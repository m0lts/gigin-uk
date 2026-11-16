import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { createVenueInvite } from '@services/api/venues';
import { sendVenueInviteEmail } from '../../../services/client-side/emails';
import { PERMS_DISPLAY, hasVenuePerm, viewOnlyPermissions } from '../../../services/utils/permissions';
import './give-staff-access.css';

export function venuesTheyCanInvite(venues) {
  return (venues || []).filter((venue) => venue?.venueId && hasVenuePerm(venues, venue.venueId, 'members.invite'));
}

export function GiveStaffAccess({ user, venues }) {
  const [searchParams] = useSearchParams();
  const choices = useMemo(() => venuesTheyCanInvite(venues), [venues]);
  const selectedId = searchParams.get('venue') || '';
  const [open, setOpen] = useState(false);
  const [venueId, setVenueId] = useState('');
  const [email, setEmail] = useState('');
  const [permissions, setPermissions] = useState(viewOnlyPermissions);
  const [custom, setCustom] = useState(false);
  const [sending, setSending] = useState(false);

  if (!choices.length) return null;

  const activeId = choices.some((venue) => venue.venueId === venueId)
    ? venueId
    : (choices.find((venue) => venue.venueId === selectedId)?.venueId || choices[0].venueId);

  const openPanel = () => {
    setVenueId(choices.find((venue) => venue.venueId === selectedId)?.venueId || choices[0].venueId);
    setEmail('');
    setPermissions(viewOnlyPermissions());
    setCustom(false);
    setOpen(true);
  };

  const send = async () => {
    const address = email.trim().toLowerCase();
    if (!address || !address.includes('@')) {
      toast.error('Enter an email address.');
      return;
    }
    if (address === String(user?.email || '').trim().toLowerCase()) {
      toast.error('You cannot invite yourself.');
      return;
    }
    setSending(true);
    try {
      const invite = await createVenueInvite({
        venueId: activeId,
        email: address,
        permissionsInput: custom ? permissions : viewOnlyPermissions(),
        invitedByName: user?.name || null,
      });
      if (!invite?.inviteId) {
        toast.error('Could not create the invite.');
        return;
      }
      await sendVenueInviteEmail({ inviteId: invite.inviteId });
      toast.success('Invite sent. It expires in 7 days.');
      setOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('Could not send the invite.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button type="button" className="staff-access__open" onClick={openPanel}>Give staff access</button>
      {open ? (
        <div className="staff-access" onClick={() => !sending && setOpen(false)}>
          <div className="staff-access__card" role="dialog" aria-labelledby="staff-access-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="staff-access-title">Give staff access</h2>
            <p>They get an email to join this venue. The link expires in 7 days.</p>
            {choices.length > 1 ? (
              <label className="staff-access__field">
                <span>Venue</span>
                <select value={activeId} onChange={(event) => setVenueId(event.target.value)}>
                  {choices.map((venue) => (
                    <option key={venue.venueId} value={venue.venueId}>{venue.name || 'Venue'}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="staff-access__field">
              <span>Email</span>
              <input type="email" value={email} autoComplete="off" placeholder="name@venue.com" onChange={(event) => setEmail(event.target.value)} />
            </label>
            <div className={`staff-access__preset${custom ? '' : ' is-on'}`}>
              <strong>View only</strong>
              <span>They can see gigs, line-ups and promo, and download promo. They cannot accept, decline, edit or invite.</span>
            </div>
            <button type="button" className="staff-access__text" onClick={() => setCustom((value) => !value)}>
              {custom ? 'Use view only' : 'Change permissions'}
            </button>
            {custom ? (
              <div className="staff-access__perms">
                <button type="button" className="staff-access__text" onClick={() => setPermissions(viewOnlyPermissions())}>Reset to view only</button>
                {Object.entries(PERMS_DISPLAY).map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={!!permissions[key]}
                      onChange={() => setPermissions((current) => ({ ...current, [key]: !current[key] }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
            ) : null}
            <div className="staff-access__actions">
              <button type="button" className="staff-access__ghost" disabled={sending} onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" className="staff-access__send" disabled={sending} onClick={send}>{sending ? 'Sending…' : 'Send invite'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
