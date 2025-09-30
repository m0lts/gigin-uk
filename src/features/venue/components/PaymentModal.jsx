import React, { useState, useEffect, useMemo } from 'react';
import { CardForm } from '@features/shared/components/CardDetails'
import '@assets/styles/host/payment-modal.styles.css'
import { SuccessIcon, PlusIcon } from '@features/shared/ui/extras/Icons'
import VisaIcon from '@assets/images/visa.png';
import MastercardIcon from '@assets/images/mastercard.png';
import AmexIcon from '@assets/images/amex.png';
import { CardIcon, ClockIcon, LeftArrowIcon } from '../../shared/ui/extras/Icons';
import { listenToPaymentStatus } from '../../../services/client-side/payments';
import { WalletButton } from './WalletButton';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { LoadingSpinner } from '../../shared/ui/loading/Loading';
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
    setGigData,
    musicianProfileId,
    customerDetails,
    venues,
  }) => {
    const [selectedCardId, setSelectedCardId] = useState(null);
    const [addingNewCard, setAddingNewCard] = useState(false);

    const selectedCard = useMemo(
      () => savedCards.find(c => c.id === selectedCardId) || null,
      [savedCards, selectedCardId]
    );

    const venueCustomerId = useMemo(() => {
      const v = (venues || []).find(v => v.venueId === gigData?.venueId);
      return v?.stripeCustomerId || null;
    }, [venues, gigData?.venueId]);
    
    const paymentCustomerId =
      selectedCard?.customer || venueCustomerId || customerDetails?.id || null;
  
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
      if (selectedCardId) return;
      if (!Array.isArray(savedCards) || savedCards.length === 0) return;
      const defaultPmId = savedCards[0]?.customer?.invoice_settings?.default_payment_method
        || savedCards[0]?.customer?.default_source;
      const defaultCard = defaultPmId
        ? savedCards.find(c => c?.id === defaultPmId)
        : null;
      setSelectedCardId((defaultCard || savedCards[0])?.id || null);
    }, [savedCards, selectedCardId]);
  
    const handleCardSelection = (cardId) => {
      setSelectedCardId(cardId);
    };
  
    const baseFee = gigData?.agreedFee && (parseFloat(String(gigData.agreedFee).replace(/[^\d.]/g, "")) || 0);
    const totalPounds = baseFee * 1.00;
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
              <LoadingSpinner />
              <h2>Processing payment</h2>
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
              <h2>Payment Received</h2>
              <p className='subtext'>The gig will be confirmed when the payment has been processed...</p>
            </div>
          ) : savedCards.length > 0 && !addingNewCard ? (
            /* CARD SELECTION + SUMMARY */
            <>
              <div className="modal-header">
                <CardIcon />
                <h2 className="title">Complete Gig Payment</h2>
                <p>Pay the gig fee that you agreed with the musician. This fee is held by Gigin until 48 hours after the gig has been performed - giving you plenty of time to log a dispute, stopping the payment from being released to the musician until resolved.</p>
              </div>
              {/* {gigData?.agreedFee && (
                    <div className='payment-details'>
                        <div className='payment-line'>
                            <h6>Total Payment Due:</h6>
                            <h1>{gigData.agreedFee}</h1>
                        </div>
                    </div>
                )} */}
              <div className="wallets">
              <WalletButton
                amountToCharge={amountSubunits}
                gigData={gigData}
                musicianProfileId={musicianProfileId}
                customerId={paymentCustomerId}
                onSucceeded={(piId) => {
                  setPaymentIntentId?.(piId);
                  setPaymentSuccess(true);
                  setGigData(prev => ({
                    ...prev,
                    applicants: prev.applicants.map(applicant =>
                        applicant.id === musicianProfileId
                            ? { ...applicant, status: 'payment processing' }
                            : applicant
                    )
                }));
                }}
              />
              </div>
              <h3 className="subtitle">Select Card</h3>
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
                    {card.ownerType === "user" ? (
                      <div className="card-owner">
                        <h6>Personal Card</h6>
                      </div>
                    ) : (
                      <div className="card-owner">
                        <h6>{card.venueName}'s Card</h6>
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
                handleCardSelection={handleCardSelection}
                destinationChoices={[
                  ...(customerDetails?.id
                    ? [{ label: 'My Account', id: customerDetails.id }]
                    : []),
                  ...((venues || [])
                    .filter(v => v.stripeCustomerId)
                    .map(v => ({
                      label: `Venue: ${v.name || v.displayName || v.id}`,
                      id: v.stripeCustomerId,
                    })))
                ]}
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
