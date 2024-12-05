import React, { useState, useEffect } from 'react';
import { CardForm } from '../common/CardDetails'
import '../../assets/styles/host/payment-modal.styles.css'
import {SuccessIcon, PlusIcon} from '../ui/Extras/Icons'
import VisaIcon from '../../assets/images/visa.png';
import MastercardIcon from '../../assets/images/mastercard.png';
import AmexIcon from '../../assets/images/amex.png';
import { LoadingThreeDots } from '../ui/loading/Loading'



export const PaymentModal = ({ savedCards, onSelectCard, onClose, gigData, makingPayment, setMakingPayment, paymentSuccess, setPaymentSuccess, setSavedCards }) => {

    const [selectedCardId, setSelectedCardId] = useState(null);
    const [addingNewCard, setAddingNewCard] = useState(false);

    const cardBrandIcons = {
        visa: VisaIcon,
        mastercard: MastercardIcon,
        amex: AmexIcon,
        unknown: null,
    };

    // Automatically set the default card on load
    useEffect(() => {
        const defaultCard = savedCards.find((card) => card.card.id === card.customer?.default_source);
        if (defaultCard) {
            setSelectedCardId(defaultCard.id);
        }
    }, [savedCards]);

    const handleCardSelection = (cardId) => {
        setSelectedCardId(cardId);
    };

    return (
        <div className="modal payment">
        <div className="modal-content">
            {makingPayment ? (
                <div className="making-payment">
                    <h2>Processing your payment...</h2>
                    <LoadingThreeDots />
                    <h4>Please do not close or refresh your browser.</h4>
                </div>
            ) : (
                paymentSuccess ? (
                    <div className='payment-success'>
                        <h2>Gig Payment Complete!</h2>
                        <SuccessIcon />
                        <h4>We are processing the payment now, the gig will be confirmed shortly.</h4>
                        <button className="btn secondary" onClick={onClose}>
                            Close
                        </button>
                    </div>
                ) : (
                    savedCards.length > 0 && !addingNewCard ? (
                        <>
                            <h2>Complete Gig Payment</h2>
                            {gigData?.agreedFee && (
                                <div className="payment-details">
                                    <div className="payment-line">
                                        <h6>Agreed gig fee:</h6>
                                        <h3>{gigData.agreedFee}</h3>
                                    </div>
                                    <div className="payment-line">
                                        <h6>Service fee:</h6>
                                        <h3>£{(parseFloat(gigData.agreedFee.replace('£', '')) * 0.05).toFixed(2)}</h3>
                                    </div>
                                    <div className="payment-line">
                                        <h6>Total Payment Due:</h6>
                                        <h1>£{(parseFloat(gigData.agreedFee.replace('£', '')) * 1.05).toFixed(2)}</h1>
                                    </div>
                                </div>
                            )}
                            <ul className="card-list">
                            {savedCards.map((card) => (
                                <li
                                    key={card.id}
                                    className={`card-item ${selectedCardId === card.id ? 'selected' : ''}`}
                                    onClick={() => handleCardSelection(card.id)}
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
                                    {card.customer?.default_source && (card.customer.default_source === card.card.id) && (
                                        <div className="card-type">
                                            <p>Default</p>
                                        </div>
                                    )}
                                </li>
                            ))}
                            <li className="card-item" onClick={() => setAddingNewCard(true)}>
                                <h4>Add Another Card</h4>
                                <PlusIcon />
                            </li>
                            </ul>
                            <button
                                className="btn primary"
                                onClick={() => onSelectCard(selectedCardId)}
                                disabled={!selectedCardId}
                            >
                                Pay Gig Fee
                            </button>
                        </>
                    ) : (
                        <div className="card-details-entry">
                            <h2>Add Payment Details</h2>
                            <CardForm activityType={'making payment'} setCardDetails={setSavedCards} cardDetails={savedCards} setAddingNewCard={setAddingNewCard} />
                        </div>
                    )
                )
            )}
            {!makingPayment && (
                <button className="btn tertiary close" onClick={onClose}>
                    Close
                </button>
            )}
        </div>
        </div>
    );
};

