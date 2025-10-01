import React, { useState } from 'react';
import {
    CardNumberElement,
    CardExpiryElement,
    CardCvcElement,
    useStripe,
    useElements
  } from '@stripe/react-stripe-js';
import VisaIcon from '@assets/images/visa.png';
import MastercardIcon from '@assets/images/mastercard.png';
import AmexIcon from '@assets/images/amex.png';
import '@styles/shared/card-details.styles.css'
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading'
import { createStripePaymentMethod, saveStripePaymentMethod } from '@services/function-calls/payments';
import { toast } from 'sonner';
import { LoadingSpinner } from '../ui/loading/Loading';


export const CardForm = ({
  activityType,
  setCardDetails,
  setSaveCardModal,
  setNewCardSaved,
  setAddingNewCard,
  handleCardSelection,
  destinationChoices = [],
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [billingDetails, setBillingDetails] = useState({
    address: { line1: '', line2: '', city: '', state: '', postal_code: '', country: 'GB' },
  });
  const [cardBrand, setCardBrand] = useState('unknown');
  const [saveCard, setSaveCard] = useState(false);

  // NEW: destination picker
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    destinationChoices[0]?.id || null
  );

  const cardBrandIcons = { visa: VisaIcon, mastercard: MastercardIcon, amex: AmexIcon, unknown: null };

  const [cardComplete, setCardComplete] = useState({ number: false, expiry: false, cvc: false });
  const handleCardNumberChange = (event) => {
    setCardBrand(event.brand || 'unknown');
    setCardComplete((prev) => ({ ...prev, number: event.complete }));
  };

  const handleBillingChange = (e) => {
    const { name, value } = e.target;
    const fieldPath = name.split('.');
    setBillingDetails((prev) => {
      const next = { ...prev };
      let cur = next;
      for (let i = 0; i < fieldPath.length - 1; i++) cur = cur[fieldPath[i]];
      cur[fieldPath[fieldPath.length - 1]] = value;
      return next;
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      toast.error('Please choose where to save this card.');
      return;
    }
    setLoading(true);
    const cardElement = elements.getElement(CardNumberElement);

    try {
      // 1) Create a PM from the card fields
      const pm = await createStripePaymentMethod(
        stripe,
        cardElement,
        name,
        billingDetails.address
      );

      if (activityType === 'adding card') {
        // 2) Save/attach PM to the selected Stripe Customer
        //    ⬇️ UPDATED: pass target customer id
        const data = await saveStripePaymentMethod(pm.id, selectedCustomerId);
        if (data.success) {
          const savedPm = data.paymentMethodUpdate || pm;
          const newDefaultId =
            data.customerUpdate?.invoice_settings?.default_payment_method || savedPm.id;

          setNewCardSaved({
            ...savedPm,
            default: savedPm.id === newDefaultId,
            __newDefaultId: newDefaultId,
          });

          setSaveCardModal(false);
          toast.success('Card saved.');
        } else {
          toast.error('Error saving card details. Please try again.');
          setSaveCardModal(false);
        }
      } else if (activityType === 'making payment') {
        // keep your existing flow
        handleCardSelection(pm.id);
        setCardDetails((prev) => [...prev, pm]);
        if (saveCard) await saveStripePaymentMethod(pm.id, selectedCustomerId);
        setAddingNewCard(false);
      }
    } catch (err) {
      console.error('Error processing card:', err);
      toast.error('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

return (
    <form className='card-details-form'>
        <div className='card-details-container'>
          <h4>Card Details:</h4>

          {destinationChoices.length > 0 && (
          <div className='field-container'>
            <label htmlFor='save-destination' className='label'>Save card to</label>
            <select
              id='save-destination'
              className='input'
              value={selectedCustomerId || ''}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              disabled={loading}
            >
              {destinationChoices.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}

          <div className='field-container'>
            <label htmlFor='cardholder-name' className="label">Name on Card</label>
            <input
              id='cardholder-name'
              type='text'
              placeholder='John Doe'
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className='input'
              disabled={loading}
            />
          </div>
          {/* Step 1: Card Details */}
          <div className='field-container'>
            <label htmlFor='card-number' className="label">Card Number</label>
            <div className='card-number-container'>
                <CardNumberElement
                id='card-number'
                options={{
                    style: {
                    base: {
                        fontSize: '14px',
                        color: '#000',
                        fontWeight: 400,
                        fontFamily: 'Inter, sans-serif',
                        '::placeholder': { color: '#808080' },
                    },
                    invalid: { color: '#fa755a' },
                    },
                }}
                onChange={handleCardNumberChange}
                />
                {cardBrand !== 'unknown' && (
                    <img
                        src={cardBrandIcons[cardBrand]}
                        className='card-brand-icon'
                    />
                )}
            </div>
          </div>
          <div className='exp-cvc'>
            <div className='field-container'>
              <label htmlFor='card-expiry' className="label">Expiry Date</label>
              <CardExpiryElement
                id='card-expiry'
                options={{
                  style: {
                    base: {
                      fontSize: '14px',
                      color: '#000',
                      fontWeight: 400,
                      fontFamily: 'Inter, sans-serif',
                      '::placeholder': { color: '#808080' },
                    },
                    invalid: { color: '#fa755a' },
                  },
                }}
                onChange={(event) =>
                    setCardComplete((prev) => ({ ...prev, expiry: event.complete }))
                  }
              />
            </div>
            <div className='field-container'>
              <label htmlFor='card-cvc' className="label">CVC</label>
              <CardCvcElement
                id='card-cvc'
                options={{
                  style: {
                    base: {
                      fontSize: '14px',
                      fontWeight: 400,
                      color: '#000',
                      fontFamily: 'Inter, sans-serif',
                      '::placeholder': { color: '#808080', fontFamily: 'Inter, sans-serif' },
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
          <div className='address-flex'>
            <div className='field-container'>
                <label htmlFor='line1' className="label">Address Line 1</label>
                <input
                id='line1'
                type='text'
                name='address.line1'
                placeholder='123 Main St'
                value={billingDetails.address.line1}
                onChange={handleBillingChange}
                required
                className='input'
                disabled={loading}
                />
            </div>
            <div className='field-container'>
                <label htmlFor='line2' className="label">Address Line 2 (Optional)</label>
                <input
                id='line2'
                type='text'
                name='address.line2'
                placeholder='Apartment, Suite, etc.'
                value={billingDetails.address.line2}
                onChange={handleBillingChange}
                className='input'
                disabled={loading}
                />
            </div>
          </div>
          <div className='address-flex'>
            <div className='field-container'>
                <label htmlFor='city' className="label">City</label>
                <input
                id='city'
                type='text'
                name='address.city'
                placeholder='London'
                value={billingDetails.address.city}
                onChange={handleBillingChange}
                required
                className='input'
                disabled={loading}
                />
            </div>
            <div className='field-container'>
                <label htmlFor='state' className="label">County</label>
                <input
                id='state'
                type='text'
                name='address.state'
                placeholder='England'
                value={billingDetails.address.state}
                onChange={handleBillingChange}
                required
                className='input'
                disabled={loading}
                />
            </div>
          </div>
          <div className='address-flex'>
            <div className='field-container'>
                <label htmlFor='postal_code' className="label">Postal Code</label>
                <input
                id='postal_code'
                type='text'
                name='address.postal_code'
                placeholder='SW1A 1AA'
                value={billingDetails.address.postal_code}
                onChange={handleBillingChange}
                required
                className='input'
                disabled={loading}
                />
            </div>
            <div className='field-container'>
                <label htmlFor='country' className="label">Country</label>
                <select
                id='country'
                name='address.country'
                value={billingDetails.address.country}
                onChange={handleBillingChange}
                required
                className='input'
                disabled={loading}
                >
                <option value='GB'>United Kingdom</option>
                {/* Add more countries as needed */}
                </select>
            </div>
          </div>
          {activityType === 'making payment' && (
          <div className='field-container save-card'>
              <label htmlFor='save-card' className="label">
                  <input
                      id='save-card'
                      type='checkbox'
                      checked={saveCard}
                      onChange={() => setSaveCard(!saveCard)}
                      disabled={loading}
                  />
                  Save this card for future payments
              </label>
          </div>)}
          {loading ? (
            <div className="loading-card-details">
              <LoadingSpinner width={20} height={20} />
            </div>
          ) : (
            <button className='btn primary' onClick={handleSave} disabled={loading}>
              {activityType === 'adding card' ? 'Save Card' : 'Next'}
            </button>
          )}
        </div>
    </form>
  );
};