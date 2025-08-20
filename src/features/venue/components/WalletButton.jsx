import { Elements, useStripe, useElements, PaymentRequestButtonElement, ExpressCheckoutElement } from "@stripe/react-stripe-js";
import { confirmPaymentIntent } from "../../../services/functions";
import { toast } from "sonner";
import { useEffect, useState } from "react";

export const WalletButton = ({ amountToCharge, gigData, onSucceeded }) => {
  const stripe = useStripe();
  const elements = useElements();

  // called when the user taps Apple Pay / Google Pay / Link
  const handleConfirm = async (event) => {
    const { resolve, reject } = event;   // tell the element success/fail

    try {
      // 1) Ask your backend to create a PaymentIntent for this amount
      const { data } = await createGigPaymentIntent({ amountToCharge, gigData });
      const clientSecret = data?.clientSecret;
      if (!clientSecret) throw new Error('No client secret returned');

      // 2) Confirm the payment *with* the Express Checkout details captured by the element
      const { error, paymentIntent } = await stripe.confirmPayment({
        clientSecret,
        elements,                 // Important: this lets Stripe re-use the wallet PM just collected
        redirect: 'if_required',  // stay in-modal for SCA if possible
      });

      if (error) {
        reject(error);
        toast.error(error.message || 'Payment failed');
        return;
      }

      // 3) Success 🎉
      resolve();
      onSucceeded?.(paymentIntent?.id || data?.paymentIntentId);
    } catch (err) {
      console.error(err);
      reject(err);
      toast.error('Payment failed');
    }
  };

  if (!stripe || !elements) return null;

  return (
    <ExpressCheckoutElement
      onConfirm={handleConfirm}
      options={{
        // Optional: order the buttons. Omit or reorder to taste.
        // Stripe will still auto-hide unsupported options per device.
        paymentMethodOrder: ['apple_pay', 'google_pay', 'link', 'card'],

        // Optional: style
        buttonType: 'default',  // 'default' | 'buy' | 'donate' | etc.
        buttonTheme: 'dark',    // 'dark' | 'light' | 'light-outline'
        buttonHeight: 44,
      }}
    />
  );
}