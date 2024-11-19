import React, { useState, useEffect } from 'react';
import { CardForm } from '../../../components/common/CardDetails'
import { OptionsIcon, InvoiceIcon, SortIcon, PlusIcon, DeleteIcon } from "/components/ui/Extras/Icons";
import VisaIcon from '/assets/images/visa.png';
import MastercardIcon from '/assets/images/mastercard.png';
import AmexIcon from '/assets/images/amex.png';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase.js';

export const Finances = ({ savedCards, receipts, customerDetails, setSavedCards }) => {

  const [sortOrder, setSortOrder] = useState('desc');
  const [addCardModal, setAddCardModal] = useState(false);
  const [newCardSaved, setNewCardSaved] = useState(false);

  useEffect(() => {
    if (newCardSaved) {
      window.location.reload();
    }
  }, [newCardSaved])

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

  const openReceipt = (url) => {
      window.open(url, '_blank');
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
  
      // Call the backend function to delete the card
      const deleteCard = httpsCallable(functions, 'deleteCard');
      const response = await deleteCard({ cardId });
  
      if (response.data.success) {
        alert('Card deleted successfully!');
        // Optionally, update the frontend state to remove the card from the UI
        setSavedCards((prevCards) => prevCards.filter((card) => card.id !== cardId));
      } else {
        alert('Failed to delete the card.');
      }
    } catch (error) {
      console.error('Error deleting card:', error);
      alert('An error occurred while deleting the card. Please try again.');
    }
  };

  console.log(savedCards)

  return (
    <>
    <div className="head">
        <h1 className="title">Finances</h1>
    </div>
    <div className="body finances">
      <div className="tile receipts-table">
        <h2>Payments</h2>
        <table>
          <thead>
            <tr>
              <th id='date'>
                Date
              <button className="sort btn text" onClick={toggleSortOrder}>
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
                  <tr key={receipt.id} onClick={() => openReceipt(receipt.receipt_url)}>
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
                  <div className="flex">
                    <InvoiceIcon />
                    <h4>No receipts to show.</h4>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="other-details">
          <div className="tile saved-cards">
            <h2>Saved Cards</h2>
            <ul className="card-list">
            {savedCards.map((card) => (
              <li
                key={card.id}
                className={`card-item`}
              >   
                <div className="card-left">
                    <img
                        src={cardBrandIcons[card.card.brand.toLowerCase()]}
                        alt="Card Type"
                        className="card-brand-icon"
                    />
                    <div className="card-details">
                        <h4>
                        {card.card.brand.toUpperCase()} ending in {card.card.last4}
                        </h4>
                        <h6>Expires {card.card.exp_month}/{card.card.exp_year}</h6>
                    </div>
                </div>
                {card.customer.default_source && (card.customer.default_source === card.card.id) && (
                    <div className="card-type">
                        <p>Default</p>
                    </div>
                )}
                <button className="btn danger" onClick={() => handleDeleteCard(card.id)}>
                  <DeleteIcon />
                </button>
            </li>
            ))}
            <li className="card-item hoverable" onClick={() => setAddCardModal(true)}>
              <h4>Add Another Card</h4>
              <PlusIcon />
            </li>
            </ul>
          </div>
      </div>
    </div>
    {addCardModal && (
      <div className="modal">
        <div className="modal-content">
          <h2>Add A Payment Method</h2>
            <CardForm activityType={'adding card'} setSaveCardModal={setAddCardModal} setNewCardSaved={setNewCardSaved} />
          <button className="btn tertiary close" onClick={() => setAddCardModal(false)}>
            Close
          </button>
        </div>
      </div>
    )}
  </>
  );
};