// Dependencies
import { useState, useEffect, useRef } from "react";
import mapboxgl from 'mapbox-gl';

// Styles
import '/styles/common/modals.styles.css'
import '/styles/musician/gig-handbook.styles.css'
import { NewTabIcon, PeopleGroupIcon } from "../ui/Extras/Icons";
import { httpsCallable } from 'firebase/functions';
import { functions, firestore } from '../../firebase';
import { LoadingThreeDots } from "../ui/loading/Loading";
import { doc, deleteField, updateDoc, arrayRemove, Timestamp, query, where, getDocs, collection, addDoc } from 'firebase/firestore';
import { useAuth } from "../../hooks/useAuth";
import { PromoteModal } from "../common/PromoteModal";



export const GigHandbook = ({ setShowGigHandbook, showGigHandbook, setGigForHandbook, gigForHandbook, usersConfirmedGigs, musicianId }) => {

    const { user } = useAuth();

    const [loading, setLoading] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [showPromoteModal, setShowPromoteModal] = useState(false);
    const [askCancellationReason, setAskCancellationReason] = useState(false);
    const [cancellationReason, setCancellationReason] = useState('');
    const mapContainerRef = useRef(null);

    useEffect(() => {
        if (gigForHandbook && !showConfirmation) {
            mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;
            const map = new mapboxgl.Map({
                container: mapContainerRef.current,
                style: 'mapbox://styles/gigin/clp5jayun01l901pr6ivg5npf',
                center: [gigForHandbook.coordinates[0], gigForHandbook.coordinates[1]],
                zoom: 15
            });
            new mapboxgl.Marker()
                .setLngLat([gigForHandbook.coordinates[0], gigForHandbook.coordinates[1]])
                .addTo(map);
            return () => map.remove();
        }
    }, [gigForHandbook, showConfirmation]);

    const handleModalClick = (e) => {
        if (loading) return;
        if (e.target.className === 'modal') {
            setShowGigHandbook(false);
        }
    };

    const formatDate = (timestamp) => {
        const date = timestamp.toDate();
        const day = date.getDate();
        const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
        const month = date.toLocaleDateString('en-GB', { month: 'long' });
        return `${weekday} ${day}${getOrdinalSuffix(day)} ${month}`;
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
            weekday, // e.g., "Monday"
            day, // e.g., "1st"
            month, // e.g., "January"
            year, // e.g., "2023"
            time, // e.g., "14:30"
        };
    };

    const formatDurationSpan = (startTime, duration) => {
        const [startHours, startMinutes] = startTime.split(':').map(Number);
        const startDate = new Date();
        startDate.setHours(startHours, startMinutes, 0, 0);
    
        const endDate = new Date(startDate.getTime() + duration * 60000);
    
        const formatTime = (date) => {
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${hours}:${minutes}`;
        };
    
        return `${formatTime(startDate)}-${formatTime(endDate)}`;
    };

    const formatGenres = (genres) => {
        if (genres.length === 0) return '';
        if (genres.length === 1) return genres[0];
        const copiedGenres = [...genres];
        const lastGenre = copiedGenres.pop();
        return `${copiedGenres.join(', ')} or ${lastGenre}`;
    };

    const openGoogleMaps = (address, coordinates) => {
        const baseUrl = "https://www.google.com/maps/dir/?api=1";
        const queryParams = coordinates 
            ? `&destination=${coordinates[1]},${coordinates[0]}`
            : `&destination=${encodeURIComponent(address)}`;
        window.open(baseUrl + queryParams, '_blank');
    };

    const handleGigCancelation = () => {
        setShowConfirmation(true); // Show the confirmation modal
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
        const cancelCloudTask = httpsCallable(functions, 'cancelCloudTask');
        const processRefund = httpsCallable(functions, 'processRefund');
        try {
            let taskName;
            taskName = gigForHandbook.clearPendingFeeTaskName;
            await cancelCloudTask({taskName});
            taskName = gigForHandbook.automaticMessageTaskName;
            await cancelCloudTask({taskName})
            const transactionId = gigForHandbook.transactionId;
            await processRefund({transactionId});
            const gigId = gigForHandbook.gigId;
            const conversationId = await  getOrCreateConversation(musicianId, gigForHandbook.gigId)
            const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
            await addDoc(messagesRef, {
                senderId: user.uid,
                text: `${user.musicianProfile.name} has unfortunately had to cancel because ${formatCancellationReason(cancellationReason)}. You have been refunded the gig fee - refunds can take 3-10 business days to appear in your account. The gig has been re-posted for musicians to apply to.`,
                type: "announcement",
                status: "cancellation",
                timestamp: Timestamp.now(),
            });
            const gigRef = doc(firestore, 'gigs', gigForHandbook.gigId);
            const musicianRef = doc(firestore, 'musicianProfiles', musicianId);
            const updatedApplicants = gigForHandbook.applicants.filter(
                (applicant) => applicant.id !== musicianId
            );
            await updateDoc(gigRef, {
                applicants: updatedApplicants,
                agreedFee: deleteField(),
                disputeClearingTime: deleteField(),
                disputeLogged: deleteField(),
                musicianFeeStatus: deleteField(),
                paymentStatus: deleteField(),
                clearPendingFeeTaskName: deleteField(),
                automaticMessageTaskName: deleteField(),
                paid: false,
                status: "open",
                cancellationReason,
              });
            await updateDoc(musicianRef, {
                gigApplications: arrayRemove(gigForHandbook.gigId),
                confirmedGigs: arrayRemove(gigForHandbook.gigId),
            })
            const cancellationRef = collection(firestore, 'cancellations');
            await addDoc(cancellationRef, {
                gigId: gigForHandbook.gigId,
                musicianId,
                reason: cancellationReason,
                timestamp: Timestamp.now(),
            });
            console.log(`Gig ${gigId} updated successfully.`);
            setLoading(false);
            setShowGigHandbook(false);
            window.location.reload();
        } catch (error) {
            console.error('Error canceling task:', error.message);
            setLoading(false);
        }
    };

    const getOrCreateConversation = async (musicianId, gigId) => {
        const conversationsRef = collection(firestore, 'conversations');
        const conversationQuery = query(
            conversationsRef,
            where('participants', 'array-contains', musicianId),
            where('gigId', '==', gigId)
        );
        const conversationSnapshot = await getDocs(conversationQuery);
        const conversationId = conversationSnapshot.docs[0].id;
        return conversationId;
    };
    
    const handleCancelNo = () => {
        setShowConfirmation(false);
    };

    const openGig = (gigId) => {
        const url = `/gig/${gigId}`;
        window.open(url, '_blank');
    };

    return (
        <div className="modal" onClick={handleModalClick}>
            {showConfirmation ? (
                <div className="modal-content confirmation-modal" onClick={(e) => e.stopPropagation()}>
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
                            <div className="two-buttons">
                                <button className="btn danger" onClick={() => setAskCancellationReason(true)}>
                                    Yes
                                </button>
                                <button className="btn secondary" onClick={handleCancelNo}>
                                    No
                                </button>
                            </div>
                        </>
                    ) : askCancellationReason && (
                        <>
                            <h3>Why are you cancelling?</h3>
                            <select id="cancellation-reason" value={cancellationReason} onChange={(e) => setCancellationReason(e.target.value)}>
                                <option value="">Select a reason</option>
                                <option value="fee">Fee Dispute</option>
                                <option value="availability">Availability</option>
                                <option value="double-booking">Double Booking</option>
                                <option value="personal-reasons">Personal Reasons</option>
                                <option value="illness">Illness</option>
                                <option value="information">Not Enough Information</option>
                                <option value="other">Other</option>
                            </select>
                            <div className="two-buttons">
                                <button className="btn danger" onClick={handleConfirmCancel} disabled={!cancellationReason}>
                                    Confirm
                                </button>
                                <button className="btn secondary" onClick={handleCancelNo}>
                                    Cancel
                                </button>
                            </div>
                        </>
                    )}
                </div>
            ) : (
                <div className="modal-content gig-handbook" onClick={(e) => e.stopPropagation()}>
                <div className="head">
                    <div className="venue-info">
                        <figure className="venue-img-cont">
                            <img src={gigForHandbook.venue.photo} alt={gigForHandbook.venue.venueName} className="venue-img" />
                        </figure>
                        <div className="names-div">
                            <h2>{gigForHandbook.venue.venueName}</h2>
                            <h6>{gigForHandbook.accountName}</h6>
                        </div>
                    </div>
                    <div className="musician-actions">
                        <button className="btn tertiary" onClick={() => openGig(gigForHandbook.gigId)}>
                            Gig Page <NewTabIcon />
                        </button>
                        <button className="btn primary" onClick={() => setShowPromoteModal(true)}>
                            <PeopleGroupIcon /> Promote
                        </button>
                        <button className="btn danger" onClick={() => handleGigCancelation()}>
                            Cancel Gig
                        </button>
                    </div>
                </div>
                <div className="body">
                    <div className="primary-info">
                        <div className="info-cont">
                            <h3 className="subject">Date and Time</h3>
                            <h3 className="text">{formatDate(gigForHandbook.date)} {formatDurationSpan(gigForHandbook.startTime, gigForHandbook.duration)}</h3>
                        </div>
                        <div className="info-cont">
                            <h3 className="subject">Type of Gig</h3>
                            <h3 className="text">{gigForHandbook.kind}</h3>
                        </div>
                        <div className="info-cont">
                            <h3 className="subject">Agreed Fee</h3>
                            <h3 className="text">{gigForHandbook.agreedFee}</h3>
                        </div>
                        <div className="info-cont">
                            <h3 className="subject">Requested Genres</h3>
                            <h3 className="text">{formatGenres(gigForHandbook.genre)}</h3>
                        </div>
                    </div>
                    <div className="secondary-info">
                        <div className="map">
                            <div className="title-and-link">
                                <h3>Location</h3>
                                <button className="btn text" onClick={() => openGoogleMaps(gigForHandbook.venue.address, gigForHandbook.coordinates)}>
                                    Maps
                                    <NewTabIcon />
                                </button>
                            </div>
                            <h4>{gigForHandbook.venue.address}</h4>
                            <div ref={mapContainerRef} className="map-container" />
                        </div>
                        <div className="info-box fee-clearance">
                            <h3>Fee Clearance Date</h3>
                            {gigForHandbook.disputeClearingTime && (
                                (() => {
                                    const { day, month, year, time } = splitDateAndTime(gigForHandbook.disputeClearingTime);
                                    return (
                                        <div className="fee-clearance-details">
                                            <div className="date">{day}<span className="ordinal-suffix">{getOrdinalSuffix(day)}</span></div>
                                            <div className="month">{month} {year}, {time}</div>
                                        </div>
                                    );
                                })()
                            )}
                        </div>
                        <div className="info-box extra-information">
                            <h3>Extra Information</h3>
                            <p>{gigForHandbook.extraInformation === '' ? 'No extra information.' : gigForHandbook.extraInformation}</p>
                        </div>
                    </div>
                </div>
                {(!loading) && (
                    <button className="btn close tertiary" onClick={() => {setShowGigHandbook(false)}}>
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