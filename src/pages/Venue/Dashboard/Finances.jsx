import React, { useState, useEffect } from 'react';
import { CardForm } from '../../../components/common/CardDetails'
import { OptionsIcon, InvoiceIcon, SortIcon, PlusIcon, DeleteIcon } from "/components/ui/Extras/Icons";
import VisaIcon from '/assets/images/visa.png';
import MastercardIcon from '/assets/images/mastercard.png';
import AmexIcon from '/assets/images/amex.png';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase.js';
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

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);


export const Finances = ({ savedCards, receipts, customerDetails, setSavedCards }) => {

  const [sortOrder, setSortOrder] = useState('desc');
  const [addCardModal, setAddCardModal] = useState(false);
  const [newCardSaved, setNewCardSaved] = useState(false);

  const earningsData = receipts.reduce((acc, receipt) => {
    const receiptDate = new Date(receipt.metadata.date).toLocaleDateString('en-GB', {
        month: 'short',
        year: 'numeric',
    });
    acc[receiptDate] = (acc[receiptDate] || 0) + receipt.amount / 100;
    return acc;
  }, {});

  const totalExpenditure = receipts.reduce((total, receipt) => total + receipt.amount / 100, 0);

  const chartData = {
      labels: Object.keys(earningsData), // Dates (month/year)
      datasets: [
          {
              label: 'Total Expenditure (£)',
              data: Object.values(earningsData), // Earnings corresponding to the labels
              backgroundColor: 'rgba(255, 233, 228, 0.5)',
              borderColor: 'rgba(255, 108, 75, 1)',
              borderWidth: 1,
          },
      ],
  };

  // Chart configuration options
  const chartOptions = {
      responsive: true,
      plugins: {
          legend: {
              display: true,
              position: 'bottom',
              labels: {
                  font: {
                      size: 14,
                      family: 'DM Sans',
                      weight: 'bold',
                  },
                  color: '#333',
              },
          },
          title: {
              display: true,
              text: 'Expenditure Over Time',
              font: {
                  size: 18,
                  family: 'DM Sans',
                  weight: 'bold',
              },
              color: '#333',
          },
          tooltip: {
              enabled: true,
              backgroundColor: 'rgba(0, 0, 0, 0.7)', // Tooltip background
              titleColor: '#fff', // Title font color
              bodyColor: '#fff', // Body font color
              borderColor: '#ddd', // Tooltip border
              borderWidth: 1, // Tooltip border width
          },
      },
      scales: {
          x: {
              grid: {
                  display: false,
              },
              ticks: {
                  color: '#333',
                  font: {
                      size: 12,
                      family: 'DM Sans',
                  },
              },
          },
          y: {
              grid: {
                  color: '#e0e0e0',
                  borderDash: [4, 4],
              },
              ticks: {
                  color: '#333',
                  font: {
                      size: 12,
                      family: 'DM Sans',
                  },
              },
              beginAtZero: true,
          },
      },
  };

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
      const deleteCard = httpsCallable(functions, 'deleteCard');
      const response = await deleteCard({ cardId });
      if (response.data.success) {
        alert('Card deleted successfully!');
        setSavedCards((prevCards) => prevCards.filter((card) => card.id !== cardId));
      } else {
        alert('Failed to delete the card.');
      }
    } catch (error) {
      console.error('Error deleting card:', error);
      alert('An error occurred while deleting the card. Please try again.');
    }
  };

  return (
    <>
    <div className="head">
        <h1 className="title">Finances</h1>
    </div>
    <div className="body finances">
      <div className="tile total-expenditure">
        <h2>Overall Expenditure</h2>
        <div className="value">
        <h1>£{totalExpenditure.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h1>
        </div>
      </div>
      <div className="tile connect-account graph">
          <h2>Your Expenditure</h2>
          <Bar data={chartData} options={chartOptions} />
      </div>
      <div className="tile your-fees">
        <h2>Your Payments</h2>
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