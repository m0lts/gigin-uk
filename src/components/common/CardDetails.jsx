import React, { useState } from 'react';
import {
    CardNumberElement,
    CardExpiryElement,
    CardCvcElement,
    useStripe,
    useElements
  } from '@stripe/react-stripe-js';
import VisaIcon from '../../assets/images/visa.png';
import MastercardIcon from '../../assets/images/mastercard.png';
import AmexIcon from '../../assets/images/amex.png';
import { motion, AnimatePresence } from 'framer-motion';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase.js';
import '../../assets/styles/common/card-details.styles.css'
import {LoadingThreeDots} from '../ui/loading/Loading'


// Card input form component
export const CardForm = ({ activityType, setCardDetails, setSaveCardModal, setNewCardSaved, setAddingNewCard }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState('');
    const [billingDetails, setBillingDetails] = useState({
      address: {
        line1: '',
        line2: '',
        city: '',
        state: '',
        postal_code: '',
        country: 'GB', // Default country
      },
    });
    const [cardBrand, setCardBrand] = useState('unknown');
    const [saveCard, setSaveCard] = useState(false);

    const cardBrandIcons = {
        visa: VisaIcon,
        mastercard: MastercardIcon,
        amex: AmexIcon,
        unknown: null,
    };

    const handleCardNumberChange = (event) => {
        // Update card brand and completion status
        setCardBrand(event.brand || 'unknown');
        setCardComplete((prev) => ({ ...prev, number: event.complete }));
    };

    const [cardComplete, setCardComplete] = useState({
        number: false,
        expiry: false,
        cvc: false,
      });
  
    const handleBillingChange = (e) => {
      const { name, value } = e.target;
      const fieldPath = name.split('.');
  
      setBillingDetails((prevDetails) => {
        const updatedDetails = { ...prevDetails };
        let current = updatedDetails;
  
        for (let i = 0; i < fieldPath.length - 1; i++) {
          current = current[fieldPath[i]];
        }
        current[fieldPath[fieldPath.length - 1]] = value;
  
        return updatedDetails;
      });
    };
  
    const handleSave = async (e) => {
      e.preventDefault();
      setLoading(true);

      const cardNumberElement = elements.getElement(CardNumberElement);

      try {
          const { error, paymentMethod } = await stripe.createPaymentMethod({
              type: 'card',
              card: cardNumberElement,
              billing_details: {
                  name,
                  address: billingDetails.address,
              },
          });

          if (error) {
              console.error('Error creating payment method:', error);
              alert('Failed to process card details. Please try again.');
              setLoading(false);
              return;
          }

          const formattedPaymentMethod = {
            id: paymentMethod.id,
            card: {
                brand: paymentMethod.card.brand,
                last4: paymentMethod.card.last4,
                exp_month: paymentMethod.card.exp_month,
                exp_year: paymentMethod.card.exp_year,
            },
            billing_details: {
                name: paymentMethod.billing_details.name,
                address: paymentMethod.billing_details.address,
            },
        };

          if (activityType === 'adding card') {
              const savePaymentMethod = httpsCallable(functions, 'savePaymentMethod');
              const response = await savePaymentMethod({
                  paymentMethodId: paymentMethod.id
              });

              if (response.data.success) {
                setSaveCardModal(false);
                setNewCardSaved(true);
              } else {
                alert('Failed to save card details.');
                setSaveCardModal(false);
              }
          } else if (activityType === 'making payment') {
              // Pass card details to parent for payment
              setCardDetails((prevCardDetails) => [...prevCardDetails, formattedPaymentMethod]);
              setAddingNewCard(false);
              // Optionally save the card if the user checked the box
              if (saveCard) {
                  const savePaymentMethod = httpsCallable(functions, 'savePaymentMethod');
                  await savePaymentMethod({
                      paymentMethodId: paymentMethod.id,
                  });
              }
          }
      } catch (err) {
          console.error('Error processing card:', err);
          alert('An error occurred. Please try again.');
      } finally {
          setLoading(false);
      }
  };

return (
    <form className="card-details-form">
        <div className="card-details-container">
          <h4>Card Details:</h4>
          <div className="field-container">
            <label htmlFor="cardholder-name">Name on Card</label>
            <input
              id="cardholder-name"
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="input"
              disabled={loading}
            />
          </div>
          {/* Step 1: Card Details */}
          <div className="field-container">
            <label htmlFor="card-number">Card Number</label>
            <div className="card-number-container">
                <CardNumberElement
                id="card-number"
                options={{
                    style: {
                    base: {
                        fontSize: '16px',
                        color: '#000',
                        fontFamily: 'Roboto, Open Sans, Segoe UI, sans-serif',
                        '::placeholder': { color: '#acacac' },
                    },
                    invalid: { color: '#fa755a' },
                    },
                }}
                onChange={handleCardNumberChange}
                />
                {cardBrand !== 'unknown' && (
                    <img
                        src={cardBrandIcons[cardBrand]}
                        alt="Card Type"
                        className="card-brand-icon"
                    />
                )}
            </div>
          </div>
          <div className="exp-cvc">
            <div className="field-container">
              <label htmlFor="card-expiry">Expiry Date</label>
              <CardExpiryElement
                id="card-expiry"
                options={{
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#000',
                      fontFamily: 'Roboto, Open Sans, Segoe UI, sans-serif',
                      '::placeholder': { color: '#aab7c4' },
                    },
                    invalid: { color: '#fa755a' },
                  },
                }}
                onChange={(event) =>
                    setCardComplete((prev) => ({ ...prev, expiry: event.complete }))
                  }
              />
            </div>
            <div className="field-container">
              <label htmlFor="card-cvc">CVC</label>
              <CardCvcElement
                id="card-cvc"
                options={{
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#000',
                      fontFamily: 'Roboto, Open Sans, Segoe UI, sans-serif',
                      '::placeholder': { color: '#aab7c4' },
                    },
                    invalid: { color: '#fa755a' },
                  },
                }}
                onChange={(event) =>
                    setCardComplete((prev) => ({ ...prev, cvc: event.complete }))
                  }
              />
            </div>
          </div>
          <h4>Billing Address:</h4>
          <div className="address-flex">
            <div className="field-container">
                <label htmlFor="line1">Address Line 1</label>
                <input
                id="line1"
                type="text"
                name="address.line1"
                placeholder="123 Main St"
                value={billingDetails.address.line1}
                onChange={handleBillingChange}
                required
                className="input"
                disabled={loading}
                />
            </div>
            <div className="field-container">
                <label htmlFor="line2">Address Line 2 (Optional)</label>
                <input
                id="line2"
                type="text"
                name="address.line2"
                placeholder="Apartment, Suite, etc."
                value={billingDetails.address.line2}
                onChange={handleBillingChange}
                className="input"
                disabled={loading}
                />
            </div>
          </div>
          <div className="address-flex">
            <div className="field-container">
                <label htmlFor="city">City</label>
                <input
                id="city"
                type="text"
                name="address.city"
                placeholder="London"
                value={billingDetails.address.city}
                onChange={handleBillingChange}
                required
                className="input"
                disabled={loading}
                />
            </div>
            <div className="field-container">
                <label htmlFor="state">County</label>
                <input
                id="state"
                type="text"
                name="address.state"
                placeholder="England"
                value={billingDetails.address.state}
                onChange={handleBillingChange}
                required
                className="input"
                disabled={loading}
                />
            </div>
          </div>
          <div className="address-flex">
            <div className="field-container">
                <label htmlFor="postal_code">Postal Code</label>
                <input
                id="postal_code"
                type="text"
                name="address.postal_code"
                placeholder="SW1A 1AA"
                value={billingDetails.address.postal_code}
                onChange={handleBillingChange}
                required
                className="input"
                disabled={loading}
                />
            </div>
            <div className="field-container">
                <label htmlFor="country">Country</label>
                <select
                id="country"
                name="address.country"
                value={billingDetails.address.country}
                onChange={handleBillingChange}
                required
                className="input"
                disabled={loading}
                >
                <option value="GB">United Kingdom</option>
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                {/* Add more countries as needed */}
                </select>
            </div>
          </div>
          {activityType === 'making payment' && (
          <div className="field-container save-card">
              <label htmlFor="save-card">
                  <input
                      id="save-card"
                      type="checkbox"
                      checked={saveCard}
                      onChange={() => setSaveCard(!saveCard)}
                      disabled={loading}
                  />
                  Save this card for future payments
              </label>
          </div>)}
          {loading ? (
            <LoadingThreeDots />
          ) : (
            <button className="btn primary-alt" onClick={handleSave} disabled={loading}>
              {activityType === 'adding card' ? 'Save Card' : 'Next'}
            </button>
          )}
        </div>
    </form>
  );
};