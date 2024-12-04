import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, Timestamp, doc, updateDoc, getDocs, arrayUnion, where, getDoc } from 'firebase/firestore';
import { firestore } from '../../firebase';
import { CloseIcon, DownChevronIcon, RejectedIcon, SendMessageIcon, TickIcon, HouseIcon, MicrophoneIcon, NewTabIcon } from '../../components/ui/Extras/Icons';
import '/styles/common/messages.styles.css';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import { PaymentModal } from '../../components/venue-components/PaymentModal'
import { LoadingThreeDots } from '../../components/ui/loading/Loading'
import { ReviewModal } from '../../components/common/ReviewModal';
import { useNavigate } from 'react-router-dom';

export const MessageThread = ({ activeConversation, conversationId, user, musicianProfileId, gigId, gigData, setGigData }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [userRole, setUserRole] = useState('');
    const [allowCounterOffer, setAllowCounterOffer] = useState(false);
    const [newCounterOffer, setNewCounterOffer] = useState('');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [savedCards, setSavedCards] = useState([]);
    const [loadingPaymentDetails, setLoadingPaymentDetails] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [makingPayment, setMakingPayment] = useState(false);
    const [paymentMessageId, setPaymentMessageId] = useState();
    const [showReviewModal, setShowReviewModal] = useState(false);
    const navigate = useNavigate();

    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (activeConversation) {
            if (activeConversation.accountNames.find(account => account.accountId === user.uid)?.role === 'venue') {
                setUserRole('venue')
            } else {
                setUserRole('musician')
            }
        }
    }, [activeConversation])

    useEffect(() => {
        if (!conversationId) return;
        const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
        const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));
        const unsubscribe = onSnapshot(messagesQuery, snapshot => {
            const fetchedMessages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
            setMessages(fetchedMessages);
        });
        return () => unsubscribe();
    }, [conversationId]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        try {
            const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
            const timestamp = Timestamp.now();
            await addDoc(messagesRef, {
                senderId: user.uid,
                text: newMessage,
                timestamp: timestamp,
                type: 'text',
            });
            const conversationRef = doc(firestore, 'conversations', conversationId);
            await updateDoc(conversationRef, {
                lastMessage: newMessage,
                lastMessageTimestamp: timestamp,
                lastMessageSenderId: user.uid,
            });
            setNewMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    const formatDate = (timestamp) => {
        const date = timestamp.toDate();
        const day = date.getDate();
        const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
        const month = date.toLocaleDateString('en-GB', { month: 'long' });
        const getOrdinalSuffix = (day) => {
            if (day > 3 && day < 21) return 'th';
            switch (day % 10) {
                case 1: return 'st';
                case 2: return 'nd';
                case 3: return 'rd';
                default: return 'th';
            }
        };
        return `${weekday} ${day}${getOrdinalSuffix(day)} ${month}`;
    };

    const openMusicianProfile = (musicianId) => {
        const url = `/musician/${musicianId}/${gigId}`;
        window.open(url, '_blank');
    };

    const handleCounterOffer = (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        setNewCounterOffer(`£${value}`)
    }

    const handleAcceptGig = async (event, messageId) => {
        event.stopPropagation();
        try {
            if (!gigData) {
                console.error('Gig data is missing');
                return;
            }
            let agreedFee;
            const updatedApplicants = gigData.applicants.map(applicant => {
                if (applicant.id === musicianProfileId) {
                    agreedFee = applicant.fee;
                    return { ...applicant, status: 'accepted' };
                } else {
                    return { ...applicant, status: 'declined' };
                }
            });
            const gigRef = doc(firestore, 'gigs', gigData.gigId);
            await updateDoc(gigRef, { 
                applicants: updatedApplicants,
                agreedFee: `${agreedFee}`,
                paid: false,
            });
            setGigData((prevGigData) => ({
                ...prevGigData,
                applicants: updatedApplicants,
                agreedFee: `${agreedFee}`,
                paid: false,
            }));
            const messageRef = doc(firestore, 'conversations', conversationId, 'messages', messageId);
            await updateDoc(messageRef, {
                status: 'accepted',
            });
            const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
            const timestamp = Timestamp.now();
            await addDoc(messagesRef, {
                senderId: user.uid,
                text: `The ${userRole} has accepted the gig for a fee of ${agreedFee}.`,
                timestamp: timestamp,
                type: 'announcement',
                status: 'awaiting payment',
            });
            const conversationRef = doc(firestore, 'conversations', conversationId);
            await updateDoc(conversationRef, {
                lastMessage: `The ${userRole} has accepted the gig for a fee of ${agreedFee}.`,
                lastMessageTimestamp: timestamp,
                lastMessageSenderId: user.uid,
                status: 'closed',
            });
            const venueRef = doc(firestore, 'venueProfiles', gigData.venueId);
            const venueSnapshot = await getDoc(venueRef);
            if (!venueSnapshot.exists()) {
                console.error('Venue profile not found');
                return;
            }
            const venueData = venueSnapshot.data();
            const musicianProfileRef = doc(firestore, 'musicianProfiles', musicianProfileId);
            const musicianProfileSnapshot = await getDoc(musicianProfileRef);
            if (!musicianProfileSnapshot.exists()) {
                console.error('Musician profile not found');
                return;
            }
            const musicianProfileData = musicianProfileSnapshot.data();
            if (userRole === 'musician') {
                const mailRef = collection(firestore, 'mail');
                await addDoc(mailRef, {
                    to: venueData.email,
                    message: {
                        subject: `Your Invitation Was Accepted!`,
                        text: `${musicianProfileData.name} has accepted your invitation for the gig at ${gigData.venue.venueName} on ${formatDate(gigData.date)}.`,
                        html: `
                            <p>Hi ${venueData.accountName},</p>
                            <p>We're excited to inform you that <strong>${musicianProfileData.name}</strong> has accepted your invitation for the following gig:</p>
                            <ul>
                                <li><strong>Gig:</strong> ${gigData.venue.venueName}</li>
                                <li><strong>Date:</strong> ${formatDate(gigData.date)}</li>
                                <li><strong>Fee:</strong> ${agreedFee}</li>
                            </ul>
                            <p>Visit your <a href="${window.location.origin}/venues/dashboard">dashboard</a> to pay the gig fee and confirm the gig.</p>
                            <p>Thanks,<br />The Gigin Team</p>
                        `,
                    },
                });
            } else {
                const mailRef = collection(firestore, 'mail');
                await addDoc(mailRef, {
                    to: musicianProfileData.email,
                    message: {
                        subject: `Your Gig Application Has Been Accepted!`,
                        text: `Congratulations! Your application for the gig at ${gigData.venue.venueName} on ${formatDate(gigData.date)} has been accepted.`,
                        html: `
                            <p>Hi ${musicianProfileData.name},</p>
                            <p>We're excited to inform you that your application for the following gig has been accepted:</p>
                            <ul>
                                <li><strong>Gig:</strong> ${gigData.venue.venueName}</li>
                                <li><strong>Date:</strong> ${formatDate(gigData.date)}</li>
                                <li><strong>Fee:</strong> ${agreedFee}</li>
                            </ul>
                            <p>The gig isn't confirmed until the venue pays the gig fee.</p>
                            <p>Please visit your <a href="${window.location.origin}/dashboard">dashboard</a> to see the status of the gig.</p>
                            <p>Thanks,<br />The Gigin Team</p>
                        `,
                    },
                });
            }
        } catch (error) {
            console.error('Error updating gig document:', error);
        }
    };

    const handleAcceptNegotiation = async (event, messageId) => {
        event.stopPropagation();    
        try {
            if (!gigData) {
                console.error('Gig data is missing');
                return;
            }
            let agreedFee;
            const updatedApplicants = gigData.applicants.map(applicant => {
                if (applicant.id === musicianProfileId) {
                    agreedFee = applicant.fee;
                    return { ...applicant, status: 'accepted' };
                } else {
                    return { ...applicant, status: 'declined' };
                }
            });
            const gigRef = doc(firestore, 'gigs', gigData.gigId);
            await updateDoc(gigRef, { 
                applicants: updatedApplicants,
                agreedFee: `${agreedFee}`,
                paid: false
            });
            setGigData((prevGigData) => ({
                ...prevGigData,
                applicants: updatedApplicants,
                agreedFee: `${agreedFee}`,
                paid: false,
            }));
            const messageRef = doc(firestore, 'conversations', conversationId, 'messages', messageId);
            await updateDoc(messageRef, {
                status: 'accepted',
            });
            const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
            const timestamp = Timestamp.now();
            await addDoc(messagesRef, {
                senderId: user.uid,
                text: `The ${userRole} has accepted the gig for a fee of ${agreedFee}.`,
                timestamp: timestamp,
                type: 'announcement',
                status: 'awaiting payment',
            });
            const conversationRef = doc(firestore, 'conversations', conversationId);
            await updateDoc(conversationRef, {
                lastMessage: `The ${userRole} has accepted the gig for a fee of ${agreedFee}.`,
                lastMessageTimestamp: timestamp,
                lastMessageSenderId: user.uid,
                status: 'closed',
            });
            const venueRef = doc(firestore, 'venueProfiles', gigData.venueId);
            const venueSnapshot = await getDoc(venueRef);
            if (!venueSnapshot.exists()) {
                console.error('Venue profile not found');
                return;
            }
            const venueData = venueSnapshot.data();
            const musicianProfileRef = doc(firestore, 'musicianProfiles', musicianProfileId);
            const musicianProfileSnapshot = await getDoc(musicianProfileRef);
            if (!musicianProfileSnapshot.exists()) {
                console.error('Musician profile not found');
                return;
            }
            const musicianProfileData = musicianProfileSnapshot.data();
            if (userRole === 'musician') {
                const mailRef = collection(firestore, 'mail');
                await addDoc(mailRef, {
                    to: venueData.email,
                    message: {
                        subject: `Your Negotiation Was Accepted!`,
                        text: `${musicianProfileData.name} has accepted your negotiated fee for the gig at ${gigData.venue.venueName} on ${formatDate(gigData.date)}.`,
                        html: `
                            <p>Hi ${venueData.accountName},</p>
                            <p>We're excited to inform you that <strong>${musicianProfileData.name}</strong> has accepted your negotiation for the following gig:</p>
                            <ul>
                                <li><strong>Gig:</strong> ${gigData.venue.venueName}</li>
                                <li><strong>Date:</strong> ${formatDate(gigData.date)}</li>
                                <li><strong>Fee:</strong> ${agreedFee}</li>
                            </ul>
                            <p>Visit your <a href="${window.location.origin}/venues/dashboard">dashboard</a> to pay the gig fee and confirm the gig.</p>
                            <p>Thanks,<br />The Gigin Team</p>
                        `,
                    },
                });
            } else {
                const mailRef = collection(firestore, 'mail');
                await addDoc(mailRef, {
                    to: musicianProfileData.email,
                    message: {
                        subject: `Your Gig Negotiation Has Been Accepted!`,
                        text: `Congratulations! Your negotiation for the gig at ${gigData.venue.venueName} on ${formatDate(gigData.date)} has been accepted.`,
                        html: `
                            <p>Hi ${musicianProfileData.name},</p>
                            <p>We're excited to inform you that your application for the following gig has been accepted:</p>
                            <ul>
                                <li><strong>Gig:</strong> ${gigData.venue.venueName}</li>
                                <li><strong>Date:</strong> ${formatDate(gigData.date)}</li>
                                <li><strong>Fee:</strong> ${agreedFee}</li>
                            </ul>
                            <p>The gig isn't confirmed until the venue pays the gig fee.</p>
                            <p>Please visit your <a href="${window.location.origin}/dashboard">dashboard</a> to see the status of the gig.</p>
                            <p>Thanks,<br />The Gigin Team</p>
                        `,
                    },
                });
            }
            console.log('Agreed fee:', agreedFee);
        } catch (error) {
            console.error('Error updating gig document:', error);
        }
    };

    const handleDeclineNegotiation = async (event, newFee, messageId) => {
        event.stopPropagation();
        try {
            if (!gigData) {
                console.error('Gig data is missing');
                return;
            }
            const updatedApplicants = gigData.applicants.map(applicant => {
                if (applicant.id === musicianProfileId) {
                    return { ...applicant, status: 'declined' };
                } else {
                    return { ...applicant };
                }
            });
            const gigRef = doc(firestore, 'gigs', gigData.gigId);
            await updateDoc(gigRef, { applicants: updatedApplicants });
            setGigData((prevGigData) => ({
                ...prevGigData,
                applicants: updatedApplicants,
            }));
            const messageRef = doc(firestore, 'conversations', conversationId, 'messages', messageId);
            const timestamp = Timestamp.now();
            await updateDoc(messageRef, {
                status: 'declined',
                timestamp: timestamp,
            });
            const conversationRef = doc(firestore, 'conversations', conversationId);
            await updateDoc(conversationRef, {
                lastMessage: `The fee of ${newFee} was declined by the ${userRole}.`,
                lastMessageTimestamp: timestamp,
                lastMessageSenderId: user.uid,
            });
            const venueRef = doc(firestore, 'venueProfiles', gigData.venueId);
            const venueSnapshot = await getDoc(venueRef);
            if (!venueSnapshot.exists()) {
                console.error('Venue profile not found');
                return;
            }
            const venueData = venueSnapshot.data();
            const musicianProfileRef = doc(firestore, 'musicianProfiles', musicianProfileId);
            const musicianProfileSnapshot = await getDoc(musicianProfileRef);
            if (!musicianProfileSnapshot.exists()) {
                console.error('Musician profile not found');
                return;
            }
            const musicianProfileData = musicianProfileSnapshot.data();
            if (userRole === 'musician') {
                const mailRef = collection(firestore, 'mail');
                await addDoc(mailRef, {
                    to: venueData.email,
                    message: {
                        subject: `Your Negotiation Was Declined`,
                        text: `${musicianProfileData.name} has declined your negotiated fee for the gig at ${gigData.venue.venueName} on ${formatDate(gigData.date)}.`,
                        html: `
                            <p>Hi ${venueData.accountName},</p>
                            <p><strong>${musicianProfileData.name}</strong> has declined your negotiation for the following gig:</p>
                            <ul>
                                <li><strong>Gig:</strong> ${gigData.venue.venueName}</li>
                                <li><strong>Date:</strong> ${formatDate(gigData.date)}</li>
                            </ul>
                            <p>Visit your <a href="${window.location.origin}/venues/dashboard">dashboard</a> to negotiate another fee.</p>
                            <p>Thanks,<br />The Gigin Team</p>
                        `,
                    },
                });
            } else {
                const mailRef = collection(firestore, 'mail');
                await addDoc(mailRef, {
                    to: musicianProfileData.email,
                    message: {
                        subject: `Your Gig Negotiation Has Been Declined`,
                        text: `Your negotiation for the gig at ${gigData.venue.venueName} on ${formatDate(gigData.date)} has been declined.`,
                        html: `
                            <p>Hi ${musicianProfileData.name},</p>
                            <p>Unfortunately your negotiation for the following gig has been declined:</p>
                            <ul>
                                <li><strong>Gig:</strong> ${gigData.venue.venueName}</li>
                                <li><strong>Date:</strong> ${formatDate(gigData.date)}</li>
                            </ul>
                            <p>Please visit your <a href="${window.location.origin}/dashboard">dashboard</a> to negotiate the fee further.</p>
                            <p>Thanks,<br />The Gigin Team</p>
                        `,
                    },
                });
            }
            setAllowCounterOffer(true);
        } catch (error) {
            console.error('Error updating gig document:', error);
        }
    };

    const handleDeclineApplication = async (event, messageId) => {
        event.stopPropagation();
        try {
            if (!gigData) {
                console.error('Gig data is missing');
                return;
            }
            const updatedApplicants = gigData.applicants.map(applicant => {
                if (applicant.id === musicianProfileId) {
                    return { ...applicant, status: 'declined' };
                } else {
                    return { ...applicant };
                }
            });
            const gigRef = doc(firestore, 'gigs', gigData.gigId);
            await updateDoc(gigRef, { applicants: updatedApplicants });
            setGigData((prevGigData) => ({
                ...prevGigData,
                applicants: updatedApplicants,
            }));
            const messageRef = doc(firestore, 'conversations', conversationId, 'messages', messageId);
            const timestamp = Timestamp.now();
            await updateDoc(messageRef, {
                status: 'declined',
                timestamp: timestamp,
            });
            const conversationRef = doc(firestore, 'conversations', conversationId);
            await updateDoc(conversationRef, {
                lastMessage: `The gig application has been declined.`,
                lastMessageTimestamp: timestamp,
                lastMessageSenderId: user.uid,
            });
            const venueRef = doc(firestore, 'venueProfiles', gigData.venueId);
            const venueSnapshot = await getDoc(venueRef);
            if (!venueSnapshot.exists()) {
                console.error('Venue profile not found');
                return;
            }
            const venueData = venueSnapshot.data();
            const musicianProfileRef = doc(firestore, 'musicianProfiles', musicianProfileId);
            const musicianProfileSnapshot = await getDoc(musicianProfileRef);
            if (!musicianProfileSnapshot.exists()) {
                console.error('Musician profile not found');
                return;
            }
            const musicianProfileData = musicianProfileSnapshot.data();
            if (userRole === 'musician') {
                const mailRef = collection(firestore, 'mail');
                await addDoc(mailRef, {
                    to: venueData.email,
                    message: {
                        subject: `Your Invitation Was Declined`,
                        text: `${musicianProfileData.name} has declined your invitation for the gig at ${gigData.venue.venueName} on ${formatDate(gigData.date)}.`,
                        html: `
                            <p>Hi ${venueData.accountName},</p>
                            <p><strong>${musicianProfileData.name}</strong> has declined your invitation for the following gig:</p>
                            <ul>
                                <li><strong>Gig:</strong> ${gigData.venue.venueName}</li>
                                <li><strong>Date:</strong> ${formatDate(gigData.date)}</li>
                            </ul>
                            <p>Visit your <a href="${window.location.origin}/venues/dashboard">dashboard</a> to find another musician.</p>
                            <p>Thanks,<br />The Gigin Team</p>
                        `,
                    },
                });
            } else {
                const mailRef = collection(firestore, 'mail');
                await addDoc(mailRef, {
                    to: musicianProfileData.email,
                    message: {
                        subject: `Your Gig Application Has Been Declined`,
                        text: `Your application for the gig at ${gigData.venue.venueName} on ${formatDate(gigData.date)} has been declined.`,
                        html: `
                            <p>Hi ${musicianProfileData.name},</p>
                            <p>Unfortunately your application for the following gig has been declined:</p>
                            <ul>
                                <li><strong>Gig:</strong> ${gigData.venue.venueName}</li>
                                <li><strong>Date:</strong> ${formatDate(gigData.date)}</li>
                            </ul>
                            <p>Please visit your <a href="${window.location.origin}/dashboard">dashboard</a> to find another gig.</p>
                            <p>Thanks,<br />The Gigin Team</p>
                        `,
                    },
                });
            }
        } catch (error) {
            console.error('Error updating gig document:', error);
        }
    };

    const handleSendCounterOffer = async (newFee, messageId) => {
        try {
            if (!gigData) {
                console.error('Gig data is missing');
                return;
            }
            const applicants = gigData.applicants;
            const updatedApplicants = applicants.map(applicant => {
                if (applicant.id === musicianProfileId) {
                    return {
                        ...applicant,
                        fee: newFee,
                        timestamp: Timestamp.now(),
                        status: 'pending'
                    };
                } else {
                    return { ...applicant }
                }
            });
            const gigRef = doc(firestore, 'gigs', gigData.gigId);
            await updateDoc(gigRef, { applicants: updatedApplicants });
            setGigData((prevGigData) => ({
                ...prevGigData,
                applicants: updatedApplicants,
            }));
            const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
            const timestamp = Timestamp.now();
            await addDoc(messagesRef, {
                senderId: user.uid,
                text: `The ${userRole} proposes a new fee:`,
                timestamp: timestamp,
                type: 'negotiation',
                status: 'pending',
                oldFee: gigData.budget,
                newFee: newFee,
            });
            const counteredMessagesRef = doc(
                firestore,
                'conversations',
                conversationId,
                'messages',
                messageId
            );
            await updateDoc(counteredMessagesRef, {
                status: 'countered',
            });
            const conversationRef = doc(firestore, 'conversations', conversationId);
            await updateDoc(conversationRef, {
                lastMessage: `The ${userRole} proposes a new fee of ${newFee}.`,
                lastMessageTimestamp: timestamp,
                lastMessageSenderId: user.uid,
            });
            const venueRef = doc(firestore, 'venueProfiles', gigData.venueId);
            const venueSnapshot = await getDoc(venueRef);
            if (!venueSnapshot.exists()) {
                console.error('Venue profile not found');
                return;
            }
            const venueData = venueSnapshot.data();
            const musicianProfileRef = doc(firestore, 'musicianProfiles', musicianProfileId);
            const musicianProfileSnapshot = await getDoc(musicianProfileRef);
            if (!musicianProfileSnapshot.exists()) {
                console.error('Musician profile not found');
                return;
            }
            const musicianProfileData = musicianProfileSnapshot.data();
            if (userRole === 'musician') {
                const mailRef = collection(firestore, 'mail');
                await addDoc(mailRef, {
                    to: venueData.email,
                    message: {
                        subject: `You have been sent a counter-offer`,
                        text: `${musicianProfileData.name} has sent a counter-offer for the gig at ${gigData.venue.venueName} on ${formatDate(gigData.date)}.`,
                        html: `
                            <p>Hi ${venueData.accountName},</p>
                            <p><strong>${musicianProfileData.name}</strong> has sent a counter-offer for the following gig:</p>
                            <ul>
                                <li><strong>Gig:</strong> ${gigData.venue.venueName}</li>
                                <li><strong>Date:</strong> ${formatDate(gigData.date)}</li>
                                <li><strong>Proposed Fee:</strong> ${newFee}</li>
                            </ul>
                            <p>Visit your <a href="${window.location.origin}/venues/dashboard">dashboard</a> to accept or decline the new fee.</p>
                            <p>Thanks,<br />The Gigin Team</p>
                        `,
                    },
                });
            } else {
                const mailRef = collection(firestore, 'mail');
                await addDoc(mailRef, {
                    to: musicianProfileData.email,
                    message: {
                        subject: `You have been sent a counter-offer`,
                        text: `${gigData.venue.venueName} has sent a counter-offer for the gig on ${formatDate(gigData.date)}.`,
                        html: `
                            <p>Hi ${musicianProfileData.name},</p>
                            <p>Below are the details of the counter-offer:</p>
                            <ul>
                                <li><strong>Gig:</strong> ${gigData.venue.venueName}</li>
                                <li><strong>Date:</strong> ${formatDate(gigData.date)}</li>
                                <li><strong>Proposed Fee:</strong> ${newFee}</li>
                            </ul>
                            <p>Please visit your <a href="${window.location.origin}/dashboard">dashboard</a> to accept or decline the new fee.</p>
                            <p>Thanks,<br />The Gigin Team</p>
                        `,
                    },
                });
            }

            setAllowCounterOffer(false);
        } catch (error) {
            console.error('Error sending counter-offer:', error);
        }
    };

    const handleCompletePayment = async () => {
        setLoadingPaymentDetails(true);
        await fetchSavedCards();
    };

    const fetchSavedCards = async () => {
        try {
          const getSavedCards = httpsCallable(functions, 'getSavedCards');
          const response = await getSavedCards();
          setSavedCards(response.data.paymentMethods);
          setShowPaymentModal(true);
        } catch (error) {
          console.error('Error fetching saved cards:', error);
          alert('Unable to fetch saved cards.');
        } finally {
          setLoadingPaymentDetails(false);
        }
    };

    const handleSelectCard = async (cardId) => {
        setMakingPayment(true);
        try {
            if (!gigData.agreedFee) {
                console.error('Agreed fee is missing');
                return;
            }
            let amountToCharge;
            if (gigData.agreedFee.includes('£')) {
                amountToCharge = parseFloat(gigData.agreedFee.replace('£', '')) * 1.05;
            } else {
                amountToCharge = parseFloat(gigData.agreedFee) * 1.05;
            }
          const stripeAmount = Math.round(amountToCharge * 100);
          const gigDate = gigData.date.toDate();
          const confirmPayment = httpsCallable(functions, 'confirmPayment');
          const response = await confirmPayment({ 
            paymentMethodId: cardId,
            amountToCharge: stripeAmount,
            gigData,
            gigDate,
          });
          if (response.data.success) {
            setPaymentSuccess(true);
            setGigData((prevGigData) => ({
              ...prevGigData,
              status: 'payment processing',
            }));
          } else {
            setPaymentSuccess(false);
            alert(response.data.error || 'Payment failed. Please try again.');
          }
        } catch (error) {
          console.error('Error completing payment:', error);
          setPaymentSuccess(false);
          alert('An error occurred while processing the payment. Please try again.');
        } finally {
          setMakingPayment(false);
        }
      };

      const handleMessageReviewed = async () => {
        const recentReviewMessage = messages
        .filter((message) => message.type === 'review')
        .reduce((latest, current) => 
            !latest || current.timestamp > latest.timestamp ? current : latest, 
            null
        );
        if (recentReviewMessage) {
            const updatedMessages = messages.map((message) =>
                message.id === recentReviewMessage.id
                    ? { ...message, status: 'closed' }
                    : message
            );
            setMessages(updatedMessages);
            try {
                const messageRef = doc(firestore, 'conversations', conversationId, 'messages', recentReviewMessage.id);
                await updateDoc(messageRef, { status: 'closed' });
                const conversationRef = doc(firestore, 'conversations', conversationId);
                await updateDoc(conversationRef, {
                    lastMessage: `Review submitted.`,
                    lastMessageTimestamp: Timestamp.now(),
                    lastMessageSenderId: user.uid,
                });
            } catch (error) {
                console.error('Error updating message in Firestore:', error);
            }
        }
        window.location.reload();
      }
    
    return (
        <>
        <div className="messages">
            {messages.length > 0 && (
                messages.map((message) => (
                    <div className='message-container' key={message.id}>
                        <div className={`message ${message.senderId === user.uid ? 'sent' : 'received'} ${message.type === 'negotiation' ? 'negotiation' : ''} ${message.type === 'application' ? 'application' : ''} ${message.type === 'announcement' || message.type === 'review' ? 'announcement' : ''}`} >
                            {(message.type === 'application' || message.type === 'invitation') && message.senderId === user.uid ? (
                                <>
                                    <h4>
                                        {message.type === 'application' ? (
                                            <div className='accepted-group'>
                                                Gig application sent.
                                                {userRole === 'musician' && (
                                                    <button className="btn primary" onClick={() => navigate('/dashboard/profile')}>
                                                        Check my Profile
                                                    </button>
                                                )}
                                            </div>

                                        ) : (
                                            <>
                                                Gig invitation sent.
                                            </>
                                        )}
                                    </h4>
                                    {message.status === 'accepted' ? (
                                        <div className='accepted-group'>
                                            <div className="status-box">
                                                <div className="status confirmed">
                                                    <TickIcon />
                                                    Accepted
                                                </div>
                                            </div>
                                        </div>
                                    ) : (message.status === 'declined' || message.status === 'countered') && (
                                        <>
                                        <div className="status-box">
                                            <div className="status rejected">
                                                <RejectedIcon />
                                                Declined
                                            </div>
                                        </div>
                                        {message.status !== 'countered' && (
                                            <div className={`counter-offer ${message.senderId === user.uid ? 'sent' : 'received'}`}>
                                            <h4>Send Counter Offer:</h4>
                                            <div className="input-group">
                                                <input
                                                    type="text"
                                                    className="input"
                                                    value={newCounterOffer}
                                                    onChange={(e) => handleCounterOffer(e)}
                                                    placeholder="£"
                                                />
                                                <button
                                                    className="btn primary"
                                                    onClick={() => handleSendCounterOffer(newCounterOffer, message.id)}
                                                >
                                                    Send
                                                </button>
                                            </div>
                                        </div>
                                        )}
                                        </>
                                    )}
                                </>
                            ) 
                            : (message.type === 'application' || message.type === 'invitation') && message.senderId !== user.uid ? (
                                <>
                                    <h4>{message.text}</h4>
                                    {message.status === 'accepted' ? (
                                        <div className="status-box">
                                            <div className="status confirmed">
                                                <TickIcon />
                                                Accepted
                                            </div>
                                        </div>
                                    ) : (message.status === 'declined' || message.status === 'countered') ? (
                                        <>
                                        <div className="status-box">
                                            <div className="status rejected">
                                                <RejectedIcon />
                                                Declined
                                            </div>
                                        </div>
                                        {message.status !== 'countered' && (
                                            <div className={`counter-offer ${message.senderId === user.uid ? 'sent' : 'received'}`}>
                                                <h4>Send Counter Offer:</h4>
                                                <div className="input-group">
                                                    <input
                                                        type="text"
                                                        className="input"
                                                        value={newCounterOffer}
                                                        onChange={(e) => handleCounterOffer(e)}
                                                        placeholder="£"
                                                    />
                                                    <button
                                                        className="btn primary"
                                                        onClick={() => handleSendCounterOffer(newCounterOffer, message.id)}
                                                    >
                                                        Send
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        </>
                                    ) : message.status !== 'countered' && (
                                        <div className="two-buttons">
                                            <button className="btn accept" onClick={(event) => handleAcceptGig(event, message.id)}>
                                                Accept
                                            </button>
                                            <button className="btn decline" onClick={(event) => handleDeclineApplication(event, message.id)}>
                                                Decline
                                            </button>
                                        </div>
                                    )}
                                    <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                </>
                            ) : 
                            message.type === 'negotiation' && message.senderId === user.uid ? (
                                <>
                                    <div className="fees">
                                        <h4 style={{ textDecoration: 'line-through' }}>{message.oldFee}</h4>
                                        <h4>{message.newFee}</h4>
                                    </div>
                                    {message.status === 'accepted' ? (
                                        <div className="status-box">
                                            <div className="status confirmed">
                                                <TickIcon />
                                                Accepted
                                            </div>
                                        </div>
                                    ) : message.status === 'declined' && (
                                        <>
                                            <div className="status-box">
                                                <div className="status rejected">
                                                    <RejectedIcon />
                                                    Declined
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </>
                            ) : message.type === 'negotiation' && message.senderId !== user.uid ? (
                                <>
                                    <h4>{message.text}</h4>
                                    <div className="fees">
                                        <h4 style={{ textDecoration: 'line-through' }}>{message.oldFee}</h4>
                                        <h4>{message.newFee}</h4>
                                    </div>
                                    {message.status === 'accepted' ? (
                                        <div className="status-box">
                                            <div className="status confirmed">
                                                <TickIcon />
                                                Accepted
                                            </div>
                                        </div>
                                    ) : (message.status === 'declined' || message.status === 'countered') ? (
                                        <>
                                            <div className="status-box">
                                                <div className="status rejected">
                                                    <RejectedIcon />
                                                    Declined
                                                </div>
                                            </div>
                                            {message.status !== 'countered' && (
                                                <div className={`counter-offer ${message.senderId === user.uid ? 'sent' : 'received'}`}>
                                                   <h4>Send Counter Offer:</h4>
                                                <div className="input-group">
                                                    <input
                                                        type="text"
                                                        className="input"
                                                        value={newCounterOffer}
                                                        onChange={(e) => handleCounterOffer(e)}
                                                        placeholder="£"
                                                    />
                                                    <button
                                                        className="btn primary"
                                                        onClick={() => handleSendCounterOffer(newCounterOffer, message.id)}
                                                    >
                                                        Send
                                                    </button>
                                                </div>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="two-buttons">
                                            <button className="btn accept" onClick={(event) => handleAcceptNegotiation(event, message.id)}>
                                                Accept
                                            </button>
                                            <button className="btn decline" onClick={(event) => handleDeclineNegotiation(event, message.newFee, message.id)}>
                                                Decline
                                            </button>
                                        </div>
                                    )}
                                    <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                </>
                            ) : message.type === 'announcement' ? (
                                <>
                                {message.status === 'awaiting payment' && userRole === 'venue' ? (
                                    <>
                                        <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                        <h4>{message.text} Please click the button below to pay. The gig will be confirmed once you have paid.</h4>
                                        {loadingPaymentDetails || gigData.status === 'payment processing' ? (
                                            <LoadingThreeDots />
                                        ) : (
                                            <button className="btn primary complete-payment" onClick={() => {handleCompletePayment(); setPaymentMessageId(message.id)}}>
                                                Complete Payment
                                            </button>
                                        )}
                                    </>
                                ) : message.status === 'awaiting payment' && userRole === 'musician' ? (
                                    <>
                                        <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                        <h4>{message.text} Once the venue has paid the fee, the gig will be confirmed.</h4>
                                    </>
                                ) : message.status === 'gig confirmed' ? (
                                    <>
                                        <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                        <h4>{message.text} {userRole !== 'venue' ? 'Your payment will arrive in your account 24 hours after the gig has been performed.' : ''}</h4>
                                    </>
                                ) : message.status === 'payment failed' && userRole === 'venue' ? (
                                    <>
                                        <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                        <h4>{message.text}</h4>
                                    </>
                                ) : message.status === 'payment failed' && userRole === 'musician' ? (
                                    <>
                                        <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                        <h4>The gig will be confirmed when the venue has paid the gig fee.</h4>
                                    </>
                                ) : message.status === "cancellation" && userRole === 'venue' ? (
                                    <>
                                        <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                        <h4>{message.text}</h4>
                                    </>
                                ) : message.status === "cancellation" && userRole === 'musician' ? (
                                    <>
                                        <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                        <h4>You cancelled the gig. The gig fee has been refunded to the venue.</h4>
                                    </>
                                ) : message.status === "dispute" && (
                                    <>
                                        <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                        <h4>{message.text}</h4>
                                    </>
                                )}
                                </>
                            ) : message.type === 'review' ? (
                                <>
                                    {userRole === 'musician' ? (
                                        !gigData.musicianHasReviewed ? (
                                            <>
                                                <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                                <h4>How was your experience? Click the button below to review the venue.</h4>
                                                <button
                                                    className="btn primary"
                                                    onClick={() => setShowReviewModal(true)}
                                                >
                                                    {gigData.disputeClearingTime && new Date(gigData.disputeClearingTime.toDate()) > new Date()
                                                        ? 'Leave a Review'
                                                        : 'Leave a Review'}
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                                <h4>Thank you for submitting your review.</h4>
                                            </>
                                        )
                                    ) : (
                                        !gigData.venueHasReviewed && !gigData.disputeLogged ? (
                                            <>
                                                <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                                <h4>How was your experience? Click the button below to review the musician{gigData.disputeClearingTime && new Date(gigData.disputeClearingTime.toDate()) > new Date() ? ' or if you want to report an issue with the gig and request a refund.' : '.'}</h4>
                                                <button
                                                    className="btn primary"
                                                    onClick={() => setShowReviewModal(true)}
                                                >
                                                    {gigData.disputeClearingTime && new Date(gigData.disputeClearingTime.toDate()) > new Date()
                                                        ? 'Leave a Review / Report Issue'
                                                        : 'Leave a Review'}
                                                </button>
                                            </>
                                        ) : gigData.venueHasReviewed && !gigData.disputeLogged ? (
                                            <>
                                                <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                                <h4>Thank you for submitting your review.</h4>
                                            </>
                                        ) : !gigData.venueHasReviewed && gigData.disputeLogged && (
                                            <>
                                                <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                                <h4>We have received your report.</h4>
                                            </>
                                        )
                                    )}
                                </>
                            ) : (
                                <>
                                    <h4>{message.text}</h4>
                                    <h6>{new Date(message.timestamp.seconds * 1000).toLocaleString()}</h6>
                                </>
                            )}
                        </div>
                        <div ref={messagesEndRef} />
                    </div>
                ))
            )}
            </div>
            <form className="message-input" onSubmit={handleSendMessage}>
                <input
                    type="text"
                    className='input'
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Aa"
                />
                <button type="submit" className='btn primary'><SendMessageIcon /></button>
            </form>
            {showPaymentModal && (
                <PaymentModal 
                    savedCards={savedCards}
                    onSelectCard={handleSelectCard}
                    onClose={() => {setShowPaymentModal(false); setPaymentSuccess(false)}}
                    gigData={gigData}
                    setMakingPayment={setMakingPayment}
                    makingPayment={makingPayment}
                    setPaymentSuccess={setPaymentSuccess}
                    paymentSuccess={paymentSuccess}
                    setSavedCards={setSavedCards}
                />
            )}
            {showReviewModal &&
                <ReviewModal
                    gigData={gigData}
                    setGigData={setGigData}
                    reviewer={userRole}
                    onClose={(reviewSubmitted) => {
                        setShowReviewModal(false);
                        if (reviewSubmitted) {
                            handleMessageReviewed();
                        }
                    }}
                />
            }
        </>
    );
};