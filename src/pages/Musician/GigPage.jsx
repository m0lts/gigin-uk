import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { firestore } from '../../firebase';
import { Header } from '../../components/musician-components/Header';
import { getDoc, doc, getDocs, collection, Timestamp, updateDoc, addDoc, query, where } from 'firebase/firestore';
import '/styles/musician/gig-page.styles.css';
import { BackgroundMusicIcon, ClubIcon, GuitarsIcon, HouseIcon, InviteIcon, MicrophoneIcon, MicrophoneLinesIcon, PeopleGroupIcon, SaveIcon, ShareIcon, SpeakersIcon, TicketIcon, WeddingIcon } from '../../components/ui/Extras/Icons';
import Skeleton from 'react-loading-skeleton';
import mapboxgl from 'mapbox-gl';
import 'react-loading-skeleton/dist/skeleton.css';
import { LoadingThreeDots } from '../../components/ui/loading/Loading';
import { useGigs } from '../../context/GigsContext';

export const GigPage = ({ user, setAuthModal, setAuthType }) => {
    const { gigId } = useParams();
    const navigate = useNavigate();

    const { gigs } = useGigs();

    const [gigData, setGigData] = useState(null);
    const [venueProfile, setVenueProfile] = useState(null);
    const [similarGigs, setSimilarGigs] = useState([]);
    const [loading, setLoading] = useState(true);
    const mapContainerRef = useRef(null);
    const [padding, setPadding] = useState('5%');
    const [fullscreenImage, setFullscreenImage] = useState(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [applyingToGig, setApplyingToGig] = useState(false);
    const [noProfileModal, setNoProfileModal] = useState(false);
    const [incompleteMusicianProfile, setIncompleteMusicianProfile] = useState(null);
    const [userAppliedToGig, setUserAppliedToGig] = useState(false);
    const [negotiateModal, setNegotiateModal] = useState(false);
    const [newOffer, setNewOffer] = useState();

    useEffect(() => {
        const filterGigData = async () => {
            
            if (!gigs || !gigId) return;

            const gig = gigs.find(gig => gig.id === gigId);

            if (gig) {
                setGigData(gig);
            }

            // Check if the user has already applied to this gig
            if (user && user.musicianProfile) {
                const musicianProfileId = user.musicianProfile.musicianId;
                const userHasApplied = gig.applicants.some(applicant => applicant.id === musicianProfileId);
                setUserAppliedToGig(userHasApplied);
            }

            if (gig) {
                // Fetch venue profile data
                const venueRef = doc(firestore, 'venueProfiles', gig.venueId);
                const venueSnapshot = await getDoc(venueRef);
                if (venueSnapshot.exists()) {
                    setVenueProfile(venueSnapshot.data());
                }
                setLoading(false);
            }

            // Fetch similar gigs
            const similarGigsList = gigs
                .filter(similarGig => similarGig.id !== gigId)
                .map(gig => ({ id: gig.id, ...gig }));
            setSimilarGigs(similarGigsList);

        }

        filterGigData();

    }, [gigs, gigId, user]);


    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth > 1100) {
                setPadding('15vw');
            } else {
                setPadding('1rem');
            }
        };

        handleResize(); // Set initial padding
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    useEffect(() => {
        if (venueProfile && venueProfile.coordinates) {
            mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

            const map = new mapboxgl.Map({
                container: mapContainerRef.current,
                style: 'mapbox://styles/gigin/clp5jayun01l901pr6ivg5npf',
                center: [venueProfile.coordinates[0], venueProfile.coordinates[1]],
                zoom: 15
            });

            new mapboxgl.Marker()
                .setLngLat([venueProfile.coordinates[0], venueProfile.coordinates[1]])
                .addTo(map);

            return () => map.remove();
        }
    }, [venueProfile]);

    if (!gigData) {
        return <div>No gig data found.</div>;
    }

    const handleImageClick = (index) => {
        setFullscreenImage(venueProfile.photos[index]);
        setCurrentImageIndex(index);
    };

    const closeFullscreen = () => {
        setFullscreenImage(null);
    };

    const showNextImage = (e) => {
        e.stopPropagation();
        setCurrentImageIndex((prevIndex) => (prevIndex + 1) % venueProfile.photos.length);
        setFullscreenImage(venueProfile.photos[(currentImageIndex + 1) % venueProfile.photos.length]);
    };

    const showPrevImage = (e) => {
        e.stopPropagation();
        setCurrentImageIndex((prevIndex) => (prevIndex - 1 + venueProfile.photos.length) % venueProfile.photos.length);
        setFullscreenImage(venueProfile.photos[(currentImageIndex - 1 + venueProfile.photos.length) % venueProfile.photos.length]);
    };

    const getCityFromAddress = (address) => {
        const parts = address.split(',');
        return parts.length >= 3 ? parts[parts.length - 3].trim() : address;
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

    const formatDate = (timestamp) => {
        const date = timestamp.toDate();
        const day = date.getDate();
        const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
        const month = date.toLocaleDateString('en-GB', { month: 'long' });
        return `${weekday} ${day}${getOrdinalSuffix(day)} ${month}`;
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
    
        return `${formatTime(startDate)} - ${formatTime(endDate)}`;
    };

    const formatGenres = (genres) => {
        if (genres.length === 0) return '';
        if (genres.length === 1) return genres[0];
        const copiedGenres = [...genres];
        const lastGenre = copiedGenres.pop();
        return `${copiedGenres.join(', ')} or ${lastGenre}`;
    };

    const formatTime = (timeString) => {
        const [hours, minutes] = timeString.split(':').map(Number);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    };

    const calculateTime = (time, offset) => {
        const [hours, minutes] = time.split(':').map(Number);
        const totalMinutes = (hours * 60) + minutes + offset;
        const newHours = Math.floor((totalMinutes + 1440) % 1440 / 60);
        const newMinutes = totalMinutes % 60;
        return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
    };

    const calculateEndTime = () => {
        return calculateTime(gigData.startTime, gigData.duration);
    };

    const startTimeMinusOneHour = gigData.startTime ? calculateTime(gigData.startTime, -60) : '00:00';
    const endTime = gigData.startTime && gigData.duration ? calculateEndTime() : '00:00';

    const openMusicianGig = (gigId) => {
        const url = `/musician/${gigId}`;
        window.open(url, '_blank');
    };

    const formatDuration = (duration) => {
        const hours = Math.floor(duration / 60);
        const minutes = duration % 60;
        const hourStr = hours === 1 ? 'hr' : 'hrs';
        const minuteStr = minutes === 1 ? 'min' : 'mins';
    
        if (minutes === 0) {
            return `${hours} ${hourStr}`;
        } else if (hours === 0) {
            return `${minutes} ${minuteStr}`;
        } else {
            return `${hours} ${hourStr} and ${minutes} ${minuteStr}`;
        }
    };

    const calculateServiceFee = (budget) => {
        const numericBudget = parseFloat(budget.replace('£', ''));
        const fee = (numericBudget * 0.05).toFixed(2);
        return parseFloat(fee);
    };
    
    const calculateTotalIncome = (budget) => {
        const numericBudget = parseFloat(budget.replace('£', ''));
        const fee = (numericBudget * 0.05).toFixed(2);
        const income = numericBudget - parseFloat(fee);
        return income.toFixed(2);
    };

    const performerIcon = (input) => {
        if (input === 'Musician/Band') {
            return <MicrophoneIcon />
        } else {
            return <ClubIcon />
        }
    }

    const privacyIcon = (input) => {
        if (input === 'Public') {
            return <PeopleGroupIcon />
        } else {
            return <InviteIcon />
        }
    }

    const typeIcon = (input) => {
        if (input === "Background Music") {
            return <BackgroundMusicIcon />
        } else if (input === "Live Music") {
            return <GuitarsIcon />
        } else if (input === "Ticketed Gig") {
            return <TicketIcon />
        } else if (input === "House Party") {
            return <HouseIcon />
        } else if (input === "Wedding") {
            return <WeddingIcon />
        } else {
            <MicrophoneLinesIcon />
        }
    }

    const handleBudgetChange = (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        setNewOffer(`£${value}`)
    };

    const handleGigApplication = async () => {
        if (!user) {
            setAuthModal(true);
            setAuthType('login');
            setApplyingToGig(false);
            return;
        };
        if (userAppliedToGig) return;
        setApplyingToGig(true);

        if (!user.musicianProfile) {
            setNoProfileModal(true);
            setApplyingToGig(false);
            return;
        }

        try {
            // Check if musician profile is complete
            if (!user.musicianProfile.completed) {
                setNoProfileModal(true);
                setIncompleteMusicianProfile(user.musicianProfile);
                return;
            }

            if (user.musicianProfile.completed) {

                const applicants = gigData.applicants;

                // Add the new application to the applicants array
                const newApplication = {
                    id: user.musicianProfile.musicianId,
                    timestamp: Timestamp.now(),
                    fee: gigData.budget || '£0',
                    status: 'Pending',
                };

                // Update the applicants array
                const updatedApplicants = [...applicants, newApplication];

                // Update the gig document with the new applicants array
                const gigRef = doc(firestore, 'gigs', gigId);
                await updateDoc(gigRef, {
                    applicants: updatedApplicants,
                });

                setGigData(prevData => ({
                    ...prevData,
                    applicants: updatedApplicants,
                }));

                const updatedGigApplicationsArray = user.musicianProfile.gigApplications ? [...user.musicianProfile.gigApplications, gigId] : [gigId];

                const musicianProfileId = user.musicianProfile.musicianId;
                const musicianProfileRef = doc(firestore, 'musicianProfiles', musicianProfileId);
                await updateDoc(musicianProfileRef, {
                    gigApplications: updatedGigApplicationsArray,
                });

                // // Step 1: Check if a conversation already exists
                // const conversationsRef = collection(firestore, 'conversations');
                // const conversationQuery = query(conversationsRef, where('participants', 'array-contains', musicianProfileId), where('gigId', '==', gigId));
                // const conversationSnapshot = await getDocs(conversationQuery);

                // let conversationId;

                // if (conversationSnapshot.empty) {
                //     // Step 2: If no conversation exists, create a new one
                //     const newConversation = {
                //         participants: [
                //             gigData.venueId,
                //             musicianProfileId
                //         ],
                //         accountNames: [
                //             { participantId: gigData.venueId, accountName: gigData.accountName, accountId: venueProfile.user, role: 'venue' }, 
                //             { participantId: musicianProfileId, accountName: musicianProfile.name, accountId: musicianProfile.userId, role: 'musician' }
                //         ],
                //         gigId: gigId,
                //         lastMessage: `${musicianProfile.name} applied to the gig on ${formatDate(gigData.date)} at ${gigData.venue.venueName}.`,
                //         lastMessageTimestamp: Timestamp.now(),
                //         status: "open",
                //         createdAt: Timestamp.now(),
                //     };
                //     const conversationDocRef = await addDoc(conversationsRef, newConversation);
                //     conversationId = conversationDocRef.id;
                // } else {
                //     // If a conversation already exists, get its ID
                //     conversationId = conversationSnapshot.docs[0].id;
                // }

                // // Step 3: Send an automatic message to the host
                // const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
                // await addDoc(messagesRef, {
                //     senderId: user.uid,
                //     receiverId: venueProfile.user,
                //     text: `${musicianProfile.name} has applied to your gig on ${formatDate(gigData.date)} at ${gigData.venue.venueName} for ${gigData.budget}`,
                //     type: "application",
                //     status: 'Pending...',
                //     timestamp: Timestamp.now(),
                // });

                // Set application state to success
                setUserAppliedToGig(true);
            }
        } catch (error) {
            console.error(error)
        } finally {
            setApplyingToGig(false);
        }
    }

    const handleNegotiateButtonClick = () => {        
        if (!user) {
            setAuthModal(true);
            setAuthType('login');
            setApplyingToGig(false);
            return;
        } else if (!user.musicianProfile.completed) {
            setNoProfileModal(true);
            setIncompleteMusicianProfile(musicianProfile);
            return;
        } else {
            setNegotiateModal(true);
        }
    }

    const handleNegotiate = async () => {

        if (userAppliedToGig) return;

        if (!user.musicianProfile) {
            setNoProfileModal(true);
            setApplyingToGig(false);
            return;
        }

        if (!newOffer) return;

        try {
            // Check if musician profile is complete
            if (!user.musicianProfile.completed) {
                setNoProfileModal(true);
                setIncompleteMusicianProfile(user.musicianProfile);
                return;
            }

            if (user.musicianProfile.completed) {

                const applicants = gigData.applicants;

                // Add the new application to the applicants array
                const newApplication = {
                    id: user.musicianProfile.musicianId,
                    timestamp: Timestamp.now(),
                    fee: newOffer || '£0',
                    status: 'Pending',
                };

                // Update the applicants array
                const updatedApplicants = [...applicants, newApplication];

                // Update the gig document with the new applicants array
                const gigRef = doc(firestore, 'gigs', gigId);
                await updateDoc(gigRef, {
                    applicants: updatedApplicants,
                });

                setGigData(prevData => ({
                    ...prevData,
                    applicants: updatedApplicants,
                }));

                const updatedGigApplicationsArray = user.musicianProfile.gigApplications ? [...user.musicianProfile.gigApplications, gigId] : [gigId];

                const musicianProfileId = user.musicianProfile.musicianId;
                const musicianProfileRef = doc(firestore, 'musicianProfiles', musicianProfileId);
                await updateDoc(musicianProfileRef, {
                    gigApplications: updatedGigApplicationsArray,
                });

                // // Fetch or create the conversation (similar to the logic in handleGigApplication)
                // const conversationId = await getOrCreateConversation(musicianProfile, 'negotiation');
        
                // // Send a negotiation message
                // const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
                // await addDoc(messagesRef, {
                //     senderId: user.uid,
                //     receiverId: venueProfile.user,
                //     text: `${musicianProfile.name} wants to negotiate the fee for the gig on ${formatDate(gigData.date)} at ${gigData.venue.venueName}`,
                //     oldFee: gigData.budget,
                //     newFee: newOffer,
                //     type: "negotiation",
                //     timestamp: Timestamp.now(),
                // });
        }
        } catch (error) {
            console.error("Error sending negotiation message:", error);
        } finally {
            setNegotiateModal(false);
            setApplyingToGig(false);
        }
    };
    
    const handleMessage = async () => {
        console.log('message')
    };
    


    return (
        <div className='gig-page' style={{ padding: `0 ${padding}` }}>
            <Header
                user={user}
                setAuthModal={setAuthModal}
                setAuthType={setAuthType}
            />
            <section className="gig-page-body">
                {loading ? (
                    <>
                        <div className="head">
                            <div className="title">
                                <Skeleton height={40} width={400} />
                            </div>
                        </div>
                        <div className="images">
                            <Skeleton height={350} width="100%" />
                        </div>
                    </>
                ) : (
                    <>
                        <div className="head">
                            <div className="title">
                                <h1>{gigData.venue.venueName}</h1>
                                <p>{getCityFromAddress(gigData.venue.address)}</p>
                            </div>
                            <div className="options">
                                <button className="btn icon">
                                    <ShareIcon />
                                </button>
                                <button className="btn icon">
                                    <SaveIcon />
                                </button>
                            </div>
                        </div>
                        <div className="images">
                            {venueProfile.photos.slice(0, 3).map((photo, index) => (
                                <figure key={index} className={`img-${index + 1}`} onClick={() => handleImageClick(index)}>
                                    <img src={photo} alt={`${gigData.venue.venueName} photo ${index + 1}`} />
                                    {index === 2 && venueProfile.photos.length > 3 && (
                                        <div className="more-overlay">+{venueProfile.photos.length - 3}</div>
                                    )}
                                </figure>
                            ))}
                        </div>
                        <div className="main">
                            <div className="gig-info">
                                <div className="important-info">
                                    <div className="date-and-time">
                                        <h2>{formatDate(gigData.date)}</h2>
                                        <h3>{formatDurationSpan(gigData.startTime, gigData.duration)}</h3>
                                    </div>
                                    <div className="address">
                                        <h4>{gigData.venue.address}</h4>
                                    </div>
                                    <div className="description">
                                        <p>{venueProfile.description}</p>
                                    </div>
                                </div>
                                <div className="details">
                                    <h4 className="subtitle">Details</h4>
                                    <div className="details-list">
                                        <div className="detail">
                                            <h6>Performer</h6>
                                            <div className="data">
                                                {performerIcon(gigData.gigType)}
                                                <p>{gigData.gigType}</p>
                                            </div>
                                        </div>
                                        <div className="detail">
                                            <h6>Audience</h6>
                                            <div className="data">
                                                {privacyIcon(gigData.privacy)}
                                                <p>{gigData.privacy}</p>
                                            </div>
                                        </div>
                                        <div className="detail">
                                            <h6>Type</h6>
                                            <div className="data">
                                                {typeIcon(gigData.kind)}
                                                <p>{gigData.kind}</p>
                                            </div>
                                        </div>
                                        {gigData.genre.length > 0 && (
                                            <div className="detail">
                                                <h6>Genres</h6>
                                                <div className="data">
                                                    <SpeakersIcon />
                                                    <p>{formatGenres(gigData.genre)}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="timeline">
                                    <h4 className="subtitle">Gig Timeline</h4>
                                    {gigData.startTime && (
                                        <div className="timeline-cont">
                                            <div className="timeline-event">
                                                <div className="timeline-content">
                                                    <p>Musician Arrives</p>
                                                    <div className="timeline-time">{startTimeMinusOneHour !== '00:00' ? formatTime(startTimeMinusOneHour) : '00:00'}</div>
                                                </div>
                                                <div className="timeline-line"></div>
                                            </div>
                                            <div className="timeline-event">
                                                <div className="timeline-content">
                                                    <p>Gig Starts</p>
                                                    <div className="timeline-time orange">{formatTime(gigData.startTime)}</div>
                                                </div>
                                                <div className="timeline-line"></div>
                                            </div>
                                            <div className="timeline-event">
                                                <div className="timeline-content">
                                                    <p>Gig Ends</p>
                                                    <div className="timeline-time orange">{endTime !== '00:00' ? formatTime(endTime) : '00:00'}</div>
                                                </div>
                                                <div className="timeline-line"></div>
                                            </div>
                                            <div className="timeline-event">
                                                <div className="timeline-content">
                                                    <p>Musician Leaves</p>
                                                    <div className="timeline-time">{endTime !== '00:00' ? formatTime(calculateTime(endTime, 60)) : '00:00'}</div>
                                                </div>
                                                <div className="timeline-line"></div>
                                            </div>
                                        </div>
                                    )}
                                    <div className='disclaimers'>
                                        <p>* The host expects musicians to take a break after each hour of performing.</p>
                                        <p>* You can discuss adjustments to the timings with the host in your messages.</p>
                                    </div>
                                </div>
                                <div className="location">
                                    <h4>Location</h4>
                                    <div ref={mapContainerRef} className="map-container" style={{ height: '300px', width: '75%', borderRadius: '5px' }} />
                                </div>
                                <div className="extra-info">
                                    <h4 className="subtitle">Extra Info</h4>
                                    <div className="info">
                                        <h6>Gig requests</h6>
                                        <div className="text">
                                            {gigData.extraInformation}
                                        </div>
                                    </div>
                                    <div className="info">
                                        <h6>Venue Information</h6>
                                        <div className="text">
                                            {venueProfile.extraInformation}
                                        </div>
                                    </div>
                                </div>
                                {similarGigs.length > 0 && (
                                    <div className="similar-gigs">
                                        <h4 className="subtitle">Similar Gigs</h4>
                                        <div className="similar-gigs-list">
                                            {similarGigs.map(gig => (
                                                <div key={gig.id} className="similar-gig-item" onClick={() => openMusicianGig(gig.id)}>
                                                    <div className="similar-gig-item-venue">
                                                        <figure className="similar-gig-img">
                                                            <img src={gig.venue.photo} alt={gig.venue.venueName} />
                                                        </figure>
                                                        <div className="similar-gig-info">
                                                            <h4>{gig.venue.venueName}</h4>
                                                            <p>{formatDate(gig.date)}</p>
                                                        </div>
                                                    </div>
                                                    <div className="similar-gig-budget">
                                                        <h3>{gig.budget}</h3>
                                                    </div>
                                                </div>                                            
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="action-box">
                                <div className="action-box-info">
                                    <div className="action-box-budget">
                                        <h1>{gigData.budget}</h1>
                                        <p>gig fee</p>
                                    </div>
                                    <div className="action-box-duration">
                                        <h4>{formatDuration(gigData.duration)}</h4>
                                    </div>
                                </div>
                                <div className="action-box-fees">
                                    <div className="action-box-service-fee">
                                        <p>Service Fee</p>
                                        <p>£{calculateServiceFee(gigData.budget)}</p>
                                    </div>
                                    <div className="action-box-total-income">
                                        <p>Total Income</p>
                                        <p>£{calculateTotalIncome(gigData.budget)}</p>
                                    </div>
                                </div>
                                <div className="action-box-buttons">
                                    {userAppliedToGig ? (
                                        <button className="btn primary disabled" disabled>
                                            Applied To Gig
                                        </button>
                                    ) : (
                                        <button className="btn primary" onClick={handleGigApplication}>
                                            {applyingToGig ? (
                                                <LoadingThreeDots />
                                            ) : (
                                                <>
                                                    Apply To Gig
                                                </>
                                            )}
                                        </button>
                                    )}
                                    <div className="two-buttons">
                                        <button className="btn primary-alt" onClick={handleNegotiateButtonClick}>
                                            Negotiate
                                        </button>
                                        <button className="btn primary-alt" onClick={handleMessage}>
                                            Message
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
                {fullscreenImage && (
                    <div className="fullscreen-overlay" onClick={closeFullscreen}>
                        <span className="arrow left" onClick={showPrevImage}>&#8249;</span>
                        <img src={fullscreenImage} alt="Fullscreen" />
                        <span className="arrow right" onClick={showNextImage}>&#8250;</span>
                    </div>
                )}
            </section>

            {noProfileModal && (
                <div className="modal">
                    <div className="modal-content">
                        <h2>No Complete Musician Profile Found</h2>
                        <p style={{ textAlign: 'center' }}>Please create or finish your profile before applying to gigs.</p>
                        <div className="two-buttons">
                            <button className="btn secondary" onClick={() => setNoProfileModal(false)}>Cancel</button>
                            <button className="btn primary-alt" onClick={() => navigate('/musician/create-musician-profile', { state: { incompleteMusicianProfile } })}>Create Profile</button>
                        </div>
                    </div>
                </div>
            )}

            {negotiateModal && (
                <div className="modal">
                    <div className="modal-content">
                        <h2>Negotiate the gig fee</h2>
                        <p style={{ textAlign: 'center' }}>Your offer:</p>
                        <input type="text" className='input' value={newOffer} onChange={(e) => handleBudgetChange(e)} placeholder={gigData.budget} />
                        <div className="two-buttons">
                            <button className="btn secondary" onClick={() => setNegotiateModal(false)}>Cancel</button>
                            <button className="btn primary-alt" disabled={!newOffer} onClick={handleNegotiate}>Send Offer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};