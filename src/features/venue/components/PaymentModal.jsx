import React, { useState, useEffect } from 'react';
import { CardForm } from '@features/shared/components/CardDetails'
import '@assets/styles/host/payment-modal.styles.css'
import { SuccessIcon, PlusIcon } from '@features/shared/ui/extras/Icons'
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading'
import VisaIcon from '@assets/images/visa.png';
import MastercardIcon from '@assets/images/mastercard.png';
import AmexIcon from '@assets/images/amex.png';
import { CardIcon, ClockIcon, LeftArrowIcon } from '../../shared/ui/extras/Icons';
import { listenToPaymentStatus } from '../../../services/payments';
import { WalletButton } from './WalletButton';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export const PaymentModal = ({
    savedCards,
    onSelectCard,
    onClose,
    gigData,
    makingPayment,
    setMakingPayment,
    paymentSuccess,
    setPaymentSuccess,
    setSavedCards,
    paymentIntentId,
    setPaymentIntentId,
  }) => {
    const [selectedCardId, setSelectedCardId] = useState(null);
    const [addingNewCard, setAddingNewCard] = useState(false);
  
    useEffect(() => {
      if (!paymentIntentId) return;
  
      setMakingPayment(true);
  
      const unsubscribe = listenToPaymentStatus(paymentIntentId, (status) => {
        if (status === "succeeded") {
          setPaymentSuccess(true);
          setMakingPayment(false);
        } else if (status === "failed") {
          setPaymentSuccess(false);
          setMakingPayment(false);
          toast.error("Payment failed. Please try again.");
        } else {
          setMakingPayment(true);
        }
      });
  
      return () => unsubscribe();
    }, [paymentIntentId]);
  
    const cardBrandIcons = {
      visa: VisaIcon,
      mastercard: MastercardIcon,
      amex: AmexIcon,
      unknown: null
    };
  
    useEffect(() => {
      const defaultCard = savedCards.find(
        (card) => card.card.id === card.customer?.default_source
      );
      if (defaultCard) {
        setSelectedCardId(defaultCard.id);
      }
    }, [savedCards]);
  
    const handleCardSelection = (cardId) => {
      setSelectedCardId(cardId);
    };
  
    const baseFee = gigData?.agreedFee && (parseFloat(String(gigData.agreedFee).replace(/[^\d.]/g, "")) || 0);
    const totalPounds = baseFee * 1.05;
    const totalDue = `${totalPounds.toFixed(2)}`;
    const amountSubunits = Math.round(totalPounds * 100);
  
    return (
      <div className="modal payment">
        <Elements
          stripe={stripePromise}
          options={{
            mode: 'payment',
            amount: amountSubunits,
            currency: 'gbp',
          }}
        >
        <div className="modal-content">
          {/* PAYMENT PROCESSING */}
          {makingPayment ? (
            <div className="making-payment">
              <LoadingThreeDots />
              <h2>We’re processing your payment</h2>
              <p className="subtext">
                Please keep this window open until we confirm your payment.
              </p>
              <div className="progress-bar">
                <div className="progress-fill animate"></div>
              </div>
            </div>
          ) : paymentSuccess ? (
            /* SUCCESS STATE */
            <div className="payment-success">
              <SuccessIcon className="success-animate" />
              <h2>Payment Successful!</h2>
              <h4>
                We’ve received your payment!
              </h4>
              <button className="btn primary" onClick={onClose}>
                Close
              </button>
            </div>
          ) : savedCards.length > 0 && !addingNewCard ? (
            /* CARD SELECTION + SUMMARY */
            <>
              <div className="modal-header">
                <CardIcon />
                <h2 className="title">Complete Gig Payment</h2>
                <p>Pay the gig fee that you agreed with the musician. This fee is held by Gigin until 48 hours after the gig has been performed - giving you plenty of time to log a dispute, stopping the payment from being released to the musician until resolved.</p>
              </div>
              {gigData?.agreedFee && (
                    <div className='payment-details'>
                        <div className='payment-line'>
                            <h6>Agreed gig fee:</h6>
                            <h3>{gigData.agreedFee}</h3>
                        </div>
                        <div className='payment-line'>
                            <h6>Service fee:</h6>
                            <h3>£{(parseFloat(gigData.agreedFee.replace('£', '')) * 0.05).toFixed(2)}</h3>
                        </div>
                        <div className='payment-line'>
                            <h6>Total Payment Due:</h6>
                            <h1>£{totalDue}</h1>
                        </div>
                    </div>
                )}
              <div className="wallets">
              <WalletButton
                amountToCharge={totalDue}
                gigData={gigData}
                onSucceeded={(piId) => {
                  setPaymentIntentId?.(piId);     // <-- set the PI so the listener can attach
                  setMakingPayment(true);         // show processing state while listener runs
                }}
              />
              </div>
              <h3 className="subtitle">Select a saved card</h3>
              <ul className="card-list">
                {savedCards.map((card) => (
                  <li
                    key={card.id}
                    className={`card-item ${
                      selectedCardId === card.id ? "selected" : ""
                    }`}
                    onClick={() => handleCardSelection(card.id)}
                  >
                    <div className="card-left">
                      {cardBrandIcons[card.card.brand.toLowerCase()] && (
                        <img
                          src={cardBrandIcons[card.card.brand.toLowerCase()]}
                          alt={`${card.card.brand} icon`}
                          className="card-brand-icon"
                        />
                      )}
                      <div className="card-details">
                        <h4>
                          {card.card.brand.toUpperCase()} ending in{" "}
                          {card.card.last4}
                        </h4>
                        <h6>
                          Expires {card.card.exp_month}/{card.card.exp_year}
                        </h6>
                      </div>
                    </div>
                    {card.customer?.default_source === card.card.id && (
                      <div className="card-type">
                        <p>Default</p>
                      </div>
                    )}
                  </li>
                ))}
                <li
                  className="card-item add-new"
                  onClick={() => setAddingNewCard(true)}
                >
                  <h4>Add Another Card</h4>
                  <PlusIcon />
                </li>
              </ul>
              <button
                className="btn primary pay-btn"
                onClick={() => onSelectCard(selectedCardId)}
                disabled={!selectedCardId}
              >
                Pay £{totalDue}
              </button>
            </>
          ) : (
            /* ADD NEW CARD */
            <>
              <button className="btn text back-button" onClick={() => setAddingNewCard(false)}>
                <LeftArrowIcon /> Back to Payment
              </button>
              <div className="modal-header card">
                <CardIcon />
                <h2>Add Payment Method</h2>
                <p>Add a card to pay for this gig. You can save the card to your Gigin account if you wish.</p>
              </div>
              <CardForm
                activityType="making payment"
                setCardDetails={setSavedCards}
                cardDetails={savedCards}
                setAddingNewCard={setAddingNewCard}
              />
            </>
          )}
          {!makingPayment && (
            <button className="btn tertiary close" onClick={onClose}>
              Close
            </button>
          )}
        </div>
        </Elements>
      </div>
    );
  };
