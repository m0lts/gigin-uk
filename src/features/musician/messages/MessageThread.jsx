import React, { useState, useEffect, useRef } from 'react';
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading';
import { 
    RejectedIcon,
    SendMessageIcon,
    TickIcon } from '@features/shared/ui/extras/Icons';
import '@styles/musician/messages.styles.css';
import { ReviewModal } from '@features/shared/components/ReviewModal';
import { useNavigate } from 'react-router-dom';
import { listenToMessages } from '@services/client-side/messages';
import { getVenueProfileById } from '@services/client-side/venues';
import { getMusicianProfileByMusicianId } from '@services/client-side/musicians';
import { sendGigAcceptedEmail, sendGigDeclinedEmail, sendCounterOfferEmail } from '@services/client-side/emails';
import { toast } from 'sonner';
import { formatDate, toJsDate } from '../../../services/utils/dates';
import Portal from '../../shared/components/Portal';
import AddToCalendarButton from '../../shared/components/AddToCalendarButton';
import { notifyOtherApplicantsGigConfirmed } from '../../../services/function-calls/conversations';
import { LoadingSpinner } from '../../shared/ui/loading/Loading';
import { acceptGigOffer, acceptGigOfferOM, declineGigApplication, updateGigWithCounterOffer } from '../../../services/function-calls/gigs';
import { sendGigAcceptedMessage, sendMessage, updateDeclinedApplicationMessage, sendCounterOfferMessage, updateReviewMessageStatus } from '../../../services/function-calls/messages';


