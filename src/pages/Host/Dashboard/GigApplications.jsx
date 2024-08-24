import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom"
import { doc, getDoc, updateDoc, onSnapshot, getDocs, Timestamp, collection, query, addDoc, where } from 'firebase/firestore';
import { firestore } from '../../../firebase';
import { LoadingThreeDots } from "../../../components/ui/loading/Loading";
import { ClockIcon, RejectedIcon, TickIcon } from "../../../components/ui/Extras/Icons";
import { useAuth } from "../../../hooks/useAuth";

export const GigApplications = () => {
    const location = useLocation();
    const { user } = useAuth();
    const [gigId, setGigId] = useState(location.state.gig.gigId)
    const [gigDate, setGigDate] = useState(location.state.gig.date);
    const [venueName, setVenueName] = useState(location.state.gig.venue.venueName);
    const [gigInfo, setGigInfo] = useState(null);
    const [musicianProfiles, setMusicianProfiles] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const gigRef = doc(firestore, 'gigs', gigId);

        // Set up the onSnapshot listener
        const unsubscribe = onSnapshot(gigRef, (gigSnapshot) => {
            if (gigSnapshot.exists()) {
                const updatedGig = gigSnapshot.data();
                setGigInfo(updatedGig); // Update the state with the latest gig data
            } else {
                console.error('Gig not found');
            }
        });

        // Clean up the listener when the component unmounts
        return () => unsubscribe();
    }, [gigId]);

    useEffect(() => {
        const fetchMusicianProfiles = async () => {
            const profiles = [];
            for (const applicant of gigInfo.applicants) {
                const musicianRef = doc(firestore, 'musicianProfiles', applicant.id);
                const musicianSnapshot = await getDoc(musicianRef);
                if (musicianSnapshot.exists()) {
                    profiles.push({ ...musicianSnapshot.data(), id: applicant.id, status: applicant.status, proposedFee: applicant.fee });
                }
            }
            setMusicianProfiles(profiles);
            setLoading(false);
        };

        if (gigInfo) {
            fetchMusicianProfiles();
        }
    }, [gigInfo]);

    const formatDate = (timestamp) => {
        const date = timestamp;
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

    const handleAccept = async (musicianId, event, musicianUserId, proposedFee) => {
        event.stopPropagation();

        // TAKE PAYMENT FROM HOST
    
        try {
            const gigRef = doc(firestore, 'gigs', gigInfo.gigId);
            const gigSnapshot = await getDoc(gigRef);
    
            if (gigSnapshot.exists()) {
                const gigData = gigSnapshot.data();
                if (gigData.date.toDate() > new Date()) {
                    let agreedFee;
                    const updatedApplicants = gigData.applicants.map(applicant => {
                        if (applicant.id === musicianId) {
                            agreedFee = applicant.fee;
                            return { ...applicant, status: 'Accepted' };
                        } else {
                            return { ...applicant, status: 'Declined' };
                        }
                    });
                    await updateDoc(gigRef, { applicants: updatedApplicants, budget: `${agreedFee}` });


                    const conversationsRef = collection(firestore, 'conversations');
                    const conversationQuery = query(conversationsRef, where('participants', 'array-contains', musicianId), where('gigId', '==', gigId));
                    const conversationSnapshot = await getDocs(conversationQuery);

                    if (!conversationSnapshot.empty) {
                        const conversationId = conversationSnapshot.docs[0].id;
                        const timestamp = Timestamp.now();

                        if (proposedFee === gigData.budget) {
                            // Find the message with type 'application' in the conversation
                            const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
                            const messageQuery = query(messagesRef, where('type', '==', 'application'));
                            const messageSnapshot = await getDocs(messageQuery);
                    
                            if (!messageSnapshot.empty) {
                                const messageId = messageSnapshot.docs[0].id; // Get the first application message's ID
                    
                                // Update the application message with the 'Accepted' status
                                const messageRef = doc(firestore, 'conversations', conversationId, 'messages', messageId);
                                await updateDoc(messageRef, {
                                    status: 'Accepted',
                                    timestamp: timestamp,
                                });
    
                                // Send an accept message to musician
                                const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
                                // Add the new message to the 'messages' subcollection
    
                                await addDoc(messagesRef, {
                                    senderId: user.uid,
                                    receiverId: musicianUserId,
                                    text: `The gig has been accepted with a fee of ${agreedFee}.`,
                                    timestamp: timestamp,
                                    type: 'announcement',
                                    status: 'awaiting payment',
                                });
                
                                const conversationRef = doc(firestore, 'conversations', conversationId);
                                await updateDoc(conversationRef, {
                                    lastMessage: `Gig application accepted.`,
                                    lastMessageTimestamp: timestamp,
                                });
                                
                                setGigInfo(prevState => ({
                                    ...prevState,
                                    applicants: updatedApplicants
                                }));
    
                            } else {
                                console.error('No application message found in the conversation.');
                            }
                            
                        } else {
                            // Find the message with type 'negotiation' in the conversation
                            const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
                            const messageQuery = query(messagesRef, where('type', '==', 'negotiation'));
                            const messageSnapshot = await getDocs(messageQuery);
                    
                            if (!messageSnapshot.empty) {
                                const messageId = messageSnapshot.docs[0].id; // Get the first negotiation message's ID
                    
                                // Update the negotiation message with the 'Accepted' status
                                const messageRef = doc(firestore, 'conversations', conversationId, 'messages', messageId);
                                await updateDoc(messageRef, {
                                    status: 'Accepted',
                                    timestamp: timestamp,
                                });
    
                                // Send an accept message to musician
                                const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
                                // Add the new message to the 'messages' subcollection
    
                                await addDoc(messagesRef, {
                                    senderId: user.uid,
                                    receiverId: musicianUserId,
                                    text: `The gig has been accepted with a fee of ${agreedFee}.`,
                                    timestamp: timestamp,
                                    type: 'announcement',
                                    status: 'awaiting payment',
                                });
                
                                const conversationRef = doc(firestore, 'conversations', conversationId);
                                await updateDoc(conversationRef, {
                                    lastMessage: `Gig application accepted.`,
                                    lastMessageTimestamp: timestamp,
                                });
                                
                                setGigInfo(prevState => ({
                                    ...prevState,
                                    applicants: updatedApplicants
                                }));
    
                            } else {
                                console.error('No negotiation message found in the conversation.');
                            }
                        }
                        
                    } else {
                        console.error('No conversation found for the musician and gig.');
                    }
                } else {
                    console.log('Gig is not in the future, skipping message update.');
                }        

            } else {
                console.error('Gig not found');
            }
        } catch (error) {
            console.error('Error updating gig document:', error);
        }
    };

    const handleReject = async (musicianId, event, musicianUserId, proposedFee) => {
        event.stopPropagation();
        try {
            const gigRef = doc(firestore, 'gigs', gigInfo.gigId);
            const gigSnapshot = await getDoc(gigRef);
    
            if (gigSnapshot.exists()) {
                const gigData = gigSnapshot.data();

                if (gigData.date.toDate() > new Date()) {

                    const updatedApplicants = gigData.applicants.map(applicant => {
                        if (applicant.id === musicianId) {
                            return { ...applicant, status: 'Declined' };
                        } else {
                            return { ...applicant };
                        }
                    });
                    await updateDoc(gigRef, { applicants: updatedApplicants });
                

                    const conversationsRef = collection(firestore, 'conversations');
                    const conversationQuery = query(conversationsRef, where('participants', 'array-contains', musicianId), where('gigId', '==', gigId));
                    const conversationSnapshot = await getDocs(conversationQuery);

                    if (!conversationSnapshot.empty) {
                        const conversationId = conversationSnapshot.docs[0].id;
                        const timestamp = Timestamp.now(); // Store the timestamp for reuse

                        if (proposedFee === gigData.budget) {
                            // Find the message with type 'application' in the conversation
                            const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
                            const messageQuery = query(messagesRef, where('type', '==', 'application'));
                            const messageSnapshot = await getDocs(messageQuery);
                    
                            if (!messageSnapshot.empty) {
                                const messageId = messageSnapshot.docs[0].id; // Get the first application message's ID
                    
                                // Update the application message with the 'Declined' status
                                const messageRef = doc(firestore, 'conversations', conversationId, 'messages', messageId);
                                await updateDoc(messageRef, {
                                    status: 'Declined',
                                    timestamp: timestamp,
                                });
    
                                // Send a decline message to musician
                                const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
                                // Add the new message to the 'messages' subcollection
                                await addDoc(messagesRef, {
                                    senderId: user.uid,
                                    receiverId: musicianUserId,
                                    text: `Your gig application was declined.`,
                                    timestamp: timestamp,
                                    type: 'application-response',
                                    status: 'Declined'
                                });
                
                                const conversationRef = doc(firestore, 'conversations', conversationId);
                                await updateDoc(conversationRef, {
                                    lastMessage: `Gig application declined.`,
                                    lastMessageTimestamp: timestamp,
                                });
                                
                                setGigInfo(prevState => ({
                                    ...prevState,
                                    applicants: updatedApplicants
                                }));
    
                            } else {
                                console.error('No application message found in the conversation.');
                            }
                        } else {
                            // Find the message with type 'application' in the conversation
                            const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
                            const messageQuery = query(messagesRef, where('type', '==', 'negotiation'));
                            const messageSnapshot = await getDocs(messageQuery);
                    
                            if (!messageSnapshot.empty) {
                                const messageId = messageSnapshot.docs[0].id; // Get the first application message's ID
                    
                                // Update the application message with the 'Declined' status
                                const messageRef = doc(firestore, 'conversations', conversationId, 'messages', messageId);
                                await updateDoc(messageRef, {
                                    status: 'Declined',
                                    timestamp: timestamp,
                                });
    
                                // Send a decline message to musician
                                const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
                                // Add the new message to the 'messages' subcollection
                                await addDoc(messagesRef, {
                                    senderId: user.uid,
                                    receiverId: musicianUserId,
                                    text: `Your offer was declined.`,
                                    timestamp: timestamp,
                                    type: 'negotiation-response',
                                    status: 'Declined'
                                });
                
                                const conversationRef = doc(firestore, 'conversations', conversationId);
                                await updateDoc(conversationRef, {
                                    lastMessage: `Gig offer declined.`,
                                    lastMessageTimestamp: timestamp,
                                });
                                
                                setGigInfo(prevState => ({
                                    ...prevState,
                                    applicants: updatedApplicants
                                }));
    
                            } else {
                                console.error('No negotiation message found in the conversation.');
                            }
                            
                        }
                
                    } else {
                        console.error('No conversation found for the musician and gig.');
                    }
                } else {
                    console.log('Gig is not in the future, skipping message update.');
                }        

            } else {
                console.error('Gig not found');
            }
        } catch (error) {
            console.error('Error updating gig document:', error);
        }
    };

    const openMusicianProfile = (musicianId) => {
        const url = `/musician/${musicianId}/${gigInfo.gigId}`;
        window.open(url, '_blank');
    };

    return (
        <>
            <div className="head">
                <h1 className="title" style={{ fontWeight: 500 }}>
                    Applications for {formatDate(gigDate)} at {venueName}
                </h1>
            </div>
            <div className="body gigs">
                {loading ? (
                    <LoadingThreeDots />
                ) : (
                    musicianProfiles.length > 0 ? (
                        <table className="applications-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Genre(s)</th>
                                    <th>Reviews</th>
                                    <th>Fee</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {musicianProfiles.map((profile) => {

                                    const applicant = gigInfo.applicants.find(applicant => applicant.id === profile.id);
                                    const status = applicant ? applicant.status : 'Pending';

                                    return (
                                        <tr key={profile.id} className="applicant"  onClick={() => openMusicianProfile(profile.id)}>
                                            <td>
                                                {profile.name}
                                            </td>
                                            <td className="genres">
                                                {profile.genres
                                                    .filter(genre => !genre.includes(' ')) // Filter to include only one-word genres
                                                    .map((genre, index) => (
                                                        <span key={index} className="genre-tag">{genre}</span>
                                                    ))}
                                            </td>
                                            <td>{profile.reviews?.length || 'No'} Reviews</td>
                                            <td>
                                                {profile.proposedFee !== gigInfo.budget ? (
                                                    <>
                                                        <span style={{ textDecoration: 'line-through', marginRight: '5px' }}>{gigInfo.budget}</span>
                                                        <span>{profile.proposedFee}</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        {profile.proposedFee}
                                                    </>
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                {status === 'Accepted' && (
                                                    <div className="status-box">
                                                        <div className="status confirmed">
                                                            <TickIcon />
                                                            Accepted
                                                        </div>
                                                    </div>
                                                )}
                                                {status === 'Declined' && (
                                                    <div className="status-box">
                                                        <div className="status rejected">
                                                            <RejectedIcon />
                                                            Declined
                                                        </div>
                                                    </div>
                                                )}
                                                {status === 'Negotiating' && (
                                                    <div className="status-box">
                                                        <div className="status upcoming">
                                                            <ClockIcon />
                                                            Negotiating
                                                        </div>
                                                    </div>
                                                )}
                                                {status === 'Pending' && (
                                                <>
                                                    <button className="btn accept small" onClick={(event) => handleAccept(profile.id, event, profile.userId, profile.proposedFee)}>
                                                        Accept
                                                    </button>
                                                    <button className="btn danger small" onClick={(event) => handleReject(profile.id, event, profile.userId, profile.proposedFee)}>
                                                        Decline
                                                    </button>
                                                </>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <h4>No Applicants.</h4>
                    )
                )}
            </div>
        </>
    );
};