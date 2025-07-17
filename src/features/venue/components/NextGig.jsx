import { useState, useEffect, useRef } from 'react';
import '@styles/shared/modals.styles.css'
import '@styles/musician/gig-handbook.styles.css'
import { NewTabIcon, PeopleGroupIcon } from '@features/shared/ui/extras/Icons';
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading';
import { useAuth } from '@hooks/useAuth';
import { PromoteModal } from '@features/shared/components/PromoteModal';
import { getMusicianProfileByMusicianId } from '@services/musicians';
import { getOrCreateConversation } from '@services/conversations';
import { getVenueProfileById } from '@services/venues';
import { postCancellationMessage } from '@services/messages';
import { cancelGigAndRefund } from '@services/functions';
import { useMapbox } from '@hooks/useMapbox';
import { formatDate } from '@services/utils/dates';
import { formatDurationSpan } from '@services/utils/misc';
import { openInNewTab } from '@services/utils/misc';
import { PeopleGroupIconSolid } from '../../shared/ui/extras/Icons';


export const NextGig = ({ nextGig, musicianProfile, setNextGigModal }) => {

    const { user } = useAuth();

    const [loading, setLoading] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [showPromoteModal, setShowPromoteModal] = useState(false);
    const [askCancellationReason, setAskCancellationReason] = useState(false);
    const [cancellationReason, setCancellationReason] = useState('');

    const handleModalClick = (e) => {
        if (loading) return;
        if (e.target.className === 'modal') {
            setNextGigModal(false);
        }
    };

    const splitDateAndTime = (timestamp) => {
        const date = timestamp.toDate();
        const day = date.getDate();
        const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
        const month = date.toLocaleDateString('en-GB', { month: 'long' });
        const year = date.getFullYear();
        const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        return {
            weekday, // e.g., 'Monday'
            day, // e.g., '1st'
            month, // e.g., 'January'
            year, // e.g., '2023'
            time, // e.g., '14:30'
        };
    };

    const formatGenres = (genres) => {
        if (genres.length === 0) return '';
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
            const taskNames = [
                nextGig.clearPendingFeeTaskName,
                nextGig.automaticMessageTaskName,
            ];
            await cancelGigAndRefund({
                taskNames,
                transactionId: nextGig.transactionId,
            });
            const gigId = nextGig.gigId;
            const musicianProfile = await getMusicianProfileByMusicianId(musicianId);
            const venueProfile = await getVenueProfileById(nextGig.venueId);
            const conversationId = await  getOrCreateConversation(musicianProfile, nextGig, venueProfile, 'cancellation');
            await postCancellationMessage(
                conversationId,
                user.uid,
                `${user.musicianProfile.name} has unfortunately had to cancel because ${formatCancellationReason(
                  cancellationReason
                )}. You have been refunded the gig fee - refunds can take 3–10 business days to appear in your account. The gig has been re-posted for musicians to apply to.`
            );
            await revertGigAfterCancellation(nextGig, musicianId, cancellationReason);
            await updateMusicianCancelledGig(musicianId, gigId);
            await logGigCancellation(gigId, musicianId, cancellationReason);
            setLoading(false);
            setShowGigHandbook(false);
            window.location.reload();
        } catch (error) {
            console.error('Error canceling task:', error.message);
            setLoading(false);
        }
    };
    
    const handleCancelNo = () => {
        setShowConfirmation(false);
    };

    console.log(nextGig)
    console.log(musicianProfile)

    return (
        <div className='modal' onClick={handleModalClick}>
            {showConfirmation ? (
                <div className='modal-content confirmation-modal' onClick={(e) => e.stopPropagation()}>
                    {loading ? (
                        <>
                            <h3>Cancelling gig...</h3>
                            <p>Please don't leave this window or close your browser.</p>
                            <LoadingThreeDots />
                        </>
                    ) : !askCancellationReason ? (
                        <>
                            <h3>Are you sure you want to cancel this gig?</h3>
                            <p>The venue will be refunded the gig fee and the gig re-listed.</p>
                            <div className='two-buttons'>
                                <button className='btn danger' onClick={() => setAskCancellationReason(true)}>
                                    Yes
                                </button>
                                <button className='btn secondary' onClick={handleCancelNo}>
                                    No
                                </button>
                            </div>
                        </>
                    ) : askCancellationReason && (
                        <>
                            <h3>Why are you cancelling?</h3>
                            <select id='cancellation-reason' value={cancellationReason} onChange={(e) => setCancellationReason(e.target.value)}>
                                <option value=''>Select a reason</option>
                                <option value='fee'>Fee Dispute</option>
                                <option value='availability'>Availability</option>
                                <option value='double-booking'>Double Booking</option>
                                <option value='personal-reasons'>Personal Reasons</option>
                                <option value='illness'>Illness</option>
                                <option value='information'>Not Enough Information</option>
                                <option value='other'>Other</option>
                            </select>
                            <div className='two-buttons'>
                                <button className='btn danger' onClick={handleConfirmCancel} disabled={!cancellationReason}>
                                    Confirm
                                </button>
                                <button className='btn secondary' onClick={handleCancelNo}>
                                    Cancel
                                </button>
                            </div>
                        </>
                    )}
                </div>
            ) : (
                <div className='modal-content gig-handbook' onClick={(e) => e.stopPropagation()}>
                <div className='head'>
                    <div className='venue-info'>
                        <figure className='venue-img-cont'>
                            <img src={musicianProfile.picture} alt={musicianProfile.name} className='venue-img' />
                        </figure>
                        <div className='names-div'>
                            <h1>{musicianProfile.name}</h1>
                            <p>{musicianProfile.musicianType}</p>
                        </div>
                    </div>
                    <div className='musician-actions'>
                        <button className='btn tertiary' onClick={(e) => openInNewTab(`/musicians/${musicianProfile.musicianId}`, e)}>
                            Musician Profile <NewTabIcon />
                        </button>
                        <button className='btn primary' onClick={() => setShowPromoteModal(true)}>
                            <PeopleGroupIconSolid /> Promote
                        </button>
                        <button className='btn danger' onClick={() => handleGigCancelation()}>
                            Cancel Gig
                        </button>
                    </div>
                </div>
                <div className='body'>
                    <div className='primary-info'>
                        <div className='info-cont'>
                            <h3 className='subject'>Date and Time</h3>
                            <h3 className='text'>{formatDate(nextGig.date)} {formatDurationSpan(nextGig.startTime, nextGig.duration)}</h3>
                        </div>
                        <div className='info-cont'>
                            <h3 className='subject'>Type of Gig</h3>
                            <h3 className='text'>{nextGig.kind}</h3>
                        </div>
                        <div className='info-cont'>
                            <h3 className='subject'>Agreed Fee</h3>
                            <h3 className='text'>{nextGig.agreedFee}</h3>
                        </div>
                        <div className='info-cont'>
                            <h3 className='subject'>Requested Genres</h3>
                            <h3 className='text'>{formatGenres(nextGig.genre)}</h3>
                        </div>
                    </div>
                </div>
                {(!loading) && (
                    <button className='btn close tertiary' onClick={() => {setShowGigHandbook(false)}}>
                        Close
                    </button>
                )}
            </div>
            )}
            {showPromoteModal && (
                <PromoteModal setShowSocialsModal={setShowPromoteModal} musicianId={musicianId} />
            )}
        </div>
    );
};