import { useEffect, useState, useMemo, useCallback } from 'react';
import { FEATURES } from '../../../config/features';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import {
  CloseIcon,
  LeftArrowIcon,
  PlusIcon,
  MessageIcon,
  LinkIcon,
  DownChevronIcon,
  UpChevronIcon,
} from '../../shared/ui/extras/Icons';
import {
  getArtistCRMEntries,
  createArtistCRMEntry,
  deleteArtistCRMEntry,
  migrateSavedArtistsToCRM,
  isArtistSavedInCRM,
} from '@services/client-side/artistCRM';
import { getArtistProfileById } from '@services/client-side/artists';
import { getGigPrivateBundle, inviteToGig } from '@services/api/gigs';
import { getOrCreateConversation } from '@services/api/conversations';
import { sendGigInvitationMessage } from '@services/client-side/messages';
import { fetchMyVenueMembership } from '@services/client-side/venues';
import { useVenueDashboard } from '@context/VenueDashboardContext';
import { filterInvitableGigsForMusician, getLocalGigDateTime } from '@services/utils/filtering';
import Portal from '../../shared/components/Portal';
import { LoadingSpinner } from '../../shared/ui/loading/Loading';
import { createGigInvite } from '@services/api/gigInvites';
import { AddContactModal } from './AddContactModal';
import { ContactMergeSuggestions } from './ContactMergeSuggestions';
import { EditContactModal } from './EditContactModal';
import { VenueCRMContactCard, PreviouslyBookedContactCard } from './VenueCRMContactCard';
import {
  formatContactsSubtitle,
  mergeCrmEntryWithArtistProfileForDetails,
  normalizeContactType,
} from './contactUtils';
import './contacts-page.css';

function applicantBookedForOfferModal(a) {
  const s = String(a?.status || '').toLowerCase();
  return a && ['confirmed', 'paid', 'accepted'].includes(s);
}

/** Matches calendar “booked” rules: rental confirmed applicant, or artist slot booked. */
function gigIsBookedForOfferModal(gig) {
  if (!gig) return false;
  const rental = gig.itemType === 'venue_hire' || gig.bookingMode === 'rental' || gig.kind === 'Venue Rental';
  if (rental) return (gig.applicants || []).some((a) => String(a?.status || '').toLowerCase() === 'confirmed');
  return (gig.applicants || []).some(applicantBookedForOfferModal);
}

function calculateEndTimeForOffer(startTime, duration) {
  if (!startTime || duration == null || duration === '') return null;
  const parts = String(startTime).split(':').map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const dur = Number(duration);
  if (!Number.isFinite(dur)) return null;
  const total = h * 60 + m + dur;
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

function formatOfferGigDateTimeLine(gig) {
  const d = gig?.date?.toDate ? gig.date.toDate() : new Date(gig?.date);
  if (!d || Number.isNaN(d.getTime())) return '—';
  const datePart = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const start = (gig.startTime || '').toString().trim();
  const end = calculateEndTimeForOffer(gig.startTime, gig.duration);
  const timePart = start && end ? `${start}–${end}` : start || '—';
  return `${datePart} · ${timePart}`;
}

function getOfferGigFeeLine(gig) {
  if (!gig) return '';
  const budget = gig.budget != null && String(gig.budget).trim() !== '' ? String(gig.budget).trim() : '';
  const isRental = gig.itemType === 'venue_hire' || gig.bookingMode === 'rental' || gig.kind === 'Venue Rental';
  let model = '';
  if (isRental) {
    if (gig.paymentModel === 'artist_pays_venue') model = 'They pay to hire';
    else if (gig.paymentModel === 'venue_pays_artist') model = 'Venue pays artist (hire)';
    else model = 'Venue hire';
  } else if (gig.paymentModel === 'venue_pays_artist') model = 'Venue pays artist';
  else if (gig.paymentModel === 'artist_pays_venue') model = 'Artist pays venue';
  else if (gig.paymentModel === 'no_fee') model = 'No fee';
  else model = 'Artist booking';
  if (budget) return `Fee model: ${model} · ${budget}`;
  return `Fee model: ${model}`;
}

function isOfferVenueHireGig(gig) {
  return gig?.itemType === 'venue_hire' || gig?.bookingMode === 'rental' || gig?.kind === 'Venue Rental';
}

/** Same public web origin used for venue share links (e.g. VenuePage copy). */
const GIGIN_PUBLIC_WEB_ORIGIN = 'https://giginmusic.com';

/** Public URL for the gig or venue-hire listing, with optional private invite query. */
function getOfferShareableUrl(gigData, inviteId = null) {
  const gigId = gigData?.gigId ?? gigData?.id;
  if (!gigId) return '';
  const hire = isOfferVenueHireGig(gigData);
  const path = hire ? `/hire/${gigId}` : `/gig/${gigId}`;
  let url = `${GIGIN_PUBLIC_WEB_ORIGIN}${path}`;
  if (gigData.private && inviteId) {
    url += `?inviteId=${encodeURIComponent(String(inviteId))}`;
  }
  return url;
}

function getOfferGigJsDate(gig) {
  if (!gig) return null;
  if (gig.date != null) {
    const d = gig.date?.toDate ? gig.date.toDate() : new Date(gig.date);
    if (d && !Number.isNaN(d.getTime())) return d;
  }
  const fromStart = getLocalGigDateTime(gig);
  if (fromStart && !Number.isNaN(fromStart.getTime())) return fromStart;
  return null;
}

function getOfferVenueDisplayName(gig, venueToSend) {
  const candidates = [
    gig?.venue?.venueName,
    venueToSend?.name,
    gig?.venue?.name,
    gig?.venueName,
    venueToSend?.venueName,
  ];
  for (const c of candidates) {
    if (c != null && String(c).trim() !== '') return String(c).trim();
  }
  return 'the venue';
}

function formatOfferMessageDateTimeForBody(gig) {
  const d = getOfferGigJsDate(gig);
  if (!d || Number.isNaN(d.getTime())) return '—';
  const datePart = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const startRaw = (gig.startTime || gig.timingMusicStartTime || '').toString().trim();
  let end = calculateEndTimeForOffer(startRaw, gig.duration);
  if (!end) {
    const rawEnd = (gig.endTime || gig.rentalHardCurfew || gig.curfew || '').toString().trim();
    end = rawEnd || null;
  }
  const timePart = startRaw && end ? `${startRaw}–${end}` : startRaw || end || '—';
  return `${datePart}, ${timePart}`;
}

function buildDefaultOfferMessageDraft(gig, venueToSend, shareUrl) {
  const venueName = getOfferVenueDisplayName(gig, venueToSend);
  const when = formatOfferMessageDateTimeForBody(gig);
  const link = shareUrl || '';
  return `Hey, we're booking a gig at ${venueName} for ${when}. Interested in booking it? View the details and apply here: ${link}`;
}

function ensureOfferShareLinkAtEnd(draft, shareUrl) {
  const t = (draft || '').trimEnd();
  const u = (shareUrl || '').trim();
  if (!u) return t;
  if (t.endsWith(u)) return t;
  return t ? `${t}\n${u}` : u;
}

function digitsOnlyPhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}

