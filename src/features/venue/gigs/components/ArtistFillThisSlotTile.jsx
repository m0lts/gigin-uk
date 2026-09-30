import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@hooks/useAuth';
import { toast } from 'sonner';
import { getArtistCRMEntries } from '@services/client-side/artistCRM';
import { getArtistProfileById } from '@services/client-side/artists';
import { inviteToGig } from '@services/api/gigs';
import { updateGigDocument } from '@services/api/gigs';
import { getOrCreateConversation } from '@services/api/conversations';
import { sendGigInvitationMessage } from '@services/client-side/messages';
import { sendGigInviteEmail } from '@services/client-side/emails';
import { formatDate } from '@services/utils/dates';
import { hasVenuePerm } from '@services/utils/permissions';
import { LoadingSpinner } from '@features/shared/ui/loading/Loading';
import { InviteIcon, TickIcon } from '@features/shared/ui/extras/Icons';
import { InviteArtistPromoterTile } from '@features/venue/components/InviteArtistPromoterTile';
import '@styles/host/invite-and-share-modal.styles.css';
import '@styles/host/venue-gig-page.styles.css';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ArtistFillThisSlotTile({
  gig,
  venues = [],
  refreshGigs,
  initialPopup = null,
  hideInlineShareButton = false,
  submodalOnly = false,
  onPopupClose,
  showManualOption = true,
}) {
  const { user } = useAuth();
  const [linkCopied, setLinkCopied] = useState(false);
  const [crmEntries, setCrmEntries] = useState([]);
  const [crmLoading, setCrmLoading] = useState(false);
  const [invitingContactId, setInvitingContactId] = useState(null);
  const [invitedContactIds, setInvitedContactIds] = useState(new Set());
  const [emailInviteInput, setEmailInviteInput] = useState('');
  const [emailInviteSending, setEmailInviteSending] = useState(false);
  const [emailInviteError, setEmailInviteError] = useState('');
  const [manualArtistName, setManualArtistName] = useState('');
  const [savingManualArtist, setSavingManualArtist] = useState(false);

  const gigId = gig?.gigId;
  const bookingLinkUrl = gigId && typeof window !== 'undefined' ? `${window.location.origin}/gig/${gigId}` : '';
  const canInvite = gig?.venueId ? hasVenuePerm(venues, gig.venueId, 'gigs.invite') : false;
  const canManageApplications = gig?.venueId ? hasVenuePerm(venues, gig.venueId, 'gigs.applications.manage') : false;
  const venueProfile = venues.find((v) => v.venueId === gig?.venueId);
  const venueDisplayName = venueProfile?.accountName || venueProfile?.name || gig?.venue?.venueName || 'this venue';
  const gigDateLabel = gig?.date ? formatDate(gig.date, 'short') : '';

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
      await navigator.clipboard.writeText(bookingLinkUrl);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
      toast.success('Link copied to clipboard');
    } catch (err) {
      console.error(err);
      toast.error("Couldn't copy link");
    }
  }, [bookingLinkUrl]);

  const inviteContactToGig = useCallback(async (entry) => {
    if (!entry?.id || !gigId || !canInvite) return;
    setInvitingContactId(entry.id);
    try {
      if (entry.artistId) {
        const artistProfile = await getArtistProfileById(entry.artistId);
        if (!artistProfile) {
          toast.error('Artist profile not found.');
          return;
        }
        const musicianProfilePayload = {
          musicianId: artistProfile.id,
          id: artistProfile.id,
          name: artistProfile.name,
          genres: artistProfile.genres || [],
          musicianType: 'Musician/Band',
          musicType: artistProfile.genres || [],
          bandProfile: false,
          userId: artistProfile.userId,
        };
        const res = await inviteToGig({ gigId, musicianProfile: musicianProfilePayload });
        if (!res?.success) {
          toast.error('Failed to invite artist.');
          return;
        }
        const { conversationId } = await getOrCreateConversation({
          musicianProfile: musicianProfilePayload,
          gigData: gig,
          venueProfile,
          type: 'invitation',
        });
        const hasFee = gig?.budget && gig.budget !== '£' && gig.budget !== '£0';
        const messageText = `${venueDisplayName} invited ${artistProfile.name} to play at their gig on ${gigDateLabel}${hasFee ? ` for ${gig.budget}` : ''}.`;
        await sendGigInvitationMessage(conversationId, { senderId: user.uid, text: messageText });
        toast.success(`Invite sent to ${artistProfile.name}`);
      } else {
        const email = (entry.email || '').trim();
        if (!email) {
          toast.error('This contact has no email. Add one in My Contacts.');
          return;
        }
        await sendGigInviteEmail({
          to: email,
          userName: user?.name || venueDisplayName,
          venueName: gig?.venue?.venueName || venueDisplayName,
          date: gigDateLabel,
          gigLink: bookingLinkUrl,
          expiresAt: null,
        });
        toast.success(`Invitation sent to ${entry.name || email}`);
      }
      setInvitedContactIds((prev) => new Set(prev).add(entry.id));
      refreshGigs?.();
    } catch (err) {
      console.error(err);
      toast.error('Failed to send invitation.');
    } finally {
      setInvitingContactId(null);
    }
  }, [gigId, canInvite, gig, venueProfile, venueDisplayName, gigDateLabel, user?.uid, user?.name, bookingLinkUrl, refreshGigs]);

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
    if (!canInvite) {
      toast.error('You do not have permission to invite artists.');
      return;
    }
    setEmailInviteError('');
    setEmailInviteSending(true);
    try {
      await sendGigInviteEmail({
        to: email,
        userName: user?.name || venueDisplayName,
        venueName: gig?.venue?.venueName || venueDisplayName,
        date: gigDateLabel,
        gigLink: bookingLinkUrl,
        expiresAt: null,
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
  }, [emailInviteInput, canInvite, user?.name, venueDisplayName, gig?.venue?.venueName, gigDateLabel, bookingLinkUrl, refreshGigs]);

  const saveManualArtist = useCallback(async () => {
    const name = (manualArtistName || '').trim();
    if (!name) {
      toast.error('Enter an artist name.');
      return;
    }
    if (!canManageApplications) {
      toast.error('You do not have permission to manage applications.');
      return;
    }
    setSavingManualArtist(true);
    try {
      const existingApplicants = Array.isArray(gig?.applicants) ? gig.applicants : [];
      const updatedApplicants = existingApplicants.map((app) =>
        ['confirmed', 'accepted', 'paid'].includes(app?.status) ? { ...app, status: 'declined' } : app
      );
      updatedApplicants.push({
        id: `manual-${Date.now()}`,
        name,
        artistName: name,
        status: 'confirmed',
        sentBy: 'venue',
        manual: true,
      });
      await updateGigDocument({
        gigId,
        action: 'gigs.update',
        updates: { applicants: updatedApplicants },
      });
      toast.success('Artist added manually.');
      setManualArtistName('');
      refreshGigs?.();
    } catch (err) {
      console.error(err);
      toast.error('Failed to add artist manually.');
    } finally {
      setSavingManualArtist(false);
    }
  }, [manualArtistName, canManageApplications, gig?.applicants, gigId, refreshGigs]);

  if (!gigId) return null;

  return (
    <div className="venue-hire-confirmed-card venue-hire-confirmed-panel__booked-by venue-hire-confirmed-panel__booked-by--invite-promoter">
      <InviteArtistPromoterTile
        bookingLinkUrl={bookingLinkUrl}
        onCopyLink={copyBookingLink}
        linkCopied={linkCopied}
        linkHelperText="Send this link to artists who would be interested in this slot."
        manualPopupTitle="Confirm manually"
        showManualOption={showManualOption}
        initialPopup={initialPopup}
        hideInlineShareButton={hideInlineShareButton}
        submodalOnly={submodalOnly}
        onPopupClose={onPopupClose}
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
                      onClick={() => inviteContactToGig(entry)}
                      disabled={invited || inviting || !canInvite}
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
                disabled={emailInviteSending || !canInvite}
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
        manualBody={(
          <div className="fill-this-slot__share-row">
            <input
              type="text"
              className="input fill-this-slot__input"
              placeholder="Artist name"
              value={manualArtistName}
              onChange={(e) => setManualArtistName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveManualArtist()}
              aria-label="Artist name"
            />
            <button
              type="button"
              className="btn secondary fill-this-slot__copy-btn"
              onClick={saveManualArtist}
              disabled={savingManualArtist || !canManageApplications}
            >
              {savingManualArtist ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      />
    </div>
  );
}
