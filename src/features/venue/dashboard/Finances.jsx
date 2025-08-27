import React, { useState, useEffect } from 'react';
import { CardForm } from '@features/shared/components/CardDetails'
import { 
  InvoiceIcon,
  SortIcon,
  PlusIcon,
  DeleteIcon } from '@features/shared/ui/extras/Icons';
import VisaIcon from '@assets/images/visa.png';
import MastercardIcon from '@assets/images/mastercard.png';
import AmexIcon from '@assets/images/amex.png';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { deleteSavedCard } from '@services/functions';
import { useResizeEffect } from '@hooks/useResizeEffect';
import { openInNewTab } from '@services/utils/misc';
import { CardIcon, CoinsIconSolid, DeleteGigIcon, HouseIconSolid, PeopleRoofIconSolid, PieChartIcon } from '../../shared/ui/extras/Icons';
import { toast } from 'sonner';
import { changeDefaultCard } from '../../../services/functions';
import { useAuth } from '@hooks/useAuth';
import { updateUserDocument } from '../../../services/users';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);


export const Finances = ({ savedCards, receipts, customerDetails, setStripe, venues }) => {

  const {user} = useAuth();
  const [sortOrder, setSortOrder] = useState('desc');
  const [addCardModal, setAddCardModal] = useState(false);
  const [newCardSaved, setNewCardSaved] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [showFirstTimeModal, setShowFirstTimeModal] = useState(false);

  const toggleMenu = (cardId) => {
    setOpenMenuId(prev => (prev === cardId ? null : cardId));
  };

  useResizeEffect((width) => {
    setWindowWidth(width);
  });


  const totalExpenditure = receipts.reduce((total, receipt) => total + receipt.amount / 100, 0);


  useEffect(() => {
    if (!newCardSaved) return;
  
    setStripe((prev) => {
      const newDefaultId = newCardSaved.__newDefaultId || newCardSaved.id;
      const byId = new Map((prev.savedCards || []).map(c => [c.id, c]));
      byId.set(newCardSaved.id, { ...newCardSaved });
      const nextCards = Array.from(byId.values()).map(c => ({
        ...c,
        default: c.id === newDefaultId,
      }));
      nextCards.sort((a, b) => (b.default === a.default ? 0 : b.default ? 1 : -1));
      return { ...prev, savedCards: nextCards };
    });
  
    // Clear the flag/object once consumed (optional)
    // setNewCardSaved(null);
  }, [newCardSaved, setStripe]);

  useEffect(() => {
    const checkFirstTime = async () => {
      if (user?.firstTimeInFinances !== false) {
        setShowFirstTimeModal(true);
      }
    };
    if (user?.uid) checkFirstTime();
  }, [user]);

  const formatReceiptCharge = (amount) => {
    return (amount / 100).toFixed(2);
  };

  const formatReceiptDate = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
    }) + `, ${date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
    })}`;
};

  const toggleSortOrder = () => {
    setSortOrder((prevOrder) => (prevOrder === 'desc' ? 'asc' : 'desc'));
  };

  const cardBrandIcons = {
    visa: VisaIcon,
    mastercard: MastercardIcon,
    amex: AmexIcon,
    unknown: null,
  };

  const handleDeleteCard = async (cardId) => {
    try {
      if (!window.confirm('Are you sure you want to delete this card?')) {
        return;
      }
      toast.info('Deleting card...')
      setOpenMenuId(null);
      const result = await deleteSavedCard(cardId);
      if (result.success) {
        toast.success("Card deleted.");
        setStripe((prev) => ({
          ...prev,
          savedCards: prev.savedCards.filter((card) => card.id !== cardId),
        }));
      } else {
        toast.error("Failed to delete card. Please try again.");
      }
    } catch (error) {
      console.error('Error deleting card:', error);
    }
  };

  const handleMakeDefault = async (cardId) => {
    try {
      toast.info('Changing default payment method...')
      setOpenMenuId(null);
      await changeDefaultCard(cardId);
      setStripe((prev) => ({
        ...prev,
        savedCards: prev.savedCards.map((c) => ({
          ...c,
          default: c.id === cardId,
        })),
      }));
      toast.success("Card set as default.");
    } catch (err) {
      toast.error("Failed to set default card. Please try again.");
      console.error(err);
    }
  };

  return (
    <>
    <div className='head'>
        <h1 className='title'>Finances</h1>
    </div>
    <div className='body finances'>
      <div className="top-section">
        <div className='expenditure-card'>
          <div className="expenditure-icon">
            <CoinsIconSolid />
          </div>
          <div className="expenditure-text">
            <h5>Overall Expenditure</h5>
            <h2>£{totalExpenditure.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
          </div>
        </div>
        <div className="venue-expenditure-container">
          {venues.map((venue) => {
            const venueReceipts = receipts.filter(
              (r) => r.metadata?.venueId === venue.venueId
            );

            if (venueReceipts.length === 0) return null;

            const totalSpent = venueReceipts.reduce(
              (acc, r) => acc + (r.amount || 0),
              0
            );

            return (
              <div key={venue.venueId} className="expenditure-card other">
                <PieChartIcon />
                <div className="expenditure-text">
                  <h3>£{(totalSpent / 100).toFixed(2)}</h3>
                  <h5>{venue.name}</h5>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className='saved-cards'>
        <h2>My Cards</h2>
        <ul className="card-list">
          <li className="styled-card add-card" onClick={() => setAddCardModal(true)}>
            <div className="add-card-content">
              <PlusIcon />
              <h3>Add Card</h3>
            </div>
          </li>
          {savedCards.map((card) => (
            <li key={card.id} className={`styled-card ${card.card.brand.toLowerCase()}`}>
              <div className="card-top">
                <span className="dots" onClick={() => toggleMenu(card.id)}>•••</span>
                
                {openMenuId === card.id && (
                  <div className="card-menu">
                    {!card.default && (
                      <button className='btn secondary' onClick={() => handleMakeDefault(card.id)}>Make Default <CardIcon /></button>
                    )}
                    <button className='btn danger' onClick={() => handleDeleteCard(card.id)}>Delete Card <DeleteGigIcon /></button>
                  </div>
                )}
              </div>

              <div className="card-number">**** **** **** {card.card.last4}</div>

              <div className="card-bottom">
                <div className="card-info">
                  <div className="card-holder">{card.billing_details?.name}</div>
                  <div className="card-expiry">{card.card.exp_month}/{card.card.exp_year}</div>
                </div>
                <img
                  src={cardBrandIcons[card.card.brand.toLowerCase()]}
                  alt={card.card.brand}
                  className="brand-logo"
                />
              </div>

              {card.default && (
                <span className="card-default">Default</span>
              )}
            </li>
          ))}
      </ul>
      </div>
      <div className='tile your-fees'>
        <h2>Your Payments</h2>
        <table>
          <thead>
            <tr>
              <th id='date'>
                Date
              <button className='sort btn text' onClick={toggleSortOrder}>
                <SortIcon />
              </button>
              </th>
              <th>Amount</th>
              <th>Venue</th>
              <th className='centre'>Status</th>
            </tr>
          </thead>
          <tbody>
            {receipts.length > 0 ? (
              receipts.map((receipt) => {
                return (
                  <tr key={receipt.id} onClick={(e) => openInNewTab(receipt.receipt_url, e)}>
                    <td>{formatReceiptDate(receipt.created)}</td>
                    <td>£{formatReceiptCharge(receipt.amount)}</td>
                    <td>{receipt.metadata.venueName}</td>
                    <td className={`status-box ${receipt.status}`}>
                      <div className={`status ${receipt.status}`}>
                        {receipt.status}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr className='no-receipts'>
                <td className='data' colSpan={6}>
                  <div className='flex'>
                    <InvoiceIcon />
                    <h4>Your payments will show here.</h4>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
  </div>
    {addCardModal && (
      <div className='modal'>
        <div className='modal-content scrollable'>
          <div className="modal-header">
            <CardIcon />
            <h2>Add New Payment Method</h2>
            <p>Save a card to your account to make future gig payments quicker.</p>
          </div>
          <div className="modal-body">
            <CardForm activityType={'adding card'} setSaveCardModal={setAddCardModal} setNewCardSaved={setNewCardSaved} />
          </div>
          <button className='btn tertiary close' onClick={() => setAddCardModal(false)}>
            Close
          </button>
        </div>
      </div>
    )}
    {showFirstTimeModal && (
      <div className='modal'>
        <div className='modal-content' style={{ maxWidth: '300px'}}>
          <div className="modal-header">
            <CoinsIconSolid />
            <h2>Your Finances</h2>
            <p>If you are paying musicians flat fees, this is where you can track your spending, see your gig receipts, and manage your credit/debit cards.</p>
          </div>
          <div className="modal-body">
            <button className="btn primary" onClick={async () => {setShowFirstTimeModal(false); await updateUserDocument(user?.uid, {firstTimeInFinances: false});}}>
              Ok
            </button>
          </div>
          <button className='btn tertiary close' onClick={async () => {setShowFirstTimeModal(false); await updateUserDocument(user?.uid, {firstTimeInFinances: false});}}>
            Close
          </button>
        </div>
      </div>
    )}
  </>
  );
};