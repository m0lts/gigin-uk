import { useState, useEffect, useRef } from 'react';
import '@styles/shared/modals.styles.css'
import '@styles/host/next-gig-modal.styles.css'
import { NewTabIcon, PeopleGroupIcon } from '@features/shared/ui/extras/Icons';
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading';
import { useAuth } from '@hooks/useAuth';
import { PromoteModal } from '@features/shared/components/PromoteModal';
import { getMusicianProfileByMusicianId } from '@services/client-side/artists';
import { getOrCreateConversation } from '@services/api/conversations';
import { getVenueProfileById } from '@services/client-side/venues';
import { postCancellationMessage } from '@services/api/messages';
import { cancelGigAndRefund } from '@services/api/payments';
import { useMapbox } from '@hooks/useMapbox';
import { formatDate } from '@services/utils/dates';
import { formatDurationSpan } from '@services/utils/misc';
import { openInNewTab } from '@services/utils/misc';
import { CloseIcon, ErrorIcon, ExitIcon, PeopleGroupIconSolid } from '../../shared/ui/extras/Icons';
import { toast } from 'sonner';
import Portal from '../../shared/components/Portal';
import { LoadingSpinner } from '../../shared/ui/loading/Loading';
import { logGigCancellation, revertGigAfterCancellationVenue } from '@services/api/gigs';
import { cancelledGigMusicianProfileUpdate } from '@services/api/artists';


