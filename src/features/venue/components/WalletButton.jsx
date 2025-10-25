import { Elements, useStripe, useElements, PaymentRequestButtonElement, ExpressCheckoutElement } from "@stripe/react-stripe-js";
import { confirmPaymentIntent } from "../../../services/function-calls/payments";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export const WalletButton = ({ amountToCharge, gigData, onSucceeded, musicianProfileId, customerId }) => {
  const stripe = useStripe();
  const elements = useElements();
  const location = useLocation();

  const handleConfirm = async (event) => {
    try {
      let correctId = musicianProfileId;
      if (!correctId) {

      }
      const data = await confirmPaymentIntent({ amountToCharge, gigData, musicianProfileId, customerId });
      const clientSecret = data?.clientSecret;
      if (!clientSecret) throw new Error('No client secret returned');
      const returnUrl = `${window.location.origin}${location.pathname}${location.search}${location.hash}`;
      const { error, paymentIntent } = await stripe.confirmPayment({
        clientSecret,
        elements,
        confirmParams: {
          return_url: returnUrl,
        },
        redirect: 'if_required',
      });
      if (error) {
        toast.error(error.message || 'Payment failed');
        return;
      }
      toast.success('Payment Accepted!')
      onSucceeded?.(paymentIntent?.id || data?.paymentIntentId);
    } catch (err) {
      console.error(err);
      toast.error('Payment failed');
    }
  };

  if (!stripe || !elements) return null;

  return (
    <ExpressCheckoutElement
      onConfirm={handleConfirm}
      options={{
        paymentMethodOrder: ['apple_pay', 'google_pay', 'link'],
        buttonHeight: 44,
      }}
    />
  );
}