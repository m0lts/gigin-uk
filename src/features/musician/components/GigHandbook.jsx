import { useState, useEffect, useRef } from 'react';
import '@styles/shared/modals.styles.css'
import '@styles/musician/gig-handbook.styles.css'
import { NewTabIcon, PeopleGroupIcon } from '@features/shared/ui/extras/Icons';
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading';
import { useAuth } from '@hooks/useAuth';
import { PromoteModal } from '@features/shared/components/PromoteModal';
import { getMusicianProfileByMusicianId } from '@services/client-side/musicians';
import { getOrCreateConversation } from '@services/function-calls/conversations';
import { getVenueProfileById } from '@services/client-side/venues';
import { postCancellationMessage } from '@services/function-calls/messages';
import { cancelGigAndRefund } from '@services/function-calls/tasks';
import { useMapbox } from '@hooks/useMapbox';
import { formatDate } from '@services/utils/dates';
import { formatDurationSpan } from '@services/utils/misc';
import { openInNewTab } from '../../../services/utils/misc';
import { updateMusicianCancelledGig } from '../../../services/client-side/musicians';
import { LoadingSpinner } from '../../shared/ui/loading/Loading';
import { logGigCancellation, revertGigAfterCancellation } from '../../../services/function-calls/gigs';


export const GigHandbook = ({ setShowGigHandbook, gigForHandbook, musicianId, showConfirmation, setShowConfirmation }) => {

    const { user } = useAuth();

    const [loading, setLoading] = useState(false);
    const [showPromoteModal, setShowPromoteModal] = useState(false);
    const [askCancellationReason, setAskCancellationReason] = useState(false);
    const [cancellationReason, setCancellationReason] = useState('');
    const mapContainerRef = useRef(null);

    useMapbox({
        containerRef: mapContainerRef,
        coordinates: gigForHandbook?.coordinates,
        zoom: 15,
        addMarker: true,
        reinitKey: showConfirmation ? 'confirming' : 'active',
      });

    const handleModalClick = (e) => {
        if (loading) return;
        if (e.target.className === 'modal') {
            setShowGigHandbook(false);
            setAskCancellationReason(false);
            setShowConfirmation(false);
        }
    };

    const getOrdinalSuffix = (day) => {
        if (day > 3 && day < 21) return 'th';
        switch (day % 10) {
          case 1: return 'st';
          case 2: return 'nd';
          case 3: return 'rd';
          default: return 'th';
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
        if (genres.length === 0) return 'No Specific Genre Requested';
        if (genres.length === 1) return genres[0];
        const copiedGenres = [...genres];
        const lastGenre = copiedGenres.pop();
        return `${copiedGenres.join(', ')} or ${lastGenre}`;
    };

    const openGoogleMaps = (address, coordinates) => {
        const baseUrl = 'https://www.google.com/maps/dir/?api=1';
        const queryParams = coordinates 
            ? `&destination=${coordinates[1]},${coordinates[0]}`
            : `&destination=${encodeURIComponent(address)}`;
        window.open(baseUrl + queryParams, '_blank');
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
                gigForHandbook.clearPendingFeeTaskName,
                gigForHandbook.automaticMessageTaskName,
            ];
            if (gigForHandbook.kind !== 'Ticketed Gig' && gigForHandbook.kind !== 'Open Mic') {
                await cancelGigAndRefund({
                    taskNames,
                    transactionId: gigForHandbook.paymentIntentId,
                });
            }
            const gigId = gigForHandbook.gigId;
            const musicianProfile = await getMusicianProfileByMusicianId(musicianId);
            const venueProfile = await getVenueProfileById(gigForHandbook.venueId);
            const conversationId = await  getOrCreateConversation(musicianProfile, gigForHandbook, venueProfile, 'cancellation');
            let messageText;
            if (gigForHandbook.kind === 'Ticketed Gig') {
                messageText = `${user.musicianProfile.name} has unfortunately had to cancel because ${formatCancellationReason(cancellationReason)}. The gig has been re-posted for musicians to apply to.`
            } else if (gigForHandbook.kind === 'Open Mic') {
                messageText = `${user.musicianProfile.name} has unfortunately had to cancel because ${formatCancellationReason(cancellationReason)}.`
            } else {
                messageText = `${user.musicianProfile.name} has unfortunately had to cancel because ${formatCancellationReason(cancellationReason)}. You have been refunded the gig fee - refunds can take 3–10 business days to appear in your account. The gig has been re-posted for musicians to apply to.`
            }
            await postCancellationMessage(
                conversationId,
                user.uid,
                messageText,
                'Musician',
            );
            await revertGigAfterCancellation(gigForHandbook, musicianId, cancellationReason);
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
        setAskCancellationReason(false);
    };


    return (
        <div className='modal' onClick={handleModalClick}>
            {showConfirmation ? (
                <div className='modal-content confirmation-modal' onClick={(e) => e.stopPropagation()}>
                    {loading ? (
                        <>
                            <LoadingSpinner />
                            <h3>Cancelling gig...</h3>
                            <p>Please don't leave this window or close your browser.</p>
                        </>
                    ) : !askCancellationReason ? (
                        <> 
                            <div className="head">
                                <h3>Are you sure you want to cancel this gig?</h3>
                                <p>The venue will be refunded the gig fee and the gig re-listed.</p>
                            </div>
                            <div className='two-buttons'>
                                <button className='btn tertiary' onClick={handleCancelNo}>
                                    No
                                </button>
                                <button className='btn danger' onClick={() => setAskCancellationReason(true)}>
                                    Yes, Cancel Gig
                                </button>
                            </div>
                        </>
                    ) : askCancellationReason && (
                        <>
                            <div className="head">
                                <h3>Why are you cancelling?</h3>
                                <p>Please select a reason for the cancellation.</p>
                            </div>
                            <div className="body">
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
                            </div>
                            <div className='two-buttons'>
                                <button className='btn secondary' onClick={handleCancelNo}>
                                    Go Back
                                </button>
                                <button className='btn danger' onClick={handleConfirmCancel} disabled={!cancellationReason}>
                                    Confirm Cancellation
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
                            <img src={gigForHandbook.venue.photo} alt={gigForHandbook.venue.venueName} className='venue-img' />
                        </figure>
                        <div className='names-div'>
                            <h2>{gigForHandbook.venue.venueName}</h2>
                            <h6>Hosted By: {gigForHandbook.accountName}</h6>
                        </div>
                    </div>
                    <div className='musician-actions'>
                        <button className='btn tertiary' onClick={(e) => openInNewTab(`/gig/${gigForHandbook.gigId}`, e)}>
                            Gig Page <NewTabIcon />
                        </button>
                        <button className='btn primary' onClick={() => setShowPromoteModal(true)}>
                            <PeopleGroupIcon /> Promote
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
                            <h3 className='text'>{formatDate(gigForHandbook.date)} {formatDurationSpan(gigForHandbook.startTime, gigForHandbook.duration)}</h3>
                        </div>
                        <div className='info-cont'>
                            <h3 className='subject'>Type of Gig</h3>
                            <h3 className='text'>{gigForHandbook.kind}</h3>
                        </div>
                        <div className='info-cont'>
                            <h3 className='subject'>Agreed Fee</h3>
                            <h3 className='text'>{gigForHandbook.agreedFee === '£' ? 'No Fee' : gigForHandbook.agreedFee}</h3>
                        </div>
                        <div className='info-cont'>
                            <h3 className='subject'>Requested Genres</h3>
                            <h3 className='text'>{formatGenres(gigForHandbook.genre)}</h3>
                        </div>
                    </div>
                    <div className='secondary-info'>
                        <div className='map'>
                            <div className='title-and-link'>
                                <h3>Location</h3>
                                <button className='btn text' onClick={() => openGoogleMaps(gigForHandbook.venue.address, gigForHandbook.coordinates)}>
                                    Maps
                                    <NewTabIcon />
                                </button>
                            </div>
                            <h4>{gigForHandbook.venue.address}</h4>
                            <div
                                ref={mapContainerRef}
                                className="map-container"
                            />
                        </div>
                        
                        {gigForHandbook.disputeClearingTime && (() => {
                            const { day, month, year, time } = splitDateAndTime(gigForHandbook.disputeClearingTime);
                            return (
                                <div className='info-box fee-clearance'>
                                <h3>Fee Clearance Date</h3>
                                <div className='fee-clearance-details'>
                                    <div className='date'>{day}<span className='ordinal-suffix'>{getOrdinalSuffix(day)}</span></div>
                                    <div className='month'>{month} {year}, {time}</div>
                                </div>
                                </div>
                            );
                        })()}

                        <div className={`info-box extra-information ${!gigForHandbook.disputeClearingTime ? 'full' : ''}`}>
                            <h3>Extra Information</h3>
                            <p>{gigForHandbook.extraInformation === '' ? 'No extra information.' : gigForHandbook.extraInformation}</p>
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