export const MessageThread = ({ activeConversation, conversationId, user, musicianProfileId, gigId, gigData, setGigData }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [userRole, setUserRole] = useState('');
    const [allowCounterOffer, setAllowCounterOffer] = useState(false);
    const [newCounterOffer, setNewCounterOffer] = useState('');
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [eventLoading, setEventLoading] = useState(false);
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
            const userEntry = activeConversation.accountNames.find(account => account.accountId === user.uid);
            if (userEntry?.role === 'venue') {
                setUserRole('venue');
            } else if (userEntry?.role === 'band') {
                setUserRole('band');
            } else {
                setUserRole('musician');
            }
        }
    }, [activeConversation])

    useEffect(() => {
        if (!conversationId) return;
        const unsubscribe = listenToMessages(conversationId, setMessages);
        return () => unsubscribe();
      }, [conversationId]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        const text = (newMessage || '').trim();
        if (!text) return;
      
        const tempId = `temp_${Date.now()}`;
        const optimistic = {
          id: tempId,
          senderId: user.uid,
          text,
          timestamp: new Date(),
          pending: true,
        };
      
        setMessages(prev => [...prev, optimistic]);
        setNewMessage('');
      
        try {
          await sendMessage(conversationId, { senderId: user.uid, text });
          setMessages(prev => prev.filter(m => m.id !== tempId));
        } catch (err) {
          console.error('Error sending message:', err);
          setMessages(prev => prev.map(m => m.id === tempId ? { ...m, pending: false, failed: true } : m));
        }
    };
      
    const retrySend = async (tempId) => {
        const msg = messages.find(m => m.id === tempId);
        if (!msg) return;
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, pending: true, failed: false } : m));
        try {
          await sendMessage(conversationId, { senderId: user.uid, text: msg.text });
          setMessages(prev => prev.filter(m => m.id !== tempId));
        } catch (err) {
          setMessages(prev => prev.map(m => m.id === tempId ? { ...m, pending: false, failed: true } : m));
        }
    };

    const handleCounterOffer = (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        setNewCounterOffer(`£${value}`)
    }

    const ensureFuture = () => {
        const now = new Date();
        const d = toJsDate(gigData?.startDateTime);
        if (!d) return false;
        return d > now;
    };

    const handleAcceptGig = async (event, messageId) => {
        event.stopPropagation();
        try {
            if (!gigData) return console.error('Gig data is missing');
            if (!ensureFuture()) return toast.error('Gig is in the past.');
            setEventLoading(true);
            const nonPayableGig = gigData.kind === 'Open Mic' || gigData.kind === "Ticketed Gig" || gigData.budget === '£' || gigData.budget === '£0';
            let globalAgreedFee;
            if (gigData.kind === 'Open Mic') {
                const { updatedApplicants } = await acceptGigOfferOM(gigData, musicianProfileId);
                setGigData((prevGigData) => ({
                    ...prevGigData,
                    applicants: updatedApplicants,
                    paid: true,
                }));
            } else {
                const { updatedApplicants, agreedFee } = await acceptGigOffer(gigData, musicianProfileId, nonPayableGig);
                setGigData((prevGigData) => ({
                    ...prevGigData,
                    applicants: updatedApplicants,
                    agreedFee: `${agreedFee}`,
                    paid: false,
                }));
                globalAgreedFee = agreedFee;
            }
            await sendGigAcceptedMessage(conversationId, messageId, user.uid, globalAgreedFee, userRole, nonPayableGig);
            const venueData = await getVenueProfileById(gigData.venueId);
            const musicianProfileData = await getMusicianProfileByMusicianId(musicianProfileId);
            await sendGigAcceptedEmail({
                userRole,
                musicianProfile: musicianProfileData,
                venueProfile: venueData,
                gigData,
                globalAgreedFee,
                profileType: musicianProfileData.bandProfile ? 'band' : 'musician',
                nonPayableGig,
            });
            if (gigData.kind === 'Ticketed Gig') {
                await notifyOtherApplicantsGigConfirmed(gigData, musicianProfileId);
            }
        } catch (error) {
            console.error('Error updating gig document:', error);
        } finally {
            setEventLoading(false);
        }
    };

    const handleAcceptNegotiation = async (event, messageId) => {
        event.stopPropagation();    
        try {
            if (!gigData) return console.error('Gig data is missing');
            if (!ensureFuture()) return toast.error('Gig is in the past.');
            setEventLoading(true);
            const { updatedApplicants, agreedFee } = await acceptGigOffer(gigData, musicianProfileId);
            setGigData(prev => ({
              ...prev,
              applicants: updatedApplicants,
              agreedFee: `${agreedFee}`,
              paid: false,
            }));
            await sendGigAcceptedMessage(conversationId, messageId, user.uid, agreedFee, userRole);
            const venueData = await getVenueProfileById(gigData.venueId);
            const musicianProfileData = await getMusicianProfileByMusicianId(musicianProfileId);
            await sendGigAcceptedEmail({
                userRole,
                musicianProfile: musicianProfileData,
                venueProfile: venueData,
                gigData,
                agreedFee,
                isNegotiated: true,
                profileType: musicianProfileData.bandProfile ? 'band' : 'musician',
              });
        } catch (error) {
            console.error('Error updating gig document:', error);
        } finally {
            setEventLoading(false);
        }
    };

    const handleDeclineNegotiation = async (event, newFee, messageId) => {
        event.stopPropagation();
        try {
            if (!gigData) return console.error('Gig data is missing');
            if (!ensureFuture()) return toast.error('Gig is in the past.');
            setEventLoading(true);
            const updatedApplicants = await declineGigApplication(gigData, musicianProfileId);
            setGigData(prev => ({
                ...prev,
                applicants: updatedApplicants,
            }));
            await updateDeclinedApplicationMessage(
                conversationId,
                messageId,
                user.uid,
                userRole,
                newFee
            );
            const venueData = await getVenueProfileById(gigData.venueId);
            const musicianProfileData = await getMusicianProfileByMusicianId(musicianProfileId);
            await sendGigDeclinedEmail({
                userRole,
                venueProfile: venueData,
                musicianProfile: musicianProfileData,
                gigData,
                declineType: 'negotiation',
                profileType: musicianProfileData.bandProfile ? 'band' : 'musician',
            });
            setAllowCounterOffer(true);
        } catch (error) {
            console.error('Error updating gig document:', error);
        } finally {
            setEventLoading(false);
        }
    };

    const handleDeclineApplication = async (event, messageId) => {
        event.stopPropagation();
        try {
            if (!gigData) return console.error('Gig data is missing');
            if (!ensureFuture()) return toast.error('Gig is in the past.');
            setEventLoading(true);
            const updatedApplicants = await declineGigApplication(gigData, musicianProfileId);
            setGigData((prevGigData) => ({
                ...prevGigData,
                applicants: updatedApplicants,
            }));
            await updateDeclinedApplicationMessage(
                conversationId,
                messageId,
                user.uid,
                userRole,
            );
            const venueData = await getVenueProfileById(gigData.venueId);
            const musicianProfileData = await getMusicianProfileByMusicianId(musicianProfileId);
            await sendGigDeclinedEmail({
                userRole,
                venueProfile: venueData,
                musicianProfile: musicianProfileData,
                gigData,
                profileType: musicianProfileData.bandProfile ? 'band' : 'musician',
              });
        } catch (error) {
            console.error('Error updating gig document:', error);
        } finally {
            setEventLoading(false);
        }
    };

    const handleSendCounterOffer = async (newFee, messageId) => {
        try {
            if (!gigData) return console.error('Gig data is missing');
            if (!ensureFuture()) return toast.error('Gig is in the past.');
            setEventLoading(true);
            const value = (newFee || '').trim();
            const numericPart = value.replace(/£|\s/g, '');
            const num = Number(numericPart);
            if (!numericPart || isNaN(num) || num <= 0) {
                toast.info('Please enter a valid value.');
                return;
            }
            const updatedApplicants = await updateGigWithCounterOffer(gigData, musicianProfileId, newFee, 'musician');
            setGigData((prev) => ({ ...prev, applicants: updatedApplicants }));
            await sendCounterOfferMessage(
                conversationId,
                messageId,
                user.uid,
                newFee,
                gigData.budget,
                userRole
            );
            const venueData = await getVenueProfileById(gigData.venueId);
            const musicianProfileData = await getMusicianProfileByMusicianId(musicianProfileId);
            await sendCounterOfferEmail({
                userRole,
                musicianProfile: musicianProfileData,
                venueProfile: venueData,
                gigData,
                newFee,
                profileType: musicianProfileData.bandProfile ? 'band' : 'musician',
            });
            setAllowCounterOffer(false);
        } catch (error) {
            console.error('Error sending counter-offer:', error);
        } finally {
            setEventLoading(false);
        }
    };

    const handleMessageReviewed = async () => {
        try {
          const reviewedMessageId = await updateReviewMessageStatus(conversationId, messages, user.uid);
          if (reviewedMessageId) {
            const updatedMessages = messages.map((msg) =>
              msg.id === reviewedMessageId ? { ...msg, status: 'closed' } : msg
            );
            setMessages(updatedMessages);
          }
        } catch (error) {
          console.error('Error updating message in Firestore:', error);
        }
    };

    const autoLinkText = (text) => {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.split(urlRegex).map((part, index) => {
          if (urlRegex.test(part)) {
            return (
              <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="message-link">
                {part.includes('token') ? 'Private Gig Link' : part}
              </a>
            );
          }
          return part;
        });
    };

    const resolveAccount = (conversation, uid) => {
        if (!conversation || !uid) return null;
        return (
          conversation.accountNames?.find((a) => a.accountId === uid) || null
        );
    };
    
    const resolveGroupByUid = (conversation, uid) => {
        const acc = resolveAccount(conversation, uid);
        const role = acc?.role;
        if (!role) return null;
        if (role === 'venue') return 'venue';
        if (role === 'band' || role === 'Band Leader' || role === 'Band Member' || role === 'musician') {
          return 'band';
        }
        return null;
    };

    const start = toJsDate(gigData?.startDateTime);
    const durationMs = Number(gigData?.duration || 0) * 60_000;
    const end = start ? new Date(start.getTime() + durationMs) : null;

    const hasBeenDeleted = messages.some((m) => m.status === 'gig deleted');

    if (!gigData && hasBeenDeleted) {
      const deletedMessage = messages.find((m) => m.status === 'gig deleted');
      return (
        <div className='message-container' style={{ marginTop: '2rem'}}>
          <div className='message announcement'>
            <>
              {deletedMessage?.timestamp && (
                <h6>
                  {new Date(deletedMessage.timestamp.seconds * 1000).toLocaleString()}
                </h6>
              )}
              <h4>
                This gig has been deleted by the venue.
              </h4>
            </>
          </div>
        </div>
      );
    }

    const isSystemMessage = (msg) => {
        // Treat pure announcements and review prompts as system
        return msg?.type === 'announcement' || msg?.type === 'review';
    };
    
    
    return (
        <>
        <div className='messages'>
            {messages.length > 0 && (
                messages.map((message) => {
                    const senderAccount = resolveAccount(activeConversation, message.senderId);
                    const senderName = senderAccount?.accountName || 'Unknown';
                    const senderImg =
                      senderAccount?.accountImg ||
                      senderAccount?.musicianImg ||
                      senderAccount?.venueImg ||
                      null;
          
                    const userGroup = resolveGroupByUid(activeConversation, user.uid);
                    const senderGroup = resolveGroupByUid(activeConversation, message.senderId);
                    const isSameGroup = senderGroup && userGroup && senderGroup === userGroup;
          
                    const isSelf = message.senderId === user.uid;
                    const system = isSystemMessage(message);
                    const ts = toJsDate(message.timestamp);

                return (
                    <div className='message-container' key={message.id}>
                        {!isSelf && !system && (
                            <div className="message-sender">
                            {senderImg ? (
                                <img src={senderImg} alt={senderName} className="sender-avatar" />
                            ) : (
                                <div className="sender-placeholder">{(senderName?.[0] || '•').toUpperCase()}</div>
                            )}
                            <span className="sender-name">{senderName}</span>
                            </div>
                        )}
                        <div className={`message ${message.senderId === user.uid ? 'sent' : 'received'} ${message.type === 'negotiation' ? 'negotiation' : ''} ${message.type === 'application' ? 'application' : ''} ${message.type === 'announcement' || message.type === 'review' ? 'announcement' : ''}`} >
                            {(message.type === 'application' || message.type === 'invitation') && isSameGroup ? (
                                <>
                                    <h4>
                                        {message.type === 'application' ? (
                                            <div className='accepted-group'>
                                                Gig application sent.
                                                {userRole !== 'venue' && activeConversation.bandConversation ? (
                                                    <button className='btn primary' onClick={() => navigate(`/dashboard/bands/${activeConversation.accountNames.find(account => account.role === 'band')}`)}>
                                                        Check Band Profile
                                                    </button>
                                                ) : userRole === 'musician' && (
                                                    <button className='btn primary' onClick={() => navigate('/dashboard/profile')}>
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
                                            <div className='status-box'>
                                                <div className='status confirmed'>
                                                    <TickIcon />
                                                    Accepted
                                                </div>
                                            </div>
                                        </div>
                                    ) : (message.status === 'declined' || message.status === 'countered' || message.status === 'apps-closed') ? (
                                        <>
                                        <div className='status-box'>
                                            <div className='status rejected'>
                                                <RejectedIcon />
                                                Declined
                                            </div>
                                        </div>
                                        {message.status !== 'countered'  && (gigData?.kind !== 'Ticketed Gig' && gigData?.kind !== 'Open Mic') && message.status !== 'apps-closed' &&  (
                                            <div className={`counter-offer ${isSameGroup ? 'sent' : 'received'}`}>
                                                {eventLoading ? (
                                                    <LoadingSpinner width={15} height={15} marginTop={5} marginBottom={5} />
                                                ) : (
                                                    <>
                                                        <h4>Send Counter Offer:</h4>
                                                        <div className='input-group'>
                                                            <input
                                                                type='text'
                                                                className='input'
                                                                value={newCounterOffer}
                                                                onChange={(e) => handleCounterOffer(e)}
                                                                placeholder='£'
                                                                disabled={eventLoading}
                                                            />
                                                                <button
                                                                    className='btn primary'
                                                                    onClick={() => handleSendCounterOffer(newCounterOffer, message.id)}
                                                                >
                                                                    Send
                                                                </button>
                                                        </div>
                                                    </>
                                                )}
                                        </div>
                                        )}
                                        </>
                                    ) : message.status === 'withdrawn' && (
                                        <div className='status-box'>
                                            <div className='status rejected'>
                                                <RejectedIcon />
                                                Application Withdrawn
                                            </div>
                                        </div>
                                    )}
                                    <h6>{ts ? ts.toLocaleString() : ''}</h6>
                                </>
                            ) 
                            : (message.type === 'application' || message.type === 'invitation') && !isSameGroup ? (
                                <>
                                    <h4>{autoLinkText(message.text)}</h4>
                                    {message.status === 'accepted' ? (
                                        <div className='status-box'>
                                            <div className='status confirmed'>
                                                <TickIcon />
                                                Accepted
                                            </div>
                                        </div>
                                    ) : (message.status === 'declined' || message.status === 'countered' || message.status === 'apps-closed') ? (
                                        <>
                                        <div className='status-box'>
                                            <div className='status rejected'>
                                                <RejectedIcon />
                                                Declined
                                            </div>
                                        </div>
                                        {message.status !== 'countered' && (gigData?.kind !== 'Ticketed Gig' && gigData?.kind !== 'Open Mic')  && message?.status !== 'apps-closed' &&  (
                                            <div className={`counter-offer ${isSameGroup ? 'sent' : 'received'}`}>
                                                {eventLoading ? (
                                                    <LoadingSpinner width={15} height={15} marginTop={5} marginBottom={5} />
                                                ) : (
                                                    <>
                                                        <h4>Send Counter Offer:</h4>
                                                        <div className='input-group'>
                                                            <input
                                                                type='text'
                                                                className='input'
                                                                value={newCounterOffer}
                                                                onChange={(e) => handleCounterOffer(e)}
                                                                placeholder='£'
                                                                disabled={eventLoading}
                                                            />
                                                            <button
                                                                className='btn primary'
                                                                onClick={() => handleSendCounterOffer(newCounterOffer, message.id)}
                                                            >
                                                                Send
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                        </>
                                    ) : message.status !== 'countered' && message.status !== 'apps-closed' ? (
                                        <div className='two-buttons'>
                                            {eventLoading ? (
                                                <LoadingSpinner width={15} height={15} marginTop={5} marginBottom={5} />
                                            ) : (
                                                <>
                                                    <button className='btn accept' onClick={(event) => handleAcceptGig(event, message.id)}>
                                                        Accept
                                                    </button>
                                                    <button className='btn decline' onClick={(event) => handleDeclineApplication(event, message.id)}>
                                                        Decline
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    ) : message.status === 'withdrawn' && (
                                        <div className='status-box'>
                                            <div className='status rejected'>
                                                <RejectedIcon />
                                                Application Withdrawn
                                            </div>
                                        </div>
                                    )}
                                    <h6>{ts ? ts.toLocaleString() : ''}</h6>
                                </>
                            ) : 
                            message.type === 'negotiation' && isSameGroup ? (
                                <>
                                    <div className='fees'>
                                        <h4 style={{ textDecoration: 'line-through' }}>{message.oldFee}</h4>
                                        <h4>{message.newFee}</h4>
                                    </div>
                                    {message.status === 'accepted' ? (
                                        <div className='status-box'>
                                            <div className='status confirmed'>
                                                <TickIcon />
                                                Accepted
                                            </div>
                                        </div>
                                    ) : message.status === 'declined' || message.status === 'apps-closed' ? (
                                        <>
                                            <div className='status-box'>
                                                <div className='status rejected'>
                                                    <RejectedIcon />
                                                    Declined
                                                </div>
                                            </div>
                                        </>
                                    ) : message.status === 'withdrawn' && (
                                        <div className='status-box'>
                                            <div className='status rejected'>
                                                <RejectedIcon />
                                                Application Withdrawn
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : message.type === 'negotiation' && !isSameGroup ? (
                                <>
                                    <h4>{message.text}</h4>
                                    <div className='fees'>
                                        <h4 style={{ textDecoration: 'line-through' }}>{message.oldFee}</h4>
                                        <h4>{message.newFee}</h4>
                                    </div>
                                    {message.status === 'accepted' ? (
                                        <div className='status-box'>
                                            <div className='status confirmed'>
                                                <TickIcon />
                                                Accepted
                                            </div>
                                        </div>
                                    ) : (message.status === 'declined' || message.status === 'countered' && message.status === 'apps-closed') ? (
                                        <>
                                            <div className='status-box'>
                                                <div className='status rejected'>
                                                    <RejectedIcon />
                                                    Declined
                                                </div>
                                            </div>
                                            {message.status !== 'countered'  && (gigData.kind !== 'Ticketed Gig' && gigData.kind !== 'Open Mic') && message.status !== 'apps-closed' && (
                                                <div className={`counter-offer ${isSameGroup ? 'sent' : 'received'}`}>
                                                        {eventLoading ? (
                                                            <LoadingSpinner width={15} height={15} marginTop={5} marginBottom={5} />
                                                        ) : (
                                                            <>
                                                                <h4>Send Counter Offer:</h4>
                                                                <div className='input-group'>
                                                                    <input
                                                                        type='text'
                                                                        className='input'
                                                                        value={newCounterOffer}
                                                                        onChange={(e) => handleCounterOffer(e)}
                                                                        placeholder='£'
                                                                        disabled={eventLoading}
                                                                    />
                                                                    <button
                                                                        className='btn primary'
                                                                        onClick={() => handleSendCounterOffer(newCounterOffer, message.id)}
                                                                    >
                                                                        Send
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}
                                                </div>
                                            )}
                                        </>
                                    ) : message.status !== 'countered' && message.status !== "apps-closed" ? (
                                        <div className='two-buttons'>
                                            {eventLoading ? (
                                                <LoadingSpinner width={15} height={15} marginTop={5} marginBottom={5} />
                                            ) : (
                                                <>
                                                    <button className='btn accept' onClick={(event) => handleAcceptNegotiation(event, message.id)}>
                                                        Accept
                                                    </button>
                                                    <button className='btn decline' onClick={(event) => handleDeclineNegotiation(event, message.newFee, message.id)}>
                                                        Decline
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    ) : message.status === 'withdrawn' && (
                                        <div className='status-box'>
                                            <div className='status rejected'>
                                                <RejectedIcon />
                                                Application Withdrawn
                                            </div>
                                        </div>
                                    )}
                                    <h6>{ts ? ts.toLocaleString() : ''}</h6>
                                </>
                            ) : message.type === 'announcement' ? (
                                <>
                                {(gigData?.kind === 'Open Mic' || gigData?.kind === 'Ticketed Gig') ? (
                                    <>
                                        <h6>{ts ? ts.toLocaleString() : ''}</h6>
                                        <h4>{message.text} The gig is confirmed for {formatDate(gigData.startDateTime, 'withTime')}.</h4>
                                        {gigData && message.text !== "This gig has been confirmed with another musician. Applications are now closed." && (
                                            <AddToCalendarButton
                                                event={{
                                                    title: `Gig at ${gigData?.venue?.venueName}`,
                                                    start: start,
                                                    end: end,
                                                    description: `Gig confirmed with fee: ${gigData?.agreedFee}`,
                                                    location: gigData?.venue?.address,
                                                }}
                                            />
                                        )}
                                    </>
                                ) : message.status === 'awaiting payment' && (userRole === 'musician' || userRole === 'band') ? (
                                    <>
                                        <h6>{ts ? ts.toLocaleString() : ''}</h6>
                                        <h4>{message.text} Once the venue has paid the fee, the gig will be confirmed.</h4>
                                    </>
                                ) : message.status === 'gig confirmed' ? (
                                    (gigData?.kind === 'Open Mic' || gigData?.kind === 'Ticketed Gig' || gigData?.budget === '£' || gigData?.budget === '£0') ? (
                                        <>
                                            <h6>{ts ? ts.toLocaleString() : ''}</h6>
                                            <h4>{message.text} The gig is confirmed for {formatDate(gigData.startDateTime, 'withTime')}.</h4>
                                            {gigData && (
                                                <AddToCalendarButton
                                                    event={{
                                                        title: `Gig at ${gigData?.venue?.venueName}`,
                                                        start: start,
                                                        end: end,
                                                        description: `Gig confirmed with fee: ${gigData?.agreedFee}`,
                                                        location: gigData?.venue?.address,
                                                    }}
                                                />
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <h6>{ts ? ts.toLocaleString() : ''}</h6>
                                            <h4>{message.text} {userRole !== 'venue' && !activeConversation.bandConversation ? 'Your payment will arrive in your account 48 hours after the gig has been performed.' : userRole !== 'venue' && activeConversation.bandConversation && 'The band admin will receive the gig fee 48 hours after the gig is performed.'}</h4>
                                            {gigData && (
                                                <AddToCalendarButton
                                                    event={{
                                                        title: `Gig at ${gigData?.venue?.venueName}`,
                                                        start: start,
                                                        end: end,
                                                        description: `Gig confirmed with fee: ${gigData?.agreedFee}`,
                                                        location: gigData?.venue?.address,
                                                    }}
                                                />
                                            )}
                                        </>
                                    )
                                ) : message.status === 'payment failed' && (userRole === 'musician' || userRole === 'band') ? (
                                    <>
                                        <h6>{ts ? ts.toLocaleString() : ''}</h6>
                                        <h4>The gig will be confirmed when the venue has paid the gig fee.</h4>
                                    </>
                                ) : message.status === 'cancellation' && message?.cancellingParty === 'venue' ? (
                                    <>
                                        <h6>{ts ? ts.toLocaleString() : ''}</h6>
                                        <h4>{message.text}</h4>
                                    </>
                                ) : message.status === 'cancellation' && (userRole === 'musician' || userRole === 'band') ? (
                                    <>
                                        <h6>{ts ? ts.toLocaleString() : ''}</h6>
                                        <h4>You cancelled the gig. The gig fee has been refunded to the venue.</h4>
                                    </>
                                ) : message.status === 'dispute' ? (
                                    <>
                                        <h6>{ts ? ts.toLocaleString() : ''}</h6>
                                        <h4>{message.text}</h4>
                                    </>
                                ) : message.status === 'gig deleted' ? (
                                    <>
                                        <h6>{ts ? ts.toLocaleString() : ''}</h6>
                                        <h4>{message.text}</h4>
                                    </>
                                ) : message.status === 'gig booked' && (
                                    <>
                                        <h6>{ts ? ts.toLocaleString() : ''}</h6>
                                        <h4>{message.text}</h4>
                                    </>
                                )}
                                </>
                            ) : message.type === 'review' && gigData ? (
                                <>
                                    {(userRole === 'musician' || userRole === 'band') ? (
                                        !gigData?.musicianHasReviewed ? (
                                            <>
                                                <h6>{ts ? ts.toLocaleString() : ''}</h6>
                                                <h4>How was your experience? Click the button below to review the venue.</h4>
                                                <button
                                                    className='btn primary'
                                                    onClick={() => setShowReviewModal(true)}
                                                >
                                                    {gigData?.disputeClearingTime && new Date(gigData?.disputeClearingTime.toDate()) > new Date()
                                                        ? 'Leave a Review'
                                                        : 'Leave a Review'}
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <h6>{ts ? ts.toLocaleString() : ''}</h6>
                                                <h4>Thank you for submitting your review.</h4>
                                            </>
                                        )
                                    ) : (
                                        !gigData?.venueHasReviewed && !gigData?.disputeLogged ? (
                                            <>
                                                <h6>{ts ? ts.toLocaleString() : ''}</h6>
                                                <h4>How was your experience? Click the button below to review the musician{gigData.disputeClearingTime && new Date(gigData.disputeClearingTime.toDate()) > new Date() ? ' or if you want to report an issue with the gig and request a refund.' : '.'}</h4>
                                                <button
                                                    className='btn primary'
                                                    onClick={() => setShowReviewModal(true)}
                                                >
                                                    {gigData?.disputeClearingTime && new Date(gigData?.disputeClearingTime.toDate()) > new Date()
                                                        ? 'Leave a Review / Report Issue'
                                                        : 'Leave a Review'}
                                                </button>
                                            </>
                                        ) : gigData?.venueHasReviewed && !gigData?.disputeLogged ? (
                                            <>
                                                <h6>{ts ? ts.toLocaleString() : ''}</h6>
                                                <h4>Thank you for submitting your review.</h4>
                                            </>
                                        ) : !gigData?.venueHasReviewed && gigData?.disputeLogged && (
                                            <>
                                                <h6>{ts ? ts.toLocaleString() : ''}</h6>
                                                <h4>We have received your report.</h4>
                                            </>
                                        )
                                    )}
                                </>
                            ) : (
                                <>
                                    <h4>{message.text}</h4>
                                    {message.senderId === user.uid && (
                                        <div className="msg-meta">
                                            {message.pending && <h6>Sending…</h6>}
                                            {message.failed && (
                                                <>
                                                    <h6>Failed to send</h6>
                                                    <button className="btn secondary" onClick={() => retrySend(message.id)}>Retry</button>
                                                </>
                                            )}
                                            {!message.pending && !message.failed && (
                                                <h6>{ts ? ts.toLocaleString() : ''}</h6>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        <div ref={messagesEndRef} />
                    </div>
                )})
            )}
            </div>
            <form className='message-input' onSubmit={handleSendMessage}>
                <input
                    type='text'
                    className='input'
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder='Type your message...'
                    maxLength={500}
                />
                <button type='submit' className='btn primary'><SendMessageIcon /></button>
            </form>
            {showReviewModal && (
                <Portal>
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
                </Portal>
            )}
        </>
    );
};