export const NextGig = ({ nextGig, musicianProfile, setNextGigModal }) => {

    const { user } = useAuth();

    const [loading, setLoading] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [showPromoteModal, setShowPromoteModal] = useState(false);
    const [askCancellationReason, setAskCancellationReason] = useState(false);
    const [cancellationReason, setCancellationReason] = useState({
        reason: '',
        extraDetails: '',
    });
    const [openMicMusicians, setOpenMicMusicians] = useState([]);
    const [loadingMusicians, setLoadingMusicians] = useState(false);

    useEffect(() => {
        const fetchConfirmedOpenMicMusicians = async () => {
            setLoadingMusicians(true);
          const confirmedApplicants = nextGig.applicants?.filter(app => app.status === 'confirmed');
          if (!confirmedApplicants?.length) return;
      
          const profiles = await Promise.all(
            confirmedApplicants.map(app => getMusicianProfileByMusicianId(app.id))
          );

          setOpenMicMusicians(profiles.filter(Boolean));
          setLoadingMusicians(false);
        };
      
        fetchConfirmedOpenMicMusicians();
      }, [nextGig]);

    const handleModalClick = (e) => {
        if (loading) return;
        if (e.target.className === 'modal') {
            setNextGigModal(false);
        }
    };

    const formatGenres = (genres) => {
        if (genres.length === 0) return 'No specific genre requested';
        if (genres.length === 1) return genres[0];
        const copiedGenres = [...genres];
        const lastGenre = copiedGenres.pop();
        return `${copiedGenres.join(', ')} or ${lastGenre}`;
    };

    const handleGigCancelation = () => {
        setShowConfirmation(true);
    };

    const formatCancellationReason = (reason) => {
        if (reason === 'fee') {
            return "they're not happy with the fee";
        } else if (reason === 'availability') {
            return 'of availability';
        } else if (reason === 'double-booking') {
            return 'of a double booking';
        } else if (reason === 'personal-reasons') {
            return 'of personal reasons';
        } else if (reason === 'illness') {
            return 'of illness';
        } else if (reason === 'information') {
            return 'of not enough information';
        } else {
            return 'of other reasons';
        }
    }
    
    const handleConfirmCancel = async () => {
        setLoading(true);
        try {
            const gigId = nextGig.gigId;
            const venueProfile = await getVenueProfileById(nextGig.venueId);
            const taskNames = [
                nextGig.clearPendingFeeTaskName,
                nextGig.automaticMessageTaskName,
            ];
            await cancelGigAndRefund({
                taskNames,
                transactionId: nextGig.paymentIntentId,
                gigId: nextGig.gigId,
                venueId: nextGig.venueId,
            });
            const handleMusicianCancellation = async (musician) => {
                const { conversationId } = await getOrCreateConversation({ musicianProfile: musician, gigData: nextGig, venueProfile, type: 'cancellation' });
                await postCancellationMessage(
                  { conversationId, senderId: user.uid, message: `${nextGig.venue.venueName} has unfortunately had to cancel because ${formatCancellationReason(
                    cancellationReason
                  )}. We apologise for any inconvenience caused.`, cancellingParty: 'venue' }
                );
                await revertGigAfterCancellationVenue({ gigData: nextGig, musicianId: musician.musicianId, cancellationReason });
                await cancelledGigMusicianProfileUpdate({ musicianId: musician.musicianId, gigId });
                const cancellingParty = 'venue';
                await logGigCancellation({ gigId, musicianId: musician.musicianId, reason: cancellationReason, cancellingParty, venueId: venueProfile.venueId });
              };
            await handleMusicianCancellation(musicianProfile);
            
            setLoading(false);
            setNextGigModal(false);
            toast.success('Gig cancellation successfull.')
        } catch (error) {
            console.error('Error canceling task:', error.message);
            setLoading(false);
            toast.error('Failed to cancel gig.')
        }
    };
    
    const handleCancelNo = () => {
        setShowConfirmation(false);
        setAskCancellationReason(false);
    };

    return (
        <Portal>

            <div className='modal' onClick={handleModalClick}>
                {showConfirmation ? (
                    <div className='modal-content confirmation-modal' onClick={(e) => e.stopPropagation()}>
                        {loading ? (
                            <>
                                <div className="text">
                                    <h2>Cancelling gig...</h2>
                                    <p>Please don't leave this window or close your browser.</p>
                                </div>
                                <LoadingSpinner />
                            </>
                        ) : !askCancellationReason ? (
                            <>
                                <div className="text">
                                    <h2>Are you sure you want to cancel this gig?</h2>
                                    <p>You will be refunded the gig fee and the gig won't be re-listed. You can relist the gig in the dashboard.</p>
                                </div>
                                <div className='two-buttons'>
                                    <button className='btn danger' onClick={() => setAskCancellationReason(true)}>
                                        Yes
                                    </button>
                                    <button className='btn tertiary' onClick={handleCancelNo}>
                                        No
                                    </button>
                                </div>
                            </>
                        ) : askCancellationReason && (
                            <>
                                <div className="text">
                                    <h2>What is your reason for cancelling?</h2>
                                </div>
                                <div className="input-container select">
                                    <select id='cancellation-reason' value={cancellationReason.reason} onChange={(e) => setCancellationReason((prev) => ({
                                            ...prev,
                                            reason: e.target.value,
                                        }))}>
                                        <option value=''>Please select a reason</option>
                                        <option value='fee'>Fee Dispute</option>
                                        <option value='availability'>Availability</option>
                                        <option value='double-booking'>Double Booking</option>
                                        <option value='personal-reasons'>Personal Reasons</option>
                                        <option value='illness'>Illness</option>
                                        <option value='information'>Not Enough Information</option>
                                        <option value='other'>Other</option>
                                    </select>
                                </div>
                                <div className="input-container">
                                    <label htmlFor="extraDetails" className='label'>Add any extra details below:</label>
                                    <textarea name="extra-details" value={cancellationReason.extraDetails} id="extraDetails" className='input' onChange={(e) => setCancellationReason((prev) => ({
                                            ...prev,
                                            extraDetails: e.target.value,
                                        }))}></textarea>
                                </div>
                                <div className='two-buttons'>
                                    <button className='btn danger' onClick={handleConfirmCancel} disabled={!cancellationReason}>
                                        Confirm Cancellation
                                    </button>
                                    <button className='btn tertiary' onClick={handleCancelNo}>
                                        Cancel
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <div className='modal-content next-gig' onClick={(e) => e.stopPropagation()}>
                        {nextGig?.kind === 'Open Mic' ? (
                            <>
                                <h3>Musicians Playing:</h3>
                                <div className='head multiple-musicians'>
                                    {loadingMusicians ? (
                                        <LoadingSpinner />
                                    ) : (
                                        openMicMusicians.map(musician => (
                                            <div
                                                className='musician-item'
                                                key={musician.musicianId}
                                                onClick={(e) => openInNewTab(`/${musician.musicianId}`, e)}
                                            >
                                                <div className='venue-info'>
                                                <figure className='venue-img-cont'>
                                                    <img src={musician.picture} alt={musician.name} className='venue-img' />
                                                </figure>
                                                <div className='names-div'>
                                                    <h3>{musician.name}</h3>
                                                    <p>{musician.musicianType}</p>
                                                </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className='head' onClick={(e) => openInNewTab(`/${musicianProfile.musicianId}`, e)}>
                                <div className='venue-info'>
                                    <figure className='venue-img-cont'>
                                        <img src={musicianProfile.picture} alt={musicianProfile.name} className='venue-img' />
                                    </figure>
                                    <div className='names-div'>
                                        <h1>{musicianProfile.name}</h1>
                                        <p>{musicianProfile.musicianType}</p>
                                    </div>
                                </div>
                                <button className='btn tertiary'>
                                    <NewTabIcon />
                                </button>
                            </div>
                        )}
                    <div className='body'>
                        <div className='primary-info'>
                            <div className='info-cont'>
                                <h3 className='subject'>Date and Time</h3>
                                <h3 className='text'>{formatDate(nextGig.date)} {formatDurationSpan(nextGig.startTime, nextGig.duration)}</h3>
                            </div>
                            <div className='info-cont'>
                                <h3 className='subject'>Gig Type</h3>
                                <h3 className='text'>{nextGig.kind}</h3>
                            </div>
                            {nextGig.kind !== "Open Mic" && nextGig.kind !== 'Ticketed Gig' && (
                                <div className='info-cont'>
                                    <h3 className='subject'>Agreed Fee</h3>
                                    <h3 className='text'>{nextGig.agreedFee}</h3>
                                </div>
                            )}
                            <div className='info-cont'>
                                <h3 className='subject'>Requested Genres</h3>
                                <h3 className='text'>{formatGenres(nextGig.genre)}</h3>
                            </div>
                        </div>
                        <div className='actions'>
                            <button className='btn primary' onClick={() => setShowPromoteModal(true)}>
                                <PeopleGroupIconSolid /> Promote Gig
                            </button>
                            <button className='btn danger' onClick={() => handleGigCancelation()}>
                                Cancel Gig
                            </button>
                        </div>
                    </div>
                    {(!loading) && (
                        <button className='btn close tertiary' onClick={() => {setNextGigModal(false)}}>
                            Close
                        </button>
                    )}
                </div>
                )}
                {showPromoteModal && (
                    <PromoteModal setShowSocialsModal={setShowPromoteModal} musicianId={musicianProfile.musicianId} />
                )}
            </div>
        </Portal>
    );
};