import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
    CardNumberElement,
    CardExpiryElement,
    CardCvcElement,
    useStripe,
    useElements,
    Elements
  } from '@stripe/react-stripe-js';
import VisaIcon from '../../assets/images/visa.png';
import MastercardIcon from '../../assets/images/mastercard.png';
import AmexIcon from '../../assets/images/amex.png';
import { motion, AnimatePresence } from 'framer-motion';


// Load your Stripe publishable key
const stripePromise = loadStripe('pk_test_51Py8lOHI8M50kHhR49I0lIAR8gMId69DubgtmTEPQfHJV9JQSBVbflPSq0J8AT1kZUMqDHncMP0xdfvy3pGyQEOG002PN3x3dT');

// Card input form component
export const CardForm = () => {
    const stripe = useStripe();
    const elements = useElements();
  
    const [step, setStep] = useState(1); // Track current step
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
  
    const handleNext = (e) => {
        e.preventDefault();
    
        // Ensure all card fields are complete before proceeding
        if (!cardComplete.number || !cardComplete.expiry || !cardComplete.cvc) {
          alert('Please fill in all card details before proceeding.');
          return;
        }
    
        setStep(2); // Move to step 2 (billing address)
      };
  
    const handleSave = async (e) => {
      e.preventDefault();
      setLoading(true);
  
      const cardNumberElement = elements.getElement(CardNumberElement);
  
      // Create PaymentMethod with card details and billing address
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
        alert('Failed to save card details. Please try again.');
        setLoading(false);
        return;
      }
  
      try {
        // Call backend function to save the payment method
        const savePaymentMethod = httpsCallable(functions, 'savePaymentMethod');
        const response = await savePaymentMethod({ paymentMethodId: paymentMethod.id });
  
        if (response.data.success) {
          alert('Card and billing details saved successfully!');
        } else {
          alert('Failed to save details.');
        }
      } catch (err) {
        console.error('Error saving payment method:', err);
        alert('An error occurred. Please try again.');
      } finally {
        setLoading(false);
      }
    };


return (
    <form className="card-details-form">
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            className="card-details-container"
            key="card-details"
            initial={{ x: 0, opacity: 1 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
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
          <button className="btn primary-alt" onClick={handleNext} disabled={loading}>
            Next
          </button>
        </motion.div>
      )}

      {step === 2 && (
        <motion.div
            className="card-details-container"
            key="billing-details"
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ duration: 0.25 }}
        >
          {/* Step 2: Billing Address */}
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
                >
                <option value="GB">United Kingdom</option>
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                {/* Add more countries as needed */}
                </select>
            </div>
          </div>
          <button className="btn primary-alt" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Details'}
          </button>
        </motion.div>
      )}
      </AnimatePresence>
    </form>
  );
};