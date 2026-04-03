import { useState, useEffect, useCallback } from 'react';
import Portal from '../../shared/components/Portal';
import { CloseIcon, LinkIcon, TickIcon } from '../../shared/ui/extras/Icons';
import { toast } from 'sonner';
import { formatDate } from '@services/utils/dates';
import { getArtistCRMEntries } from '@services/client-side/artistCRM';
import { getArtistProfileById } from '@services/client-side/artists';
import { fetchArtistsPaginated } from '@services/client-side/artists';
import { inviteToGig } from '@services/api/gigs';
import { createGigInvite } from '@services/api/gigInvites';
import { getOrCreateConversation } from '@services/api/conversations';
import { sendGigInvitationMessage } from '@services/client-side/messages';
import { sendGigInviteEmail } from '@services/client-side/emails';
import { LoadingSpinner } from '../../shared/ui/loading/Loading';
import '@styles/host/invite-and-share-modal.styles.css';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function parseEmails(str) {
  if (!str || typeof str !== 'string') return [];
  return str
    .split(/[\s,\n]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
function validateEmail(email) {
  return EMAIL_REGEX.test(email);
}

function getGigLink(gig, inviteId = null) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const base = `${origin}/gig/${gig.gigId}`;
  if (gig.private && inviteId) return `${base}?inviteId=${inviteId}`;
  return base;
}

export function InviteAndShareModal({ gig, venues, user, onClose, refreshGigs }) {
  const [activeTab, setActiveTab] = useState('crm');
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const [crmArtists, setCrmArtists] = useState([]);
  const [crmSearch, setCrmSearch] = useState('');
  const [crmLoading, setCrmLoading] = useState(false);
  const [invitedCrmIds, setInvitedCrmIds] = useState(new Set());
  const [invitingCrmId, setInvitingCrmId] = useState(null);

  const [giginArtists, setGiginArtists] = useState([]);
  const [giginSearch, setGiginSearch] = useState('');
  const [giginLoading, setGiginLoading] = useState(false);
  const [giginLastDocId, setGiginLastDocId] = useState(null);
  const [giginHasMore, setGiginHasMore] = useState(true);
  const [invitedGiginIds, setInvitedGiginIds] = useState(new Set());
  const [invitingGiginId, setInvitingGiginId] = useState(null);

  const venue = venues?.find((v) => v.venueId === gig?.venueId);
  const isPrivate = !!gig?.private;
  const gigUrl = gig ? getGigLink(gig) : '';

  const loadCrm = useCallback(async () => {
    if (!user?.uid) return;
    setCrmLoading(true);
    try {
      const entries = await getArtistCRMEntries(user.uid);
      setCrmArtists(entries || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load artists');
    } finally {
      setCrmLoading(false);
    }
  }, [user?.uid]);

  const loadGigin = useCallback(
    async (reset = false) => {
      setGiginLoading(true);
      try {
        const { artists, lastDocId } = await fetchArtistsPaginated({
          lastDocId: reset ? null : giginLastDocId,
          limitCount: 30,
          search: giginSearch.trim(),
        });
        setGiginArtists((prev) => (reset ? artists : [...prev, ...artists]));
        setGiginLastDocId(lastDocId);
        setGiginHasMore(artists.length >= 30);
      } catch (err) {
        console.error(err);
        toast.error('Failed to search artists');
      } finally {
        setGiginLoading(false);
      }
    },
    [giginSearch, giginLastDocId]
  );

  useEffect(() => {
    if (activeTab === 'crm') loadCrm();
  }, [activeTab, loadCrm]);

  useEffect(() => {
    if (activeTab === 'gigin') {
      setGiginArtists([]);
      setGiginLastDocId(null);
      setGiginHasMore(true);
      loadGigin(true);
    }
  }, [activeTab]);

  const handleInviteByEmail = async () => {
    const emails = parseEmails(emailInput);
    if (!emails.length) {
      setEmailError('Enter at least one email address.');
      return;
    }
    const invalid = emails.filter((e) => !validateEmail(e));
    if (invalid.length) {
      setEmailError(`Invalid email${invalid.length > 1 ? 's' : ''}: ${invalid.slice(0, 3).join(', ')}${invalid.length > 3 ? '…' : ''}`);
      return;
    }
    setEmailError('');
    setSendingEmail(true);
    const userName = user?.name || venue?.accountName || 'The venue';
    const venueName = gig?.venue?.venueName || venue?.name || 'the venue';
    const gigDate = gig?.date ?? gig?.dateIso;
    const formattedDate = gigDate ? formatDate(gigDate, 'short') : '';

    try {
      for (const email of emails) {
        let link = getGigLink(gig);
        if (isPrivate) {
          const res = await createGigInvite({ gigId: gig.gigId, artistName: email });
          const inviteId = res?.inviteId ?? res?.data?.inviteId;
          if (inviteId) link = getGigLink(gig, inviteId);
        }
        await sendGigInviteEmail({
          to: email,
          userName,
          venueName,
          date: formattedDate,
          gigLink: link,
          expiresAt: null,
        });
      }
      toast.success(emails.length === 1 ? 'Invitation sent.' : `${emails.length} invitations sent.`);
      setEmailInput('');
      refreshGigs?.();
    } catch (err) {
      console.error(err);
      toast.error('Failed to send invite email(s).');
    } finally {
      setSendingEmail(false);
    }
  };

  const inviteCrmArtist = async (artist) => {
    if (!gig || !venue || !user) return;
    setInvitingCrmId(artist.id);
    try {
      if (artist.artistId) {
        let inviteId = null;
        if (isPrivate) {
          const res = await createGigInvite({ gigId: gig.gigId, artistId: artist.artistId });
          inviteId = res?.inviteId ?? res?.data?.inviteId;
        }
        const artistProfile = await getArtistProfileById(artist.artistId);
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
        const res = await inviteToGig({ gigId: gig.gigId, musicianProfile });
        if (!res?.success) {
          if (res?.code === 'permission-denied') toast.error("You don't have permission to invite for this venue.");
          else if (res?.code === 'failed-precondition') toast.error('This gig is missing required venue info.');
          else toast.error('Error inviting artist.');
          return;
        }
        const { conversationId } = await getOrCreateConversation({
          musicianProfile,
          gigData: gig,
          venueProfile: venue,
          type: 'invitation',
        });
        const gigLink = getGigLink(gig, inviteId);
        const hasFee = gig.budget && gig.budget !== '£' && gig.budget !== '£0';
        const messageText = `${venue.accountName} invited ${artistProfile.name} to play at their gig at ${gig.venue?.venueName || venue.name} on the ${formatDate(gig.date ?? gig.dateIso)}${hasFee ? ` for ${gig.budget}` : ''}.`;
        await sendGigInvitationMessage(conversationId, { senderId: user.uid, text: messageText });
        toast.success(`Invite sent to ${artistProfile.name}`);
      } else {
        const artistEmail = artist.email?.trim();
        if (!artistEmail) {
          toast.error('This artist has no email in My Artists.');
          return;
        }
        let inviteId = null;
        if (isPrivate) {
          const res = await createGigInvite({ gigId: gig.gigId, crmEntryId: artist.id, artistName: artist.name });
          inviteId = res?.inviteId ?? res?.data?.inviteId;
        }
        const link = getGigLink(gig, inviteId);
        await sendGigInviteEmail({
          to: artistEmail,
          userName: user.name || venue.accountName,
          venueName: gig.venue?.venueName || venue.name,
          date: formatDate(gig.date ?? gig.dateIso, 'short'),
          gigLink: link,
          expiresAt: null,
        });
        toast.success(`Invitation email sent to ${artist.name || artistEmail}`);
      }
      setInvitedCrmIds((prev) => new Set(prev).add(artist.id));
      refreshGigs?.();
    } catch (err) {
      console.error(err);
      toast.error('Error inviting artist.');
    } finally {
      setInvitingCrmId(null);
    }
  };

  const inviteGiginArtist = async (artist) => {
    if (!gig || !venue || !user) return;
    setInvitingGiginId(artist.id);
    try {
      let inviteId = null;
      if (isPrivate) {
        const res = await createGigInvite({ gigId: gig.gigId, artistId: artist.id });
        inviteId = res?.inviteId ?? res?.data?.inviteId;
      }
      const musicianProfile = {
        musicianId: artist.id,
        id: artist.id,
        name: artist.name,
        genres: artist.genres || [],
        musicianType: artist.artistType || 'Musician/Band',
        musicType: artist.genres || [],
        bandProfile: false,
        userId: artist.userId,
      };
      const res = await inviteToGig({ gigId: gig.gigId, musicianProfile });
      if (!res?.success) {
        if (res?.code === 'permission-denied') toast.error("You don't have permission to invite for this venue.");
        else if (res?.code === 'failed-precondition') toast.error('This gig is missing required venue info.');
        else toast.error('Error inviting artist.');
        return;
      }
      const { conversationId } = await getOrCreateConversation({
        musicianProfile,
        gigData: gig,
        venueProfile: venue,
        type: 'invitation',
      });
      const gigLink = getGigLink(gig, inviteId);
      const hasFee = gig.budget && gig.budget !== '£' && gig.budget !== '£0';
      const messageText = `${venue.accountName} invited ${artist.name} to play at their gig at ${gig.venue?.venueName || venue.name} on the ${formatDate(gig.date ?? gig.dateIso)}${hasFee ? ` for ${gig.budget}` : ''}.`;
      await sendGigInvitationMessage(conversationId, { senderId: user.uid, text: messageText });
      toast.success(`Invite sent to ${artist.name}`);
      setInvitedGiginIds((prev) => new Set(prev).add(artist.id));
      refreshGigs?.();
    } catch (err) {
      console.error(err);
      toast.error('Error inviting artist.');
    } finally {
      setInvitingGiginId(null);
    }
  };

  const copyLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(gigUrl);
      } else {
        const el = document.createElement('textarea');
        el.value = gigUrl;
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
  };

  const filteredCrm = crmSearch.trim()
    ? crmArtists.filter((a) => (a.name || '').toLowerCase().includes(crmSearch.trim().toLowerCase()))
    : crmArtists;

  const filteredGigin = giginSearch.trim()
    ? giginArtists.filter((a) => (a.name || '').toLowerCase().includes(giginSearch.trim().toLowerCase()))
    : giginArtists;

  if (!gig) return null;

  return (
    <Portal>
      <div
        className="invite-and-share-modal modal cancel-gig"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-and-share-title"
      >
        <div className="invite-and-share-modal__content modal-content" onClick={(e) => e.stopPropagation()}>
          <header className="invite-and-share-modal__header">
            <h2 id="invite-and-share-title" className="invite-and-share-modal__title">
              Invite artist(s)
            </h2>
            <button type="button" className="invite-and-share-modal__close" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </header>

          <div className="invite-and-share-modal__body">
            <div className="invite-and-share-modal__scroll">
              {/* 1. Invite by link */}
              <section className="invite-and-share-modal__section">
                <h3 className="invite-and-share-modal__section-title">Invite by link</h3>
                <div className="invite-and-share-modal__section-content">
                  <div className="invite-and-share-modal__share-row">
                    <input
                      type="text"
                      className="input invite-and-share-modal__share-input"
                      value={gigUrl}
                      readOnly
                      onFocus={(e) => e.target.select()}
                      aria-label="Gig link"
                    />
                    <button
                      type="button"
                      className="btn secondary invite-and-share-modal__copy-btn"
                      onClick={copyLink}
                    >
                      {linkCopied ? <TickIcon /> : <LinkIcon />} {linkCopied ? 'Copied' : 'Copy link'}
                    </button>
                  </div>
                  <p className="invite-and-share-modal__share-explainer">
                    Copy this link and send it to artists via WhatsApp, message, or email.
                  </p>
                </div>
              </section>

              {/* 2. Invite on Gigin */}
              <section className="invite-and-share-modal__section">
                <h3 className="invite-and-share-modal__section-title">Invite on Gigin</h3>
                <div className="invite-and-share-modal__section-content">
                  <div className="invite-and-share-modal__tabs">
                    <button
                      type="button"
                      className={`invite-and-share-modal__tab ${activeTab === 'crm' ? 'invite-and-share-modal__tab--active' : ''}`}
                      onClick={() => setActiveTab('crm')}
                    >
                      My Artists
                    </button>
                    <button
                      type="button"
                      className={`invite-and-share-modal__tab ${activeTab === 'gigin' ? 'invite-and-share-modal__tab--active' : ''}`}
                      onClick={() => setActiveTab('gigin')}
                    >
                      Find Artists
                    </button>
                  </div>
                  <div className="invite-and-share-modal__picker">
                    {activeTab === 'crm' && (
                <>
                  <input
                    type="search"
                    className="input invite-and-share-modal__search"
                    placeholder="Search my artists…"
                    value={crmSearch}
                    onChange={(e) => setCrmSearch(e.target.value)}
                    aria-label="Search My Artists"
                  />
                  <div className="invite-and-share-modal__list">
                    {crmLoading ? (
                      <LoadingSpinner />
                    ) : filteredCrm.length === 0 ? (
                      <p className="invite-and-share-modal__empty">No artists found.</p>
                    ) : (
                      filteredCrm.map((artist) => {
                        const invited = invitedCrmIds.has(artist.id);
                        const inviting = invitingCrmId === artist.id;
                        return (
                          <div key={artist.id} className="invite-and-share-modal__row">
                            <div className="invite-and-share-modal__row-info">
                              <span className="invite-and-share-modal__row-name">{artist.name || 'Unknown'}</span>
                              <span className="invite-and-share-modal__row-sub">
                                {artist.artistId ? 'On Gigin' : artist.email || 'No email'}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="btn tertiary invite-and-share-modal__row-btn"
                              onClick={() => inviteCrmArtist(artist)}
                              disabled={invited || inviting}
                            >
                              {invited ? <><TickIcon /> Invited</> : inviting ? 'Inviting…' : 'Invite'}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
              {activeTab === 'gigin' && (
                <>
                  <input
                    type="search"
                    className="input invite-and-share-modal__search"
                    placeholder="Search artists by name…"
                    value={giginSearch}
                    onChange={(e) => setGiginSearch(e.target.value)}
                    aria-label="Search Gigin database"
                  />
                  <div className="invite-and-share-modal__list">
                    {giginLoading && giginArtists.length === 0 ? (
                      <LoadingSpinner />
                    ) : filteredGigin.length === 0 ? (
                      <p className="invite-and-share-modal__empty">
                        {giginArtists.length === 0
                          ? 'No artists loaded.'
                          : giginSearch.trim()
                            ? 'No artists match your search.'
                            : 'Enter a name to filter.'}
                      </p>
                    ) : (
                      filteredGigin.map((artist) => {
                        const invited = invitedGiginIds.has(artist.id);
                        const inviting = invitingGiginId === artist.id;
                        return (
                          <div key={artist.id} className="invite-and-share-modal__row">
                            <div className="invite-and-share-modal__row-info">
                              <span className="invite-and-share-modal__row-name">{artist.name || 'Unknown'}</span>
                              <span className="invite-and-share-modal__row-sub">
                                {artist.genres?.slice(0, 2).join(', ') || 'Artist'}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="btn tertiary invite-and-share-modal__row-btn"
                              onClick={() => inviteGiginArtist(artist)}
                              disabled={invited || inviting}
                            >
                              {invited ? <><TickIcon /> Invited</> : inviting ? 'Inviting…' : 'Invite'}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
                  </div>
                </div>
              </section>

              {/* 3. Invite by email */}
              <section className="invite-and-share-modal__section">
                <h3 className="invite-and-share-modal__section-title">Invite by email</h3>
                <div className="invite-and-share-modal__section-content">
                  <div className="invite-and-share-modal__email-row">
                    <input
                      type="text"
                      className={`input invite-and-share-modal__email-input ${emailError ? 'invite-and-share-modal__input--error' : ''}`}
                      placeholder="Type email address"
                      value={emailInput}
                      onChange={(e) => {
                        setEmailInput(e.target.value);
                        setEmailError('');
                      }}
                      aria-invalid={!!emailError}
                      aria-describedby={emailError ? 'email-error' : undefined}
                    />
                    <button
                      type="button"
                      className="btn primary invite-and-share-modal__invite-btn"
                      onClick={handleInviteByEmail}
                      disabled={sendingEmail || !emailInput.trim()}
                    >
                      {sendingEmail ? 'Sending…' : 'Invite'}
                    </button>
                  </div>
                  {emailError && (
                    <p id="email-error" className="invite-and-share-modal__error" role="alert">
                      {emailError}
                    </p>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
