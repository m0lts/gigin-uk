import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom"
import { Header as MusicianHeader } from "../../../components/musician-components/Header";
import { Header as VenueHeader } from "../../../components/venue-components/Header";
import { firestore } from '../../../firebase';
import { getDoc, doc, collection, query, updateDoc, arrayUnion, where, documentId, Timestamp, getDocs, addDoc } from 'firebase/firestore';
import { OverviewTab } from "../Dashboard/Profile/OverviewTab";
import { MusicTab } from "../Dashboard/Profile/MusicTab";
import { ReviewsTab } from "../Dashboard/Profile/ReviewsTab";
import { CardIcon, ClockIcon, InviteIcon, MailboxEmptyIcon, RejectedIcon, SaveIcon, SavedIcon, StarIcon, TickIcon } from "../../../components/ui/Extras/Icons";
import { useGigs } from "../../../context/GigsContext";
import { LoadingScreen } from "../../../components/ui/loading/LoadingScreen";
import { LoadingThreeDots } from "../../../components/ui/loading/Loading";

export const MusicianProfile = ({ user, setAuthModal, setAuthType }) => {

    const { musicianId, gigId } = useParams();
    const navigate = useNavigate();

    const { gigs } = useGigs();

    const [musicianProfile, setMusicianProfile] = useState();
    const [applicantData, setApplicantData] = useState();
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [padding, setPadding] = useState('5%');

    const [musicianSaved, setMusicianSaved] = useState(false);
    const [savingMusician, setSavingMusician] = useState(false);
    const [inviteMusicianModal, setInviteMusicianModal] = useState(false);
    const [usersGigs, setUsersGigs] = useState([]);
    const [selectedGig, setSelectedGig] = useState();
    const [invitedMusician, setInvitedMusician] = useState(false);


    useEffect(() => {
        const fetchMusicianProfile = async () => {
            try {
                const musicianRef = doc(firestore, 'musicianProfiles', musicianId);
                const musicianSnapshot = await getDoc(musicianRef);
                if (musicianSnapshot.exists()) {
                    const musician = musicianSnapshot.data();
                    setMusicianProfile(musician);

                    if (gigs) {
                        const currentGig = gigs.find(gig => gig.gigId === gigId);
                        const applicant = currentGig.applicants.find(applicant => applicant.id === musician.musicianId);
                        setApplicantData(applicant);
                        if (applicant.invited) {
                            setInvitedMusician(true);
                        }
                    }

                } else {
                    console.error('No such musician!');
                }
            } catch (error) {
                console.error('Error fetching musician profile', error);
            } finally {
                setLoading(false);
            }
        };

        const getSavedMusicians = async () => {
            if (user?.savedMusicians && user.savedMusicians.length > 0) {
                const activeMusicianSaved = user.savedMusicians.includes(musicianId);
                setMusicianSaved(!!activeMusicianSaved); // Set to true if musician is found, otherwise false
            } else {
                setMusicianSaved(false); // If no saved musicians, set to false
            }
        }


        fetchMusicianProfile();
        getSavedMusicians();

    }, [musicianId, gigId]);

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
    
    const renderActiveTabContent = () => {
        switch (activeTab) {
            case 'overview':
                return <OverviewTab musicianData={musicianProfile} />; 
            case 'music':
                return <MusicTab videos={musicianProfile.videos} tracks={musicianProfile.tracks}/>;
            case 'reviews':
                return <ReviewsTab profile={musicianProfile} />;
            default:
                return null;
        }        
    };       

    const handleSaveMusician = async () => {
        if (user && musicianId) {
            setSavingMusician(true);
            try {
                // Reference to the user's document
                const userRef = doc(firestore, 'users', user.uid);
    
                // Update the user document by adding the musicianId to the musicianProfiles array
                await updateDoc(userRef, {
                    savedMusicians: arrayUnion(musicianId) // Add the musicianId to the array
                });
                setMusicianSaved(true)
            } catch (error) {
                console.error('Error updating user document: ', error);
            } finally {
                setSavingMusician(false);
            }
        }
    }
    const formatDateLong = (timestamp) => {
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


    const getOrCreateConversation = async (musicianProfile, gigData, venueProfile, type) => {

        const conversationsRef = collection(firestore, 'conversations');
        const conversationQuery = query(
            conversationsRef,
            where('participants', 'array-contains', musicianProfile.musicianId),
            where('gigId', '==', gigData.gigId)
        );
        const conversationSnapshot = await getDocs(conversationQuery);
    
        let conversationId;
    
        if (conversationSnapshot.empty) {
            // Create a new conversation
            const newConversation = {
                participants: [
                    gigData.venueId,
                    musicianProfile.musicianId
                ],
                accountNames: [
                    { participantId: gigData.venueId, accountName: venueProfile.accountName, accountId: venueProfile.user, role: 'venue', venueName: gigData.venue.venueName, venueImg: venueProfile.photos[0] }, 
                    { participantId: musicianProfile.musicianId, accountName: musicianProfile.name, accountId: musicianProfile.userId, role: 'musician', musicianImg: musicianProfile.picture }
                ],
                gigDate: gigData.date,
                gigId: gigData.gigId,
                lastMessageTimestamp: Timestamp.now(),
                lastMessage: `${venueProfile.accountName} invited ${musicianProfile.name} to play the the gig at the ${gigData.venue.venueName} on ${formatDateLong(gigData.date)}.`,
                status: "open",
                createdAt: Timestamp.now(),
            };
    
            const conversationDocRef = await addDoc(conversationsRef, newConversation);
            conversationId = conversationDocRef.id;
        } else {
            // If a conversation already exists, get its ID
            conversationId = conversationSnapshot.docs[0].id;
        }
    
        return conversationId;
    };

    const handleInviteMusician = async () => {

        if (!user) {
            setAuthModal(true);
            setAuthType('login');
            return;
        };

        if (!user.venueProfiles) {
            alert('You must create a venue profile and post a gig before inviting a musician to one.'); // Add alert here
            return;
        }
    
        // Step 1: Extract all gig IDs from the venueProfiles array into one array
        const gigIds = user.venueProfiles
            .flatMap(venueProfile => venueProfile.gigs || []); // Flatten the gig arrays from all venue profiles
    
        if (gigIds.length === 0) {
            alert('You must post a gig before inviting a musician to one.'); // Add alert here
            return;
        }

    
        // Step 2: Fetch gigs from Firestore where the document ID matches one of the gig IDs and the date is in the future
        try {
            // Step 2: Fetch all gigs by their document ID (gig IDs)
            const gigsRef = collection(firestore, 'gigs');
            const gigsQuery = query(gigsRef, where(documentId(), 'in', gigIds));
    
            const gigsSnapshot = await getDocs(gigsQuery);
            const gigs = gigsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

    
            // Step 3: Filter gigs to only include those where the date is in the future
            const futureGigs = gigs.filter(gig => gig.date > Timestamp.now());
            const availableGigs = futureGigs.filter(gig => 
                !gig.applicants.some(applicant => applicant.id === musicianId && applicant.status !== 'Declined')
            );
    
            if (availableGigs.length > 0) {
                setInviteMusicianModal(true);
                setUsersGigs(futureGigs)
            } else {
                alert('There are no eligible gigs to invite this musician to.');
            }
        } catch (error) {
            console.error('Error fetching future gigs:', error);
        }
    };

    const handleSendMusicianInvite = async (gigData) => {

        if (!musicianProfile || !gigData) {
            return;
        }

        const venueToSend = user.venueProfiles.find(venue => venue.id === gigData.venueId);

        // Check if the venue was found
        if (!venueToSend) {
            console.error('Venue not found in user profiles.');
            return;
        }
        try {
            const applicants = gigData.applicants;

            // Add the new application to the applicants array
            const newApplication = {
                id: musicianProfile.musicianId,
                timestamp: Timestamp.now(),
                fee: gigData.budget || '£0',
                status: 'Pending',
                invited: true,
            };

            // Update the applicants array
            const updatedApplicants = [...applicants, newApplication];

            // Update the gig document with the new applicants array
            const gigRef = doc(firestore, 'gigs', gigData.gigId);
            await updateDoc(gigRef, {
                applicants: updatedApplicants,
            });

            const updatedGigApplicationsArray = musicianProfile.gigApplications ? [...musicianProfile.gigApplications, gigData.gigId] : [gigData.gigId];

            const musicianProfileId = musicianProfile.musicianId;
            const musicianProfileRef = doc(firestore, 'musicianProfiles', musicianProfileId);
            await updateDoc(musicianProfileRef, {
                gigApplications: updatedGigApplicationsArray,
            });

            // Assume gigData and venueProfile are already available in the scope
            const conversationId = await getOrCreateConversation(musicianProfile, gigData, venueToSend, 'message');
    
            // Navigate the user to the messages page after conversation creation
            const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
            if (gigData.kind === 'Ticketed Gig' || gigData.kind === 'Open Mic') {
                await addDoc(messagesRef, {
                    senderId: user.uid,
                    text:`${venueToSend.accountName} invited ${musicianProfile.name} to play at their gig at ${gigData.venue.venueName} on the ${formatDate(gigData.date)}.`,
                    type: "invitation",
                    status: 'Pending...',
                    timestamp: Timestamp.now(),
                });
            } else {
                await addDoc(messagesRef, {
                    senderId: user.uid,
                    text:`${venueToSend.accountName} invited ${musicianProfile.name} to play at their gig at ${gigData.venue.venueName} on the ${formatDate(gigData.date)} for ${gigData.budget}.`,
                    type: "invitation",
                    status: 'Pending...',
                    timestamp: Timestamp.now(),
                });
            }

            setInviteMusicianModal(false);
            setInvitedMusician(true);

        } catch (error) {
            console.error('Error while creating or fetching conversation:', error);
        }
    };

    const formatDate = (date) => {
        const d = date.toDate();
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0'); // Months are 0-based
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year}`;
    }

    return (
        <div className="musician-profile-page">
            {user.venueProfiles && user.venueProfiles.length > 0 ? (
                <VenueHeader
                    user={user}
                    setAuthModal={setAuthModal}
                    setAuthType={setAuthType}
                    padding={padding}
                />
            ) : (
                <MusicianHeader
                    user={user}
                    setAuthModal={setAuthModal}
                    setAuthType={setAuthType}
                />
            )}
            {loading ? (
                <LoadingScreen />
            ) : (
                <div className="profile" style={{ padding: `0 ${padding}` }}>
                    <div className="profile-banner">
                        <div className="profile-information">
                            <figure className="profile-picture">
                                <img src={musicianProfile.picture} alt={`${musicianProfile.name}'s Profile Picture`} />
                            </figure>
                            <div className="profile-details">
                                <h1>{musicianProfile.name}</h1>
                                <div className="data">
                                    {musicianProfile.avgReviews && (
                                        <h6><StarIcon /> {musicianProfile.avgReviews.avgRating} ({musicianProfile.avgReviews.totalReviews})</h6>
                                    )}
                                    <h6>{musicianProfile.clearedFees ? musicianProfile.clearedFees.length : '0'} gigs played</h6>
                                </div>
                                <div className="genre-tags">
                                    {musicianProfile.genres && musicianProfile.genres.map((genre, index) => (
                                        <div className="genre-tag" key={index}>
                                            {genre}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                            {/* {applicantData && (
                        <div className="profile-actions applicant">
                            <h2>{applicantData.fee}</h2>
                            {applicantData.status === 'Accepted' && (
                                <div className="status-box">
                                    <div className="status confirmed">
                                        <TickIcon />
                                        Accepted
                                    </div>
                                </div>
                            )}
                            {applicantData.status === 'Declined' && (
                                <div className="status-box">
                                    <div className="status rejected">
                                        <RejectedIcon />
                                        Declined
                                    </div>
                                </div>
                            )}
                        </div>
                            )} */}
                        {user.venueProfiles.length > 0 && (
                            <div className="profile-actions venue">
                                    {invitedMusician ? (
                                    <button className="btn primary" onClick={handleInviteMusician}>
                                        <TickIcon />
                                        Invited
                                    </button>
                                    ) : (
                                        <button className="btn primary" onClick={handleInviteMusician}>
                                            <InviteIcon />
                                            Invite
                                        </button>
    
                                    )}
                                <button className="btn secondary" onClick={handleSaveMusician} disabled={user?.savedMusicians?.includes(musicianId)}>
                                    {musicianSaved ? (
                                        <>
                                            <SavedIcon />
                                            Saved
                                        </>
                                    ) : (
                                        savingMusician ? (
                                            <LoadingThreeDots />
                                        ) : (
                                            <>
                                                <SaveIcon />
                                                Save
                                            </>
                                        )
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                    <nav className="profile-tabs">
                        <p onClick={() => setActiveTab('overview')} className={`profile-tab ${activeTab === 'overview' ? 'active' : ''}`}>
                            Overview
                        </p>
                        <p onClick={() => setActiveTab('music')} className={`profile-tab ${activeTab === 'music' ? 'active' : ''}`}>
                            Music
                        </p>
                        <p onClick={() => setActiveTab('reviews')} className={`profile-tab ${activeTab === 'reviews' ? 'active' : ''}`}>
                            Reviews
                        </p>
                    </nav>
                    <div className="profile-sections">
                        {renderActiveTabContent()}
                    </div>
                </div>
            )}

            {inviteMusicianModal && (
                <div className="modal">
                    <div className="modal-content">
                        <h2>Select a gig to invite {musicianProfile.name} to play at.</h2>
                        <div className="gig-selection">
                            {usersGigs.length > 0 && (
                                usersGigs.map((gig, index) => (
                                    <div className={`card ${selectedGig === gig ? 'selected' : ''}`} key={index} onClick={() => setSelectedGig(gig)}>
                                        <h4 className="text">{gig.venue.venueName}</h4>
                                        <p className="sub-text">{formatDate(gig.date)} - {gig.startTime}</p>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="two-buttons">
                            <button className="btn secondary" onClick={() => setInviteMusicianModal(false)}>Cancel</button>
                            <button className="btn primary-alt" disabled={!selectedGig} onClick={() => handleSendMusicianInvite(selectedGig)}>Invite</button>
                        </div>
                    </div>
                </div>
            )}
        </div>

        
    );
}