/** Digits suitable for wa.me (UK 07… → 447…). */
function waMePhoneDigits(phone) {
  const d = digitsOnlyPhone(phone);
  if (!d) return '';
  if (d.startsWith('44')) return d;
  if (d.startsWith('0') && d.length >= 10 && d.length <= 11) return `44${d.slice(1)}`;
  return d;
}

function buildWhatsAppShareUrl(fullMessageText, phone) {
  const text = encodeURIComponent(fullMessageText);
  const digits = waMePhoneDigits(phone);
  if (digits) return `https://wa.me/${digits}?text=${text}`;
  return `https://wa.me/?text=${text}`;
}

function toYyyyMmDdLocal(d) {
  if (!d || Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Creates a private-gig invite; mirrors the old Configure Invite → Generate Invite payload. */
async function createGigInviteForOffer({ gig, artist, expiryDateStr }) {
  let expiresAt = null;
  if (expiryDateStr && String(expiryDateStr).trim() !== '') {
    const parts = String(expiryDateStr).trim().split('-').map(Number);
    if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
      const date = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
      if (!Number.isNaN(date.getTime())) expiresAt = date;
    }
  }

  const invitePayload = {
    gigId: gig.gigId,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    artistName: artist?.name || null,
  };
  if (artist?.artistId) invitePayload.artistId = artist.artistId;
  else invitePayload.crmEntryId = artist?.id;

  const response = await createGigInvite(invitePayload);
  const inviteId = response?.data?.inviteId || response?.inviteId;
  if (!inviteId) throw new Error('Missing invite id from server');
  return inviteId;
}

export const InviteToGigModal = ({ artist, onClose, venues, user, gigs }) => {
  const [usersGigs, setUsersGigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [step, setStep] = useState('gig-selection'); // 'gig-selection' | 'send-method'
  const [selectedGig, setSelectedGig] = useState(null);
  /** `yyyy-mm-dd` for optional private-invite expiry (native date input). */
  const [inviteExpiryDateStr, setInviteExpiryDateStr] = useState('');
  const [inviteExpiryOpen, setInviteExpiryOpen] = useState(false);
  const [offerSendMethod, setOfferSendMethod] = useState('whatsapp'); // 'whatsapp' | 'gigin' | 'copy'
  const [offerMessageDraft, setOfferMessageDraft] = useState('');
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [createdInviteId, setCreatedInviteId] = useState(null);
  /** Selected gig on the offer step only; Send offer forwards to existing handleGigSelection. */
  const [gigPick, setGigPick] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setGigPick(null);
    setOfferSendMethod('whatsapp');
    setOfferMessageDraft('');
    setInviteExpiryDateStr('');
    setInviteExpiryOpen(false);
  }, [artist?.id, artist?.artistId]);

  useEffect(() => {
    if (step === 'send-method' && !artist?.artistId && offerSendMethod === 'gigin') {
      setOfferSendMethod('whatsapp');
    }
  }, [step, artist?.artistId, offerSendMethod]);

  useEffect(() => {
    const processGigs = async () => {
      if (!venues?.length || !gigs?.length) {
        if (!gigs?.length) {
          toast.error('You have no upcoming gigs to invite this artist to.');
        }
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        // Filter gigs based on whether artist has a profile
        let availableGigs;
        if (artist?.artistId) {
          availableGigs = filterInvitableGigsForMusician(gigs, artist.artistId);
        } else {
          // For artists without profiles, show all future open gigs (both public and private)
          const now = new Date();
          availableGigs = gigs.filter(gig => {
            const gigDate = gig.date?.toDate ? gig.date.toDate() : new Date(gig.date);
            return gigDate > now && gig.status === 'open';
          });
        }

        // Add membership info for permission checking
        const venuesWithMembership = await Promise.all(
          (venues || []).map(v => fetchMyVenueMembership(v, user.uid))
        );
        const membershipByVenueId = Object.fromEntries(
          venuesWithMembership
            .filter(Boolean)
            .map(v => [v.venueId, v.myMembership || null])
        );
        const gigsWithMembership = availableGigs.map(gig => ({
          ...gig,
          myMembership: membershipByVenueId[gig.venueId] || null,
        }));

        setUsersGigs(gigsWithMembership);
      } catch (error) {
        console.error('Error processing gigs:', error);
        toast.error('Error loading gigs. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    processGigs();
  }, [artist, venues, user?.uid, gigs]);

  const goToSendMethodStep = (gigData, inviteIdForPrivate = null) => {
    const venueToSend = venues.find((v) => v.venueId === gigData.venueId);
    const idForLink = gigData.private ? inviteIdForPrivate ?? createdInviteId : null;
    const shareUrl = getOfferShareableUrl(gigData, idForLink);
    setOfferMessageDraft(buildDefaultOfferMessageDraft(gigData, venueToSend, shareUrl));
    setOfferSendMethod('whatsapp');
    setStep('send-method');
  };

  const handleInviteToGig = async (gigData, messageText, inviteIdOverride = null) => {
    if (!gigData || !artist?.artistId) return;

    try {
      setInviting(true);
      const venueToSend = venues.find((v) => v.venueId === gigData.venueId);
      if (!venueToSend) {
        toast.error('Venue not found.');
        return;
      }

      const artistProfile = await getArtistProfileById(artist.artistId);
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

      const res = await inviteToGig({ gigId: gigData.gigId, musicianProfile: musicianProfilePayload });
      if (!res.success) {
        if (res.code === 'permission-denied') {
          toast.error('You don\'t have permission to invite artists for this venue.');
        } else if (res.code === 'failed-precondition') {
          toast.error('This gig is missing required venue info.');
        } else {
          toast.error('Error inviting artist. Please try again.');
        }
        return;
      }

      const { conversationId } = await getOrCreateConversation({
        musicianProfile: musicianProfilePayload,
        gigData: gigData,
        venueProfile: venueToSend,
        type: 'invitation',
      });

      const inviteId =
        gigData.private ? inviteIdOverride ?? createdInviteId : null;
      const shareUrl = getOfferShareableUrl(gigData, inviteId);
      const body = ensureOfferShareLinkAtEnd(messageText || '', shareUrl);

      await sendGigInvitationMessage(conversationId, {
        senderId: user.uid,
        text: body,
      });

      toast.success(`Invite sent to ${artistProfile.name}`);
      onClose();
    } catch (error) {
      console.error('Error inviting artist to gig:', error);
      toast.error('Error inviting artist. Please try again.');
    } finally {
      setInviting(false);
    }
  };

  const canInviteForGig = (gig) => {
    if (!gig?.myMembership) return false;
    const role = gig.myMembership.role || 'member';
    const perms = gig.myMembership.permissions || {};
    return role === 'owner' || perms['gigs.invite'] === true;
  };

  const handleBackFromSendMethod = () => {
    setStep('gig-selection');
    setSelectedGig(null);
    setGigPick(null);
    setInviteExpiryDateStr('');
    setInviteExpiryOpen(false);
    setCreatedInviteId(null);
    setOfferSendMethod('whatsapp');
    setOfferMessageDraft('');
  };

  const handleSendMethodPrimary = async () => {
    if (!selectedGig || !artist) return;

    let inviteIdForUrl = createdInviteId;

    if (selectedGig.private && !inviteIdForUrl) {
      setCreatingInvite(true);
      try {
        inviteIdForUrl = await createGigInviteForOffer({
          gig: selectedGig,
          artist,
          expiryDateStr: inviteExpiryDateStr,
        });
        setCreatedInviteId(inviteIdForUrl);
      } catch (error) {
        console.error('Error creating invite:', error);
        toast.error('Failed to create invite. Please try again.');
        return;
      } finally {
        setCreatingInvite(false);
      }
    }

    const shareUrl = getOfferShareableUrl(
      selectedGig,
      selectedGig.private ? inviteIdForUrl : null
    );

    if (offerSendMethod === 'copy') {
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied!');
        onClose();
      } catch (error) {
        console.error('Failed to copy link:', error);
        toast.error('Failed to copy link. Please try again.');
      }
      return;
    }

    const finalText = ensureOfferShareLinkAtEnd(offerMessageDraft, shareUrl);

    if (offerSendMethod === 'whatsapp') {
      window.open(buildWhatsAppShareUrl(finalText, artist.phone), '_blank', 'noopener,noreferrer');
      onClose();
      return;
    }

    if (!artist.artistId) {
      toast.error('This contact is not on Gigin.');
      return;
    }
    await handleInviteToGig(selectedGig, finalText, inviteIdForUrl);
  };

  const openCreateGigForArtist = () => {
    onClose();
    // Stay on the current dashboard route (e.g. My Contacts); VenueDashboard opens AddGigsModal from location.state.
    navigate(
      { pathname: location.pathname, search: location.search },
      {
        state: {
          musicianData: {
            id: artist?.artistId || artist?.id,
            name: artist?.name,
            genres: artist?.genres || [],
            type: artist?.artistType || 'Musician/Band',
            bandProfile: false,
            userId: artist?.userId,
            email: artist?.email,
            phone: artist?.phone,
            instagram: artist?.instagram,
            facebook: artist?.facebook,
            other: artist?.other,
            crmEntryId: !artist?.artistId ? artist?.id : null,
            /** AddGigsModal: skip calendar multiselect; open Create event with native date picker. */
            bookNewAwaitingFirstDate: true,
          },
          buildingForMusician: true,
          showAddGigsModal: true,
          addGigsMode: 'bookNew',
        },
      }
    );
  };

  const handleSendOffer = () => {
    if (!gigPick || inviting || creatingInvite || loading) return;
    if (!canInviteForGig(gigPick) || gigIsBookedForOfferModal(gigPick)) return;
    setSelectedGig(gigPick);
    setCreatedInviteId(null);
    setInviteExpiryDateStr('');
    setInviteExpiryOpen(false);
    goToSendMethodStep(gigPick, null);
  };

  const contactName = artist?.name || 'this contact';

  if (step === 'gig-selection') {
    const sendDisabled =
      !gigPick ||
      inviting ||
      creatingInvite ||
      loading ||
      !canInviteForGig(gigPick) ||
      gigIsBookedForOfferModal(gigPick);

    return (
      <Portal>
        <div className="modal offer-gig-modal" onClick={onClose}>
          <div
            className="modal-content offer-gig-modal__content scrollable"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="offer-gig-modal__header">
              <div className="offer-gig-modal__header-text">
                <h2 className="offer-gig-modal__title">Offer a gig</h2>
                <p className="offer-gig-modal__subtitle">
                  Select a gig to offer to <strong>{contactName}</strong>
                </p>
              </div>
              <button
                type="button"
                className="btn icon offer-gig-modal__close"
                onClick={onClose}
                aria-label="Close"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="offer-gig-modal__body">
              {loading ? (
                <div className="offer-gig-modal__loading">
                  <LoadingSpinner />
                </div>
              ) : (
                <>
                  <div className="offer-gig-modal__list">
                    {usersGigs.map((gig, index) => {
                      const booked = gigIsBookedForOfferModal(gig);
                      const permitted = canInviteForGig(gig);
                      const selectable = permitted && !booked;
                      const selected = gigPick?.gigId && gig.gigId === gigPick.gigId;
                      const mutedNote = booked
                        ? 'Already booked'
                        : !permitted
                          ? 'No permission to offer for this venue'
                          : null;
                      return (
                        <button
                          key={gig.gigId || `gig-${index}`}
                          type="button"
                          className={`offer-gig-modal__card${selected ? ' offer-gig-modal__card--selected' : ''}${!selectable ? ' offer-gig-modal__card--disabled' : ''}`}
                          disabled={!selectable}
                          onClick={() => selectable && setGigPick(gig)}
                        >
                          <div className="offer-gig-modal__card-top">
                            <span className="offer-gig-modal__gig-name">{gig.gigName || 'Gig'}</span>
                            <span
                              className={
                                booked
                                  ? 'offer-gig-modal__pill offer-gig-modal__pill--booked'
                                  : !permitted
                                    ? 'offer-gig-modal__pill offer-gig-modal__pill--unavailable'
                                    : 'offer-gig-modal__pill offer-gig-modal__pill--unbooked'
                              }
                            >
                              {booked ? 'Booked' : !permitted ? 'Unavailable' : 'Unbooked'}
                            </span>
                          </div>
                          <div className="offer-gig-modal__card-meta">
                            <span className="offer-gig-modal__datetime">{formatOfferGigDateTimeLine(gig)}</span>
                            <span className="offer-gig-modal__venue-name">{gig.venue?.venueName || '—'}</span>
                          </div>
                          <div className="offer-gig-modal__fee-line">{getOfferGigFeeLine(gig)}</div>
                          {mutedNote ? (
                            <div className="offer-gig-modal__card-note">{mutedNote}</div>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>

                  {!loading && usersGigs.length === 0 ? (
                    <p className="offer-gig-modal__empty">You have no upcoming gigs available.</p>
                  ) : null}

                  <button type="button" className="offer-gig-modal__create-card" onClick={openCreateGigForArtist}>
                    <span className="offer-gig-modal__create-icon" aria-hidden>
                      <PlusIcon />
                    </span>
                    <span className="offer-gig-modal__create-text">
                      <span className="offer-gig-modal__create-title">Create a new gig</span>
                      <span className="offer-gig-modal__create-sub">Set up a new gig to offer</span>
                    </span>
                  </button>
                </>
              )}
            </div>

            <div className="offer-gig-modal__footer offer-gig-modal__footer--pill-actions offer-gig-modal__footer--send-method">
              <button
                type="button"
                className="btn offer-gig-modal__btn-cancel"
                onClick={onClose}
                disabled={inviting || creatingInvite}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn primary offer-gig-modal__btn-send"
                onClick={handleSendOffer}
                disabled={sendDisabled}
              >
                Send offer
              </button>
            </div>
          </div>
        </div>
      </Portal>
    );
  }

  if (step === 'send-method' && selectedGig) {
    const gigTitle = selectedGig.gigName || 'Gig';
    const sendMethodPrimaryLabel =
      offerSendMethod === 'whatsapp'
        ? 'Send via WhatsApp'
        : offerSendMethod === 'gigin'
          ? 'Send on Gigin'
          : 'Copy link';
    const primaryBusy = inviting || creatingInvite;
    const primaryDisabled = primaryBusy || (offerSendMethod === 'gigin' && !artist?.artistId);
    const todayStr = toYyyyMmDdLocal(new Date());
    const gigMaxDateStr = (() => {
      const gd = getOfferGigJsDate(selectedGig);
      return gd ? toYyyyMmDdLocal(gd) : '';
    })();

    return (
      <Portal>
        <div className="modal offer-gig-modal" onClick={onClose}>
          <div
            className="modal-content offer-gig-modal__content scrollable"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="offer-gig-modal__header">
              <div className="offer-gig-modal__header-text">
                <button
                  type="button"
                  className="offer-gig-modal__back"
                  onClick={handleBackFromSendMethod}
                  disabled={primaryBusy}
                >
                  <LeftArrowIcon />
                  Back
                </button>
                <h2 className="offer-gig-modal__title">How do you want to send it?</h2>
                <p className="offer-gig-modal__subtitle offer-gig-modal__subtitle--offering">
                  Offering <strong>{gigTitle}</strong> to <strong>{contactName}</strong>
                </p>
              </div>
              <button type="button" className="btn icon offer-gig-modal__close" onClick={onClose} aria-label="Close">
                <CloseIcon />
              </button>
            </div>

            <div className="offer-gig-modal__body">
              <div className="offer-gig-modal__list offer-gig-modal__list--methods">
                <button
                  type="button"
                  className={`offer-gig-modal__method-card${offerSendMethod === 'whatsapp' ? ' offer-gig-modal__method-card--selected' : ''}`}
                  onClick={() => setOfferSendMethod('whatsapp')}
                  disabled={primaryBusy}
                >
                  <span className="offer-gig-modal__method-icon offer-gig-modal__method-icon--whatsapp" aria-hidden>
                    <MessageIcon />
                  </span>
                  <span className="offer-gig-modal__method-text">
                    <span className="offer-gig-modal__method-title">WhatsApp</span>
                    <span className="offer-gig-modal__method-desc">
                      Opens WhatsApp with your message ready to send
                    </span>
                  </span>
                </button>

                {FEATURES.chat && artist?.artistId ? (
                  <button
                    type="button"
                    className={`offer-gig-modal__method-card${offerSendMethod === 'gigin' ? ' offer-gig-modal__method-card--selected' : ''}`}
                    onClick={() => setOfferSendMethod('gigin')}
                    disabled={primaryBusy}
                  >
                    <span className="offer-gig-modal__method-icon offer-gig-modal__method-icon--gigin" aria-hidden>
                      <MessageIcon />
                    </span>
                    <span className="offer-gig-modal__method-text">
                      <span className="offer-gig-modal__method-title-row">
                        <span className="offer-gig-modal__method-title">Message on Gigin</span>
                        <span className="offer-gig-modal__badge-recommended">Recommended</span>
                      </span>
                      <span className="offer-gig-modal__method-desc">
                        Sends via Gigin messages — keeps everything in one place
                      </span>
                    </span>
                  </button>
                ) : null}

                <button
                  type="button"
                  className={`offer-gig-modal__method-card${offerSendMethod === 'copy' ? ' offer-gig-modal__method-card--selected' : ''}`}
                  onClick={() => setOfferSendMethod('copy')}
                  disabled={primaryBusy}
                >
                  <span className="offer-gig-modal__method-icon offer-gig-modal__method-icon--copylink" aria-hidden>
                    <LinkIcon />
                  </span>
                  <span className="offer-gig-modal__method-text">
                    <span className="offer-gig-modal__method-title">Copy link</span>
                    <span className="offer-gig-modal__method-desc">
                      Copy the gig link to share however you like
                    </span>
                  </span>
                </button>
              </div>

              <label className="offer-gig-modal__message-label" htmlFor="offer-gig-message-draft">
                Message preview
              </label>
              <div className="offer-gig-modal__message-wrap">
                <textarea
                  id="offer-gig-message-draft"
                  className="offer-gig-modal__message-textarea"
                  value={offerMessageDraft}
                  onChange={(e) => setOfferMessageDraft(e.target.value)}
                  rows={4}
                  disabled={primaryBusy}
                />
              </div>

              {selectedGig.private ? (
                <div className="offer-gig-modal__expiry">
                  <button
                    type="button"
                    className="offer-gig-modal__expiry-toggle"
                    onClick={() => setInviteExpiryOpen((o) => !o)}
                    disabled={primaryBusy}
                    aria-expanded={inviteExpiryOpen}
                  >
                    <span className="offer-gig-modal__expiry-toggle-icon" aria-hidden>
                      {inviteExpiryOpen ? <UpChevronIcon /> : <DownChevronIcon />}
                    </span>
                    Set expiry date (optional)
                  </button>
                  {inviteExpiryOpen ? (
                    <div className="offer-gig-modal__expiry-panel">
                      <label className="offer-gig-modal__expiry-label" htmlFor="offer-invite-expiry-date">
                        Invite expires on
                      </label>
                      <input
                        id="offer-invite-expiry-date"
                        type="date"
                        className="offer-gig-modal__expiry-input"
                        value={inviteExpiryDateStr}
                        min={todayStr}
                        max={gigMaxDateStr || undefined}
                        onChange={(e) => setInviteExpiryDateStr(e.target.value)}
                        disabled={primaryBusy}
                      />
                      <p className="offer-gig-modal__expiry-note">
                        After this date the link will no longer work.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="offer-gig-modal__footer offer-gig-modal__footer--pill-actions offer-gig-modal__footer--send-method">
              <button type="button" className="btn offer-gig-modal__btn-cancel" onClick={onClose} disabled={primaryBusy}>
                Cancel
              </button>
              <button
                type="button"
                className="btn primary offer-gig-modal__btn-send"
                onClick={handleSendMethodPrimary}
                disabled={primaryDisabled}
              >
                {creatingInvite
                  ? 'Creating…'
                  : inviting && offerSendMethod === 'gigin'
                    ? 'Sending…'
                    : sendMethodPrimaryLabel}
              </button>
            </div>
          </div>
        </div>
      </Portal>
    );
  }

  return null;
};



export const ArtistCRM = ({ user, venues }) => {
  const navigate = useNavigate();
  const { gigs } = useVenueDashboard();
  const [crmEntries, setCrmEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [artistProfiles, setArtistProfiles] = useState({});
  const [listFilter, setListFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [openMenuEntryId, setOpenMenuEntryId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [showInviteGigModal, setShowInviteGigModal] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState(null);

  const [previouslyBookedArtists, setPreviouslyBookedArtists] = useState([]);
  const [previouslyBookedProfiles, setPreviouslyBookedProfiles] = useState({});
  const [loadingPreviouslyBooked, setLoadingPreviouslyBooked] = useState(false);
  const [savingBookedId, setSavingBookedId] = useState(null);

  const loadProfilesForEntries = useCallback(async (entries) => {
    const profilePromises = entries
      .filter((entry) => entry.artistId)
      .map(async (entry) => {
        try {
          const profile = await getArtistProfileById(entry.artistId);
          return { entryId: entry.id, profile };
        } catch (error) {
          console.error(`Error fetching profile for ${entry.artistId}:`, error);
          return { entryId: entry.id, profile: null };
        }
      });
    const profiles = await Promise.all(profilePromises);
    const profileMap = {};
    profiles.forEach(({ entryId, profile }) => {
      profileMap[entryId] = profile;
    });
    setArtistProfiles(profileMap);
  }, []);

  useEffect(() => {
    const fetchPreviouslyBookedArtists = async () => {
      if (listFilter !== 'previouslyBooked' || !gigs?.length) {
        setPreviouslyBookedArtists([]);
        setPreviouslyBookedProfiles({});
        return;
      }

      setLoadingPreviouslyBooked(true);
      try {
        const confirmedGigs = gigs.filter((gig) => {
          const gigDate = getLocalGigDateTime(gig);
          return gigDate && gig.applicants?.some((a) => a.status === 'confirmed');
        });

        const uniqueArtistIds = new Set();
        const artistIdToMusicianId = new Map();
        const guestBooked = [];

        confirmedGigs.forEach((gig) => {
          const confirmedApplicants = gig.applicants?.filter((a) => a.status === 'confirmed') || [];
          confirmedApplicants.forEach((applicant) => {
            if (applicant?.guest === true || applicant?.type === 'guest') {
              if (!applicant.id || guestBooked.some((entry) => entry.id === applicant.id)) return;
              guestBooked.push({
                id: applicant.id,
                gigId: gig.gigId,
                name: applicant.name || applicant.artistName || 'Guest',
                email: '',
                phone: '',
                photoUrl: '',
                guest: true,
              });
              return;
            }
            const artistId = applicant.id || applicant.musicianId;
            if (artistId) {
              uniqueArtistIds.add(artistId);
              if (applicant.musicianId) {
                artistIdToMusicianId.set(artistId, applicant.musicianId);
              }
            }
          });
        });

        const guestGigIds = [...new Set(guestBooked.map((entry) => entry.gigId).filter(Boolean))];
        if (guestGigIds.length) {
          const bundle = await getGigPrivateBundle(guestGigIds).catch(() => null);
          guestBooked.forEach((entry) => {
            const extra = bundle?.gigs?.[entry.gigId]?.guests?.[entry.id];
            if (!extra) return;
            entry.email = extra.email || '';
            entry.phone = extra.phone || '';
            entry.photoUrl = extra.photoUrl || extra.photo?.url || '';
          });
        }

        const savedArtistIds = new Set(crmEntries.map((entry) => entry.artistId).filter(Boolean));
        const artistIdsToFetch = Array.from(uniqueArtistIds).filter((id) => !savedArtistIds.has(id));

        const profilePromises = artistIdsToFetch.map(async (artistId) => {
          try {
            const profile = await getArtistProfileById(artistId);
            return { artistId, profile };
          } catch (error) {
            console.error(`Error fetching profile for ${artistId}:`, error);
            return { artistId, profile: null };
          }
        });

        const profileResults = await Promise.all(profilePromises);

        const bookedArtists = [];
        const profileMap = {};

        profileResults.forEach(({ artistId, profile }) => {
          if (profile) {
            bookedArtists.push({
              id: artistId,
              name: profile.name || 'Unknown Artist',
              musicianId: artistIdToMusicianId.get(artistId),
            });
            profileMap[artistId] = profile;
          }
        });

        setPreviouslyBookedArtists([...bookedArtists, ...guestBooked]);
        setPreviouslyBookedProfiles(profileMap);
      } catch (error) {
        console.error('Error fetching previously booked artists:', error);
        toast.error('Error loading previously booked contacts.');
      } finally {
        setLoadingPreviouslyBooked(false);
      }
    };

    fetchPreviouslyBookedArtists();
  }, [listFilter, gigs, crmEntries]);

  useEffect(() => {
    const fetchCRMData = async () => {
      if (!user?.uid) return;

      setLoading(true);
      try {
        const savedIds = user?.savedArtists || [];
        if (Array.isArray(savedIds) && savedIds.length > 0) {
          try {
            await migrateSavedArtistsToCRM(user.uid, savedIds, getArtistProfileById);
          } catch (error) {
            console.error('Error migrating saved artists:', error);
          }
        }

        const entries = await getArtistCRMEntries(user.uid);
        setCrmEntries(entries);
        await loadProfilesForEntries(entries);
      } catch (error) {
        console.error('Error fetching CRM data:', error);
        toast.error('Error loading contacts.');
      } finally {
        setLoading(false);
      }
    };

    fetchCRMData();
  }, [user, loadProfilesForEntries]);

  useEffect(() => {
    const fn = (e) => {
      if (!e.target.closest('.contacts-overflow-wrap')) setOpenMenuEntryId(null);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const subtitle = useMemo(() => formatContactsSubtitle(crmEntries), [crmEntries]);

  const filteredCrmEntries = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    const match = (e) => !needle || (e.name || '').toLowerCase().includes(needle);
    let rows = crmEntries.filter(match);
    switch (listFilter) {
      case 'artists':
        rows = rows.filter((e) => normalizeContactType(e.contactType) === 'artist');
        break;
      case 'promoters':
        rows = rows.filter((e) => normalizeContactType(e.contactType) === 'promoter');
        break;
      case 'other':
        rows = rows.filter((e) => normalizeContactType(e.contactType) === 'other');
        break;
      case 'soundEngineers':
        rows = rows.filter((e) => normalizeContactType(e.contactType) === 'soundEngineer');
        break;
      case 'onGigin':
        rows = rows.filter((e) => !!e.artistId);
        break;
      default:
        break;
    }
    return rows;
  }, [crmEntries, listFilter, searchQuery]);

  const filteredPreviouslyBooked = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    return previouslyBookedArtists.filter(
      (a) => !needle || (a.name || '').toLowerCase().includes(needle)
    );
  }, [previouslyBookedArtists, searchQuery]);

  const refreshCRM = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const entries = await getArtistCRMEntries(user.uid);
      setCrmEntries(entries);
      await loadProfilesForEntries(entries);
    } catch (error) {
      console.error('Error refreshing CRM data:', error);
      toast.error('Error refreshing data.');
    }
  }, [user?.uid, loadProfilesForEntries]);

  const handleDeleteEntry = async (entryId) => {
    if (!user?.uid) return;
    try {
      await deleteArtistCRMEntry(user.uid, entryId);
      setCrmEntries((prev) => prev.filter((e) => e.id !== entryId));
      setOpenMenuEntryId(null);
      toast.success('Contact removed');
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast.error('Failed to remove contact.');
    }
  };

  const handleSavePreviouslyBookedArtist = async (artist) => {
    if (!user?.uid || !artist?.id) return;

    setSavingBookedId(artist.id);
    try {
      const alreadySaved = await isArtistSavedInCRM(user.uid, artist.id);
      if (alreadySaved) {
        toast.info(`${artist.name || 'Contact'} is already saved.`);
        await refreshCRM();
        setPreviouslyBookedArtists((prev) => prev.filter((a) => a.id !== artist.id));
        return;
      }

      await createArtistCRMEntry(user.uid, {
        artistId: artist.id,
        name: artist.name || 'Unknown Artist',
        notes: '',
        contactType: 'artist',
      });

      toast.success(`Saved ${artist.name || 'contact'}`);
      await refreshCRM();
      setPreviouslyBookedArtists((prev) => prev.filter((a) => a.id !== artist.id));
    } catch (error) {
      console.error('Error saving artist:', error);
      toast.error('Failed to save contact.');
    } finally {
      setSavingBookedId(null);
    }
  };

  const pills = [
    { id: 'all', label: 'All' },
    { id: 'artists', label: 'Artists' },
    { id: 'promoters', label: 'Promoters' },
    { id: 'soundEngineers', label: 'Sound engineers' },
    { id: 'other', label: 'Other' },
    { id: 'onGigin', label: 'On Gigin' },
    { id: 'previouslyBooked', label: 'Previously booked' },
  ];

  const showCrmList = listFilter !== 'previouslyBooked';

  return (
    <>
      <div className="contacts-page-root">
      <div className="head contacts-page-head">
        <div className="contacts-page-head-text">
          <h1 className="title">My Contacts</h1>
          <p className="contacts-page-subtitle">{subtitle}</p>
        </div>
        <div className="contacts-page-head-actions">
          {FEATURES.discovery && (
          <button className="btn secondary" type="button" onClick={() => navigate('/venues/dashboard/artists/find')}>
            Find Artists
          </button>
          )}
          <button type="button" className="btn primary contacts-head-add-btn" onClick={() => setShowAddModal(true)}>
            <PlusIcon />
            Add contact
          </button>
        </div>
      </div>
      <div className="body gigs contacts-page-body">
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <LoadingSpinner />
          </div>
        ) : (
          <>
            <div className="contacts-page-search">
              <input
                type="search"
                placeholder="Search contacts…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search contacts"
              />
            </div>
            <div className="contacts-filter-pills">
              {pills.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={listFilter === p.id ? 'contacts-filter-pill--active' : ''}
                  onClick={() => {
                    setListFilter(p.id);
                    setOpenMenuEntryId(null);
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {showCrmList ? (
              <div className="contacts-card-list">
                <ContactMergeSuggestions onMerged={refreshCRM} />
                {filteredCrmEntries.length === 0 ? (
                  <p style={{ color: '#666' }}>No contacts match this filter.</p>
                ) : (
                  filteredCrmEntries.map((entry) => (
                    <VenueCRMContactCard
                      key={entry.id}
                      entry={entry}
                      artistProfile={artistProfiles[entry.id]}
                      menuOpen={openMenuEntryId === entry.id}
                      onToggleMenu={() =>
                        setOpenMenuEntryId((prev) => (prev === entry.id ? null : entry.id))
                      }
                      onInvite={() => {
                        const profile = artistProfiles[entry.id];
                        setSelectedArtist(
                          entry.artistId && profile
                            ? mergeCrmEntryWithArtistProfileForDetails(entry, profile)
                            : entry
                        );
                        setShowInviteGigModal(true);
                      }}
                      onEdit={() => {
                        setOpenMenuEntryId(null);
                        setEditEntry(entry);
                      }}
                      onDelete={() => {
                        setOpenMenuEntryId(null);
                        handleDeleteEntry(entry.id);
                      }}
                    />
                  ))
                )}
              </div>
            ) : loadingPreviouslyBooked ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>
                <LoadingSpinner />
              </div>
            ) : filteredPreviouslyBooked.length === 0 ? (
              <p style={{ color: '#666' }}>No previously booked contacts match your search.</p>
            ) : (
              <div className="contacts-card-list">
                {filteredPreviouslyBooked.map((artist) => (
                  artist.guest ? (
                    <div key={artist.id} className="contacts-card">
                      <div className="contacts-card-main contacts-card-main--centered">
                        <div className="contacts-card-name-row">
                          <span className="contacts-card-name">{artist.name}</span>
                          <span className="ga-guest-tag">Guest</span>
                        </div>
                        {artist.email ? <p>{artist.email}</p> : null}
                        {artist.phone ? <p>{artist.phone}</p> : null}
                      </div>
                    </div>
                  ) : (
                  <PreviouslyBookedContactCard
                    key={artist.id}
                    artist={artist}
                    profile={previouslyBookedProfiles[artist.id]}
                    saving={savingBookedId === artist.id}
                    onInvite={() => {
                      const profile = previouslyBookedProfiles[artist.id];
                      const tempEntry = {
                        id: `temp-${artist.id}`,
                        name: artist.name || profile?.name || 'Unknown Artist',
                        artistId: artist.id,
                      };
                      setSelectedArtist(tempEntry);
                      setShowInviteGigModal(true);
                    }}
                    onSave={() => handleSavePreviouslyBookedArtist(artist)}
                  />
                  )
                ))}
              </div>
            )}
          </>
        )}
      </div>
      </div>

      {showAddModal && user?.uid ? (
        <AddContactModal userId={user.uid} onClose={() => setShowAddModal(false)} onCreated={refreshCRM} />
      ) : null}

      {editEntry && user?.uid ? (
        <EditContactModal
          userId={user.uid}
          entry={editEntry}
          onClose={() => setEditEntry(null)}
          onSaved={(updates) => {
            setCrmEntries((prev) => prev.map((e) => (e.id === editEntry.id ? { ...e, ...updates } : e)));
            setEditEntry(null);
          }}
        />
      ) : null}

      {showInviteGigModal && selectedArtist ? (
        <InviteToGigModal
          artist={selectedArtist}
          onClose={() => {
            setShowInviteGigModal(false);
            setSelectedArtist(null);
          }}
          venues={venues}
          user={user}
          gigs={gigs}
        />
      ) : null}
    </>
  );
};
