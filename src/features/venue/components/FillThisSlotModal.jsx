import { useState, useEffect, useCallback } from 'react';
import Portal from '@features/shared/components/Portal';
import { getArtistCRMEntries } from '@services/client-side/artistCRM';
import { getArtistProfileById } from '@services/client-side/artists';
import { updateVenueHireOpportunity } from '@services/client-side/venueHireOpportunities';
import { sendGigInviteEmail } from '@services/client-side/emails';
import { getOrCreateConversation } from '@services/api/conversations';
import { sendGigInvitationMessage } from '@services/client-side/messages';
import { hasVenuePerm } from '@services/utils/permissions';
import { formatDate } from '@services/utils/dates';
import { toast } from 'sonner';
import { LoadingSpinner } from '@features/shared/ui/loading/Loading';
import { CloseIcon, InviteIcon, TickIcon } from '@features/shared/ui/extras/Icons';
import { InviteArtistPromoterTile } from '@features/venue/components/InviteArtistPromoterTile';
import '@styles/host/invite-and-share-modal.styles.css';
import '@styles/host/venue-gig-page.styles.css';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Modal: invite artist or promoter for an unbooked venue hire (calendar / quick flow).
 */
export function FillThisSlotModal({ gig, venues = [], user, refreshGigs, onClose }) {
  const [linkCopied, setLinkCopied] = useState(false);
  const [crmEntries, setCrmEntries] = useState([]);
  const [crmLoading, setCrmLoading] = useState(false);
  const [invitingContactId, setInvitingContactId] = useState(null);
  const [invitedContactIds, setInvitedContactIds] = useState(new Set());
  const [emailInviteInput, setEmailInviteInput] = useState('');
  const [emailInviteSending, setEmailInviteSending] = useState(false);
  const [emailInviteError, setEmailInviteError] = useState('');
  const [editBookerName, setEditBookerName] = useState('');
  const [savingBooker, setSavingBooker] = useState(false);

  const hireId = gig?.id ?? gig?.gigId;
  const bookingLinkUrl =
    typeof window !== 'undefined' && hireId ? `${window.location.origin}/hire/${hireId}` : '';
  const canUpdate = gig?.venueId && hasVenuePerm(venues, gig.venueId, 'gigs.update');
  const venueForHire = venues?.find((v) => v.venueId === gig?.venueId);
  const venueDisplayName = venueForHire?.accountName || venueForHire?.name || gig?.venue?.venueName || 'this venue';
  const hireDateLabel = gig?.dateLabel || (gig?.date && formatDate(gig.date, 'short')) || (gig?.dateIso && formatDate(gig.dateIso, 'short')) || '';

  useEffect(() => {
    if (!user?.uid) return;
    setCrmLoading(true);
    getArtistCRMEntries(user.uid)
      .then((entries) => setCrmEntries(entries || []))
      .catch(() => setCrmEntries([]))
      .finally(() => setCrmLoading(false));
  }, [user?.uid]);

  const copyBookingLink = useCallback(async () => {
    if (!bookingLinkUrl) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(bookingLinkUrl);
      } else {
        const el = document.createElement('textarea');
        el.value = bookingLinkUrl;
        el.style.position = 'fixed';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
      toast.success('Link copied to clipboard');
    } catch (err) {
      console.error(err);
      toast.error("Couldn't copy link");
    }
  }, [bookingLinkUrl]);

  const inviteContactToHire = useCallback(
    async (entry) => {
      if (!bookingLinkUrl || !entry?.id) return;
      setInvitingContactId(entry.id);
      try {
        if (entry.artistId) {
          const artistProfile = await getArtistProfileById(entry.artistId);
          if (!artistProfile) {
            toast.error('Artist profile not found.');
            return;
          }
          const musicianProfile = {
            musicianId: artistProfile.id,
            id: artistProfile.id,
            name: artistProfile.name,
            genres: artistProfile.genres || [],
            musicianType: 'Musician/Band',
            musicType: artistProfile.genres || [],
            bandProfile: false,
            userId: artistProfile.userId,
          };
          const gigDataForConv = { ...gig, gigId: hireId, itemType: 'venue_hire' };
          const { conversationId } = await getOrCreateConversation({
            musicianProfile,
            gigData: gigDataForConv,
            venueProfile: venueForHire,
            type: 'invitation',
          });
          const messageText = `${venueDisplayName} invited you to apply to their venue hire on ${hireDateLabel} at ${venueDisplayName}.`;
          await sendGigInvitationMessage(conversationId, { senderId: user.uid, text: messageText });
          setInvitedContactIds((prev) => new Set(prev).add(entry.id));
          toast.success(`Gigin invite sent to ${artistProfile.name}`);
          refreshGigs?.();
          return;
        }

        const email = (entry.email || '').trim();
        if (!email) {
          toast.error('This contact has no email. Add one in My Contacts.');
          return;
        }
        await sendGigInviteEmail({
          gigId: gig?.gigId,
          crmEntryId: entry.id,
          artistName: entry.name,
        });
        setInvitedContactIds((prev) => new Set(prev).add(entry.id));
        toast.success(`Invitation sent to ${entry.name || email}`);
        refreshGigs?.();
      } catch (err) {
        console.error(err);
        toast.error('Failed to send invitation.');
      } finally {
        setInvitingContactId(null);
      }
    },
    [bookingLinkUrl, gig, hireId, hireDateLabel, user?.uid, user?.name, venueForHire, venueDisplayName, refreshGigs]
  );

  const sendInviteByEmail = useCallback(async () => {
    const email = (emailInviteInput || '').trim().toLowerCase();
    if (!email) {
      setEmailInviteError('Enter an email address.');
      return;
    }
    if (!emailRegex.test(email)) {
      setEmailInviteError('Enter a valid email address.');
      return;
    }
    if (!bookingLinkUrl) return;
    setEmailInviteError('');
    setEmailInviteSending(true);
    try {
      await sendGigInviteEmail({
        gigId: gig?.gigId,
        email,
        artistName: email,
      });
      toast.success(`Invitation sent to ${email}`);
      setEmailInviteInput('');
      refreshGigs?.();
    } catch (err) {
      console.error(err);
      toast.error('Failed to send invitation.');
    } finally {
      setEmailInviteSending(false);
    }
  }, [emailInviteInput, bookingLinkUrl, hireDateLabel, user?.name, venueForHire?.accountName, venueDisplayName, refreshGigs]);

  const handleSaveBooker = useCallback(async () => {
    const name = (editBookerName || '').trim();
    if (!hireId || !canUpdate) return;
    setSavingBooker(true);
    try {
      await updateVenueHireOpportunity(hireId, { hirerName: name || null });
      toast.success(name ? 'Hirer updated.' : 'Hirer cleared.');
      refreshGigs?.();
      onClose?.();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update.');
    } finally {
      setSavingBooker(false);
    }
  }, [hireId, canUpdate, editBookerName, refreshGigs, onClose]);

  if (!gig || !hireId) return null;

  return (
    <Portal>
      <div
        className="modal cancel-gig invite-and-share-modal"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fill-this-slot-modal-title"
      >
      <div className="modal-content invite-and-share-modal__content" onClick={(e) => e.stopPropagation()}>
        <div className="invite-and-share-modal__header">
          <h2 id="fill-this-slot-modal-title" className="invite-and-share-modal__title">
            Invite artist or promoter
          </h2>
          <button
            type="button"
            className="btn icon invite-and-share-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="invite-and-share-modal__body">
          <InviteArtistPromoterTile
            showHeader={false}
            bookingLinkUrl={bookingLinkUrl}
            onCopyLink={copyBookingLink}
            linkCopied={linkCopied}
            showManualOption={canUpdate}
            contactsBody={(
              <div className="invite-and-share-modal__list fill-this-slot__contacts-list">
                {crmLoading ? (
                  <LoadingSpinner />
                ) : !crmEntries?.length ? (
                  <p className="invite-and-share-modal__empty">No contacts yet. Add contacts in My Contacts.</p>
                ) : (
                  crmEntries.map((entry) => {
                    const invited = invitedContactIds.has(entry.id);
                    const inviting = invitingContactId === entry.id;
                    return (
                      <div key={entry.id} className="invite-and-share-modal__row">
                        <div className="invite-and-share-modal__row-info">
                          <span className="invite-and-share-modal__row-name">{entry.name || 'Unknown'}</span>
                          <span className="invite-and-share-modal__row-sub">
                            {entry.artistId ? 'On Gigin' : entry.email || 'No email'}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn tertiary invite-and-share-modal__row-btn"
                          onClick={() => inviteContactToHire(entry)}
                          disabled={invited || inviting}
                        >
                          {invited ? <><TickIcon /> Invited</> : inviting ? 'Inviting…' : 'Invite'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
            emailBody={(
              <>
                <div className="fill-this-slot__share-row">
                  <input
                    type="email"
                    className="input fill-this-slot__input"
                    placeholder="Email address"
                    value={emailInviteInput}
                    onChange={(e) => { setEmailInviteInput(e.target.value); setEmailInviteError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && sendInviteByEmail()}
                    aria-label="Email address"
                    aria-invalid={!!emailInviteError}
                  />
                  <button
                    type="button"
                    className="btn secondary fill-this-slot__copy-btn"
                    onClick={sendInviteByEmail}
                    disabled={emailInviteSending}
                  >
                    {emailInviteSending ? 'Sending…' : <><InviteIcon /> Invite</>}
                  </button>
                </div>
                {emailInviteError ? (
                  <p className="fill-this-slot__helper fill-this-slot__helper--above-input" style={{ color: 'var(--gn-red-800)', marginTop: 6 }}>
                    {emailInviteError}
                  </p>
                ) : null}
              </>
            )}
            manualBody={canUpdate ? (
              <div className="fill-this-slot__share-row">
                <input
                  type="text"
                  className="input fill-this-slot__input"
                  placeholder="Booker or hirer name"
                  value={editBookerName}
                  onChange={(e) => setEditBookerName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveBooker()}
                  aria-label="Booker name"
                />
                <button
                  type="button"
                  className="btn secondary fill-this-slot__copy-btn"
                  onClick={handleSaveBooker}
                  disabled={savingBooker}
                >
                  {savingBooker ? 'Saving…' : 'Save'}
                </button>
              </div>
            ) : null}
          />
        </div>
      </div>
    </div>
    </Portal>
  );
}
