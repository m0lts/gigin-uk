// import { useState, useEffect } from 'react';
// import { MessageThread } from '../../pages/Messages/MessageThread';
// import '/styles/common/messages.styles.css'
// import { LeftChevronIcon, NewTabIcon, OptionsIcon, RightChevronIcon } from '../ui/Extras/Icons';
// import { doc, getDoc } from 'firebase/firestore';
// import { firestore } from '../../firebase';

// export const MessagesPopUp = ({ conversations, onClose, user }) => {
//     const [activeConversation, setActiveConversation] = useState(null);

//     // Function to handle selecting a conversation
//     const handleSelectConversation = (conversationId) => {
//         setActiveConversation(conversationId);
//     };

//     // Function to handle closing the message thread and returning to the list of conversations
//     const handleBackToConversations = () => {
//         setActiveConversation(null);
//     };

//     const openMusicianProfile = () => {
//         const gigId = conversations.find(c => c.id === activeConversation)?.gigId;
//         const musicianId = conversations.find(c => c.id === activeConversation)?.accountNames.find(account => account.accountId !== user.uid)?.participantId;
//         const url = `/musician/${musicianId}/${gigId}`;
//         window.open(url, '_blank');
//     };

//     console.log(activeConversation);

//     return (
//         <div className="messages-popup">
//             <div className={`conversation-list ${activeConversation ? 'slide-out' : 'slide-in'}`}>
//                 <div className="banner">
//                     <h3>Your Messages</h3>
//                     <div className="options">
//                         <button className="btn tertiary">
//                             <OptionsIcon />
//                         </button>
//                         <button className="btn tertiary">
//                             <NewTabIcon />
//                         </button>
//                         <button onClick={onClose} className="btn icon close">&times;</button>
//                     </div>
//                 </div>
//                 <ul className="conversations">
//                     {conversations.length > 0 ? (
//                         conversations.map(conversation => {
//                             const otherParticipant = conversation.accountNames.find(account => account.accountId !== user.uid);

//                             return (
//                                 <li className="conversation" key={conversation.id} onClick={() => handleSelectConversation(conversation.id)}>
//                                     <div className="conversation-header">
//                                         <h3 className="participant-name">
//                                             {otherParticipant ? otherParticipant.accountName : 'Unknown'}
//                                         </h3>
//                                         <h6 className="conversation-date">
//                                             {new Date(conversation.lastMessageTimestamp.seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
//                                         </h6>
//                                     </div>
//                                     <div className="conversation-body">
//                                         <p className="last-message-preview">
//                                             {conversation.lastMessage}
//                                         </p>
//                                         <RightChevronIcon />
//                                     </div>
//                                 </li>
//                             );
//                         })
//                     ) : (
//                         <p>No messages yet.</p>
//                     )}
//                 </ul>
//             </div>

//             <div className={`popup-message-thread ${activeConversation ? 'slide-in' : 'slide-out'}`}>
//                 {activeConversation && (
//                     <>
//                         <div className="banner">
//                             <div className="username">
//                                 <button className="btn text back" onClick={handleBackToConversations}><LeftChevronIcon /></button>
//                                 <h3 onClick={() => openMusicianProfile()}>{conversations.find(c => c.id === activeConversation)?.accountNames.find(account => account.accountId !== user.uid)?.accountName}</h3>
//                             </div>
//                             <div className="options">
//                                 <button className="btn tertiary">
//                                     <OptionsIcon />
//                                 </button>
//                                 <button className="btn tertiary">
//                                     <NewTabIcon />
//                                 </button>
//                                 <button onClick={onClose} className="btn icon close">&times;</button>
//                             </div>
//                         </div>
//                         <div className="messages">
//                             <MessageThread conversationId={activeConversation} user={user} />
//                         </div>
//                     </>
//                 )}
//             </div>
//         </div>
//     );